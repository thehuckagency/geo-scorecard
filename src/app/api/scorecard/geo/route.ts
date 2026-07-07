import { NextResponse } from "next/server";
import { analyzeGeo } from "@/lib/geo/analyze";
import { suggestQuestions } from "@/lib/geo/suggest";
import { normalizeDomain } from "@/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Synchronous, free Layer 2: on-page GEO readiness for a domain. */
export async function POST(req: Request) {
  let body: { domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain || "");
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Please enter a valid website domain." }, { status: 400 });
  }

  // GEO score and tailored question suggestions in parallel (both crawl the
  // homepage; running them together keeps the free step fast).
  const [geo, suggestedQuestions] = await Promise.all([
    analyzeGeo(domain),
    suggestQuestions(domain),
  ]);
  return NextResponse.json({ domain, geo, suggestedQuestions });
}
