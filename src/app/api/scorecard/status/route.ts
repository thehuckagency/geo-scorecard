import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { isMockMode } from "@/lib/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll target. Returns the job without lead PII. */
export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found or expired." }, { status: 404 });
  }

  const total = job.questions.length;
  const done = job.questions.filter((q) => q.status === "done" || q.status === "error").length;

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    domain: job.domain,
    mock: isMockMode(),
    progress: { done, total },
    geo: job.geo,
    questions: job.questions,
    scorecard: job.scorecard,
    costUsd: job.costUsd,
    error: job.error,
  });
}
