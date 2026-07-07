import "server-only";
import { CONFIG, type EngineId } from "../config";
import type { EngineResult } from "../types";
import { domainFromUrl } from "../normalize";
import { errorResult, fetchWithTimeout, resultFromDomains } from "./shared";

/**
 * Query DataForSEO LLM Mentions for one question. Serves two layers from the
 * same API + credentials:
 *   - platform "google"  -> Google AI Overview (UK-targeted), engine "dataforseo"
 *   - platform "chat_gpt" -> ChatGPT mentions (US/English only), engine "chatgpt"
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

  // The chat_gpt platform is US/English only; only send a UK location for google.
  const taskPayload: Record<string, unknown> = {
    platform,
    language_code: CONFIG.dataforseo.languageCode,
    target: [
      { keyword: question, search_scope: ["answer"] },
      { domain: userDomain, search_scope: ["sources"] },
    ],
  };
  if (platform === "google") taskPayload.location_name = CONFIG.dataforseo.locationName;

  try {
    const res = await fetchWithTimeout(
      CONFIG.dataforseo.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([taskPayload]),
      },
      130_000,
    );

    if (!res.ok) {
      return errorResult(engine, `DataForSEO responded ${res.status}`);
    }
    const data = (await res.json()) as {
      tasks?: {
        cost?: number;
        status_message?: string;
        result?: {
          items?: {
            sources?: { domain?: string; url?: string }[];
            ai_search_volume?: number;
          }[];
        }[];
      }[];
    };

    const task = data.tasks?.[0];
    const items = task?.result?.flatMap((r) => r.items ?? []) ?? [];

    const ordered: string[] = [];
    let aiSearchVolume: number | null = null;
    for (const item of items) {
      if (item.ai_search_volume != null && aiSearchVolume == null) {
        aiSearchVolume = item.ai_search_volume;
      }
      for (const s of item.sources ?? []) {
        const d = s.domain ? s.domain.replace(/^www\./, "").toLowerCase() : domainFromUrl(s.url || "");
        if (d) ordered.push(d);
      }
    }

    return resultFromDomains(engine, ordered, userDomain, {
      aiSearchVolume,
      costUsd: task?.cost ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DataForSEO request failed";
    return errorResult(engine, message);
  }
}
