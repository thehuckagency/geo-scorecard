import type { EngineId } from "../config";
import type { EngineResult } from "../types";
import { resultFromDomains } from "./shared";

/**
 * Deterministic synthetic engine. Returns plausible, stable results for a given
 * (engine, question, domain) so the full flow can be demoed and tested without
 * spending on the live APIs. Enabled when the relevant keys are absent or when
 * MOCK_MODE=1. Never used when real credentials are present unless forced.
 */

const COMPETITOR_POOL = [
  "booking.com",
  "tripadvisor.co.uk",
  "expedia.co.uk",
  "sawdays.co.uk",
  "mrandmrssmith.com",
  "coolstays.com",
  "i-escape.com",
  "secretescapes.com",
  "laterooms.com",
  "hotels.com",
  "conde-nast-johansens.com",
  "timeout.com",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export async function queryMock(
  question: string,
  userDomain: string,
  engine: EngineId,
): Promise<EngineResult> {
  const rng = makeRng(hash(`${engine}|${question}|${userDomain}`));
  // Simulate the live task latency lightly so progress is visible.
  await new Promise((r) => setTimeout(r, 250 + Math.floor(rng() * 500)));

  const sourceCount = 4 + Math.floor(rng() * 4); // 4-7
  const citedProb = engine === "perplexity" ? 0.45 : 0.35;
  const cited = rng() < citedProb;

  // Shuffle the pool deterministically and take the top competitors.
  const pool = [...COMPETITOR_POOL].sort(() => rng() - 0.5).slice(0, sourceCount);
  const ordered = [...pool];
  if (cited) {
    const pos = Math.min(sourceCount - 1, Math.floor(rng() * 5));
    ordered.splice(pos, 0, userDomain);
  }

  return resultFromDomains(engine, ordered, userDomain, {
    aiSearchVolume: engine === "dataforseo" ? Math.round((100 + rng() * 3900) / 10) * 10 : null,
    costUsd: engine === "perplexity" ? 0.005 : 0.02,
  });
}
