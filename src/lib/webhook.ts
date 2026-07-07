import "server-only";
import { bestPosition, citedAny } from "./scoring";
import type { Job } from "./types";

/** Flat, CRM/Airtable-friendly payload posted to LEAD_WEBHOOK_URL. */
export function buildLeadPayload(job: Job) {
  const sc = job.scorecard;
  return {
    // Contact
    email: job.lead.email,
    businessName: job.lead.businessName,
    name: job.lead.name,
    consent: job.lead.consent,
    // Subject
    domain: job.domain,
    // Headline
    score: sc?.breakdown.total ?? null,
    band: sc?.band.label ?? null,
    questionsTested: sc?.questionCount ?? job.questions.length,
    questionsCited: sc?.citedCount ?? 0,
    // Score breakdown
    scoreCitationRate: sc?.breakdown.citationRate ?? null,
    scorePositionQuality: sc?.breakdown.positionQuality ?? null,
    scoreCompetitorGap: sc?.breakdown.competitorGap ?? null,
    scoreGeoReadiness: sc?.breakdown.geoReadiness ?? null,
    // GEO signals
    geoScore: job.geo?.score ?? null,
    geoSignalsPresent: (job.geo?.signals ?? []).filter((s) => s.present).map((s) => s.label),
    geoSignalsMissing: (job.geo?.signals ?? []).filter((s) => !s.present).map((s) => s.label),
    // Per-question detail
    questions: job.questions.map((q) => ({
      question: q.question,
      cited: citedAny(q),
      bestPosition: bestPosition(q),
      engines: q.engines.map((e) => ({
        engine: e.engine,
        cited: e.cited,
        position: e.position,
        competitors: e.competitors,
      })),
    })),
    // Competitors AI recommends instead
    topCompetitors: (sc?.competitors ?? []).map((c) => `${c.domain} (${c.count})`),
    // Meta
    apiCostUsd: Math.round((job.costUsd ?? 0) * 10000) / 10000,
    source: "ai-search-visibility-scorecard",
    submittedAt: new Date().toISOString(),
  };
}

/** POST the completed scorecard to the lead webhook. No-op if unset. */
export async function postLead(job: Job): Promise<boolean> {
  const url = process.env.LEAD_WEBHOOK_URL;
  const payload = buildLeadPayload(job);
  if (!url) {
    console.info("[lead] no LEAD_WEBHOOK_URL set — payload:", JSON.stringify(payload));
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return true;
  } catch (err) {
    console.error("[lead] webhook post failed:", err);
    return false;
  }
}
