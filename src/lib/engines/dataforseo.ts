import "server-only";
import { CONFIG, type EngineId } from "../config";
import type { EngineResult } from "../types";
import { domainFromUrl, domainsMatch } from "../normalize";
import { errorResult, fetchWithTimeout } from "./shared";

interface DfsSource {
  domain?: string;
  url?: string;
  position?: number;
}
interface DfsItem {
  sources?: DfsSource[];
  ai_search_volume?: number;
  answer?: string;
  fan_out_queries?: unknown;
}

/** DataForSEO's fan_out_queries can be strings or objects; coerce to strings. */
function toQueries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const q of raw) {
    if (typeof q === "string") out.push(q);
    else if (q && typeof q === "object") {
      const o = q as Record<string, unknown>;
      const v = o.query ?? o.keyword ?? o.title;
      if (typeof v === "string") out.push(v);
    }
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Query DataForSEO LLM Mentions for one question. Serves two layers from the
 * same API + credentials:
 *   - platform "google"  -> Google AI Overview (UK-targeted), engine "dataforseo"
 *   - platform "chat_gpt" -> ChatGPT mentions (US/English only), engine "chatgpt"
 *
 * We query by KEYWORD ONLY (not keyword + domain). The API returns many recorded
 * AI responses for the keyword, each with its cited sources; we aggregate across
 * that sample to (a) detect whether the user's domain is cited and (b) rank the
 * domains AI cites most often (competitors). Querying with a domain target as
 * well would AND the two, returning nothing whenever the user is NOT cited, which
 * is exactly the case that matters and also loses all competitor data.
 * Docs: https://docs.dataforseo.com (ai_optimization/llm_mentions/search/live)
 */
export async function queryDataForSeo(
  question: string,
  userDomain: string,
  engine: EngineId = "dataforseo",
  platform: string = CONFIG.dataforseo.platform,
): Promise<EngineResult> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    return errorResult(engine, "DataForSEO credentials not configured.");
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  // Keyword-only target. chat_gpt is US/English only, so only send a UK location
  // for the google platform.
  const taskPayload: Record<string, unknown> = {
    platform,
    language_code: CONFIG.dataforseo.languageCode,
    limit: CONFIG.dataforseo.sampleLimit,
    target: [{ keyword: question, search_scope: ["answer"] }],
  };
  if (platform === "google") taskPayload.location_name = CONFIG.dataforseo.locationName;

  try {
    const res = await fetchWithTimeout(
      CONFIG.dataforseo.endpoint,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify([taskPayload]),
      },
      130_000,
    );
    if (!res.ok) return errorResult(engine, `DataForSEO responded ${res.status}`);

    const data = (await res.json()) as {
      tasks?: { cost?: number; result?: { items?: DfsItem[] }[] }[];
    };
    const task = data.tasks?.[0];
    const items = task?.result?.flatMap((r) => r.items ?? []) ?? [];

    // Aggregate across the sampled responses.
    const competitorFreq = new Map<string, number>();
    let userCited = false;
    let bestPosition: number | null = null;
    let aiSearchVolume: number | null = null;
    let sampleAnswer: string | undefined;
    let relatedQuestions: string[] = [];
    let responsesWithUser = 0;

    for (const item of items) {
      if (item.ai_search_volume != null && aiSearchVolume == null) {
        aiSearchVolume = item.ai_search_volume;
      }
      if (!sampleAnswer && item.answer && item.answer.trim().length > 40) {
        sampleAnswer = item.answer.trim().slice(0, 320);
      }
      if (relatedQuestions.length === 0) relatedQuestions = toQueries(item.fan_out_queries);

      let userInThisResponse = false;
      (item.sources ?? []).forEach((s, idx) => {
        const d = s.domain
          ? s.domain.replace(/^www\./, "").toLowerCase()
          : domainFromUrl(s.url || "");
        if (!d) return;
        if (domainsMatch(d, userDomain)) {
          userCited = true;
          userInThisResponse = true;
          const pos = typeof s.position === "number" ? s.position : idx + 1;
          if (bestPosition == null || pos < bestPosition) bestPosition = pos;
        } else {
          competitorFreq.set(d, (competitorFreq.get(d) ?? 0) + 1);
        }
      });
      if (userInThisResponse) responsesWithUser++;
    }

    // Competitors ordered by how often AI cited them (most first).
    const competitors = [...competitorFreq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([d]) => d);

    return {
      engine,
      cited: userCited,
      position: bestPosition,
      sourceCount: competitorFreq.size + (userCited ? 1 : 0),
      competitors,
      aiSearchVolume,
      citedShare: items.length ? responsesWithUser / items.length : 0,
      responsesSampled: items.length,
      sampleAnswer,
      relatedQuestions,
      costUsd: task?.cost ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "DataForSEO request failed";
    return errorResult(engine, message);
  }
}
