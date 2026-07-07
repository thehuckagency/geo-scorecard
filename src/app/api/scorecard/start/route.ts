import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { CONFIG } from "@/lib/config";
import { normalizeDomain } from "@/lib/normalize";
import { saveJob } from "@/lib/store";
import type { Job, QuestionResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

interface StartBody {
  domain?: string;
  questions?: string[];
  email?: string;
  businessName?: string;
  name?: string;
  consent?: boolean;
}

export async function POST(req: Request) {
  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain || "");
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Please enter a valid website domain." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid work email." }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Consent is required to run the check." }, { status: 400 });
  }

  const questions = (body.questions || [])
    .map((q) => (q || "").trim())
    .filter((q) => q.length > 0)
    .slice(0, CONFIG.questions.full)
    .map((q) => q.slice(0, CONFIG.questions.maxLength));

  if (questions.length === 0) {
    return NextResponse.json({ error: "Please enter at least one question." }, { status: 400 });
  }

  const now = Date.now();
  const job: Job = {
    id: randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
    domain,
    questions: questions.map(
      (question): QuestionResult => ({
        question,
        status: "pending",
        engines: [],
        citedAny: false,
        bestPosition: null,
      }),
    ),
    geo: null,
    lead: {
      email,
      businessName: (body.businessName || "").trim(),
      name: (body.name || "").trim(),
      consent: true,
    },
    brandCheck: null,
    scorecard: null,
    costUsd: 0,
  };

  await saveJob(job);

  // Hand off to the background worker on its own invocation (maxDuration 300),
  // after the response is sent. The worker does the slow AI + GEO work.
  const workerUrl = new URL("/api/scorecard/worker", req.url).toString();
  after(async () => {
    try {
      await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
        body: JSON.stringify({ jobId: job.id }),
      });
    } catch (err) {
      console.error("[start] failed to trigger worker:", err);
    }
  });

  return NextResponse.json({ jobId: job.id });
}
