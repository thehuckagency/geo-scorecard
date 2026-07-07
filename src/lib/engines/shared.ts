import type { EngineId } from "../config";
import type { EngineResult } from "../types";
import { domainsMatch } from "../normalize";

/**
 * Build an EngineResult from an ordered list of cited source domains.
 * Deduplicates by domain (keeping first appearance), finds the user's first
 * position, and collects the rest as competitors.
 */
export function resultFromDomains(
  engine: EngineId,
  orderedDomains: string[],
  userDomain: string,
  extra: Partial<EngineResult> = {},
): EngineResult {
  const unique: string[] = [];
  for (const d of orderedDomains) {
    if (d && !unique.includes(d)) unique.push(d);
  }
  let position: number | null = null;
  const competitors: string[] = [];
  unique.forEach((d, i) => {
    if (domainsMatch(d, userDomain)) {
      if (position === null) position = i + 1;
    } else {
      competitors.push(d);
    }
  });
  return {
    engine,
    cited: position !== null,
    position,
    sourceCount: unique.length,
    competitors,
    ...extra,
  };
}

export function errorResult(engine: EngineId, message: string): EngineResult {
  return {
    engine,
    cited: false,
    position: null,
    sourceCount: 0,
    competitors: [],
    error: message,
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
