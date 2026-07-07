import "server-only";
import { CONFIG } from "../config";
import type { EngineResult } from "../types";
import { domainFromUrl } from "../normalize";
import { errorResult, fetchWithTimeout, resultFromDomains } from "./shared";

interface SonarResponse {
  citations?: string[];
  search_results?: { title?: string; url?: string }[];
  choices?: { message?: { content?: string } }[];
  usage?: { cost?: { total_cost?: number } };
}

/**
 * Query Perplexity Sonar for one guest question, UK-targeted, and check whether
 * the user's domain appears in the cited sources.
 * Docs: https://docs.perplexity.ai (chat completions, citations, user_location)
 */
export async function queryPerplexity(
  question: string,
  userDomain: string,
): Promise<EngineResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return errorResult("perplexity", "Perplexity API key not configured.");

  try {
    const res = await fetchWithTimeout(
      CONFIG.perplexity.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CONFIG.perplexity.model,
          messages: [{ role: "user", content: question }],
          search_language_filter: ["en"],
          user_location: { country: "GB" },
        }),
      },
      60_000,
    );

    if (!res.ok) {
      return errorResult("perplexity", `Perplexity responded ${res.status}`);
    }
    const data = (await res.json()) as SonarResponse;

    // Ordered sources: search_results first (ranked), then any extra citations.
    const ordered: string[] = [];
    for (const r of data.search_results ?? []) {
      if (r.url) ordered.push(domainFromUrl(r.url));
    }
    for (const c of data.citations ?? []) {
      ordered.push(domainFromUrl(c));
    }

    const answer = data.choices?.[0]?.message?.content?.trim();
    const result = resultFromDomains("perplexity", ordered, userDomain, {
      costUsd: data.usage?.cost?.total_cost ?? undefined,
      responsesSampled: 1,
      sampleAnswer: answer ? answer.slice(0, 320) : undefined,
    });
    result.citedShare = result.cited ? 1 : 0;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Perplexity request failed";
    return errorResult("perplexity", message);
  }
}
