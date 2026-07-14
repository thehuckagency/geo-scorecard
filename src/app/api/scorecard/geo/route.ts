import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { computeGeo, crawlSite } from "@/lib/geo/analyze";
import { suggestFromPages } from "@/lib/geo/suggest";
import { normalizeDomain } from "@/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 60; // Firecrawl fallback can add a few seconds
export const dynamic = "force-dynamic";

/** Synchronous, free Layer 2: on-page GEO readiness + tailored question suggestions. */
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

  // Crawl once (homepage + key pages), then derive the GEO score and the
  // tailored questions from the same pages.
  const site = await crawlSite(domain);
  if (!site) {
    return NextResponse.json({
      domain,
      geo: {
        score: 0,
        maxScore: CONFIG.weights.geoReadiness,
        analysedUrl: `https://${domain}`,
        keyPageUrl: null,
        error: "We could not reach the site to analyse it.",
        signals: [],
      },
      suggestedQuestions: [],
    });
  }

  const geo = computeGeo(site.home, site.pages, site.tagManagerTypes);
  const suggestedQuestions = suggestFromPages(site.pages);
  return NextResponse.json({ domain, geo, suggestedQuestions });
}
