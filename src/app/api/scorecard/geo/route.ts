import { NextResponse } from "next/server";
import { analyzeGeo } from "@/lib/geo/analyze";
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

  const geo = await analyzeGeo(domain);
  return NextResponse.json({ domain, geo });
}
