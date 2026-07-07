import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { getJob, saveJob } from "@/lib/store";
import { analyzeGeo } from "@/lib/geo/analyze";
import { runBrandCheck, runQuestion } from "@/lib/engines";
import { bestPosition, citedAny, computeScorecard } from "@/lib/scoring";
import { postLead } from "@/lib/webhook";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";
// 60s works on every Vercel plan (Hobby ceiling). This is plenty for mock mode
// and Perplexity-only live runs. For live DataForSEO (tasks up to 120s), upgrade
// the project to Pro and raise this to 300.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

/** Run indexed tasks with a concurrency cap. */
async function pool<T>(count: number, limit: number, fn: (i: number) => Promise<T>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, count) }, async () => {
    while (true) {
      const i = next++;
      if (i >= count) return;
      await fn(i);
    }
  });
  await Promise.all(workers);
}

export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let jobId: string;
  try {
    jobId = (await req.json()).jobId;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  // Idempotent: only a queued job runs.
  if (job.status !== "queued") return NextResponse.json({ ok: true, status: job.status });

  const touch = async () => {
    job.updatedAt = Date.now();
    await saveJob(job);
  };

  try {
    job.status = "running";
    await touch();

    // Layer 2: on-page GEO readiness (authoritative copy for scoring).
    job.geo = await analyzeGeo(job.domain);
    await touch();

    // Layer 1: live AI citation checks, concurrency-capped.
    await pool(job.questions.length, CONFIG.concurrency, async (i) => {
      const q = job.questions[i];
      q.status = "running";
      await touch();
      try {
        q.engines = await runQuestion(q.question, job.domain);
        q.citedAny = citedAny(q);
        q.bestPosition = bestPosition(q);
        q.status = "done";
        for (const e of q.engines) job.costUsd += e.costUsd ?? 0;
      } catch (err) {
        q.status = "error";
        console.error(`[worker] question failed: ${q.question}`, err);
      }
      await touch();
    });

    // Brand-visibility probe (only if a business name was given).
    if (job.lead.businessName) {
      job.brandCheck = await runBrandCheck(job.lead.businessName, job.domain);
      await touch();
    }

    job.scorecard = computeScorecard(job.questions, job.geo);
    job.status = "done";
    await touch();

    job.webhookSent = await postLead(job);
    await touch();

    return NextResponse.json({ ok: true, status: "done" });
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "Worker failed.";
    await saveJob(job as Job);
    console.error("[worker] job failed:", err);
    return NextResponse.json({ error: job.error }, { status: 500 });
  }
}
