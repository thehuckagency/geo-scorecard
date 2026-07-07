import { CONFIG, bandFor } from "./config";
import { classifyDomain } from "./classify";
import { generateRecommendations } from "./recommendations";
import type {
  CompetitorEntry,
  GeoReadiness,
  QuestionResult,
  Scorecard,
  VisibilitySplit,
} from "./types";

/** Lowest 1-based position the domain reached across engines, or null. */
export function bestPosition(q: QuestionResult): number | null {
  const positions = q.engines
    .filter((e) => e.cited && e.position != null)
    .map((e) => e.position as number);
  return positions.length ? Math.min(...positions) : null;
}

export function citedAny(q: QuestionResult): boolean {
  return q.engines.some((e) => e.cited);
}

/** Unique competitor domains cited for a single question (union across engines). */
function questionCompetitors(q: QuestionResult): string[] {
  const set = new Set<string>();
  for (const e of q.engines) for (const d of e.competitors) if (d) set.add(d);
  return [...set];
}

/**
 * Pure scoring. Takes the per-question engine results plus the on-page GEO
 * readiness and returns the full 0-100 scorecard. Never throws on empty input.
 */
export function computeScorecard(
  questions: QuestionResult[],
  geo: GeoReadiness | null,
): Scorecard {
  const w = CONFIG.weights;
  const answered = questions.filter((q) => q.status === "done" || q.status === "error");
  const n = answered.length;

  const cited = answered.filter((q) => citedAny(q));
  const citedCount = cited.length;

  // 1. Citation rate (linear).
  const citationRate = n > 0 ? (citedCount / n) * w.citationRate : 0;

  // 2. Position quality: reward earlier placement, averaged over cited questions.
  let positionQuality = 0;
  if (citedCount > 0) {
    const perQuestion = cited.map((q) => {
      const pos = bestPosition(q) ?? 10;
      return Math.max(0, 1 - (pos - 1) * 0.15); // pos1=1.0, pos2=0.85, ...
    });
    const avg = perQuestion.reduce((a, b) => a + b, 0) / perQuestion.length;
    positionQuality = avg * w.positionQuality;
  }

  // 3. Competitor gap: penalise questions the user lost to competitors.
  let competitorGap = w.competitorGap;
  if (n > 0) {
    const lost = answered.filter(
      (q) => !citedAny(q) && questionCompetitors(q).length > 0,
    ).length;
    const dominance = lost / n;
    competitorGap = w.competitorGap * (1 - dominance);
  }

  // 4. On-page GEO readiness (already 0..20).
  const geoReadiness = geo ? Math.max(0, Math.min(w.geoReadiness, geo.score)) : 0;

  const total = Math.round(
    Math.max(
      0,
      Math.min(100, citationRate + positionQuality + competitorGap + geoReadiness),
    ),
  );

  // Competitor leaderboard: how many questions each domain was cited in.
  const counts = new Map<string, number>();
  for (const q of answered) {
    for (const d of questionCompetitors(q)) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  const competitors: CompetitorEntry[] = [...counts.entries()]
    .map(([domain, count]) => ({ domain, count, kind: classifyDomain(domain) }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 10);

  // Where the user's visibility comes from: own site, via OTAs, or nowhere.
  let ownDomain = 0;
  let viaOta = 0;
  let invisible = 0;
  for (const q of answered) {
    if (citedAny(q)) {
      ownDomain++;
    } else if (questionCompetitors(q).some((d) => classifyDomain(d) === "ota")) {
      viaOta++;
    } else {
      invisible++;
    }
  }
  const visibility: VisibilitySplit = { ownDomain, viaOta, invisible };

  const recommendations = generateRecommendations({ geo, questions, competitors, visibility });

  const band = bandFor(total);

  return {
    citedCount,
    questionCount: n,
    breakdown: {
      citationRate: Math.round(citationRate * 10) / 10,
      positionQuality: Math.round(positionQuality * 10) / 10,
      competitorGap: Math.round(competitorGap * 10) / 10,
      geoReadiness: Math.round(geoReadiness * 10) / 10,
      total,
    },
    band: { label: band.label, min: band.min, max: band.max },
    competitors,
    visibility,
    recommendations,
  };
}
