import "server-only";
import type { EngineId } from "../config";
import { CONFIG } from "../config";
import type { BrandCheck, EngineResult } from "../types";
import { queryPerplexity } from "./perplexity";
import { queryDataForSeo } from "./dataforseo";
import { queryMock } from "./mock";

const forceMock = process.env.MOCK_MODE === "1";
const perplexityEnabled = () => Boolean(process.env.PERPLEXITY_API_KEY);
const dataForSeoEnabled = () =>
  Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);

/**
 * Mock mode: forced via MOCK_MODE=1, or automatic when NO engine credentials
 * are configured (so a fresh deploy / local preview still shows the full flow
 * with synthetic data rather than errors).
 */
export function isMockMode(): boolean {
  return forceMock || (!perplexityEnabled() && !dataForSeoEnabled());
}

async function runEngine(
  engine: EngineId,
  question: string,
  domain: string,
): Promise<EngineResult> {
  if (isMockMode()) return queryMock(question, domain, engine);
  if (engine === "perplexity") return queryPerplexity(question, domain);
  // Both DataForSEO layers share the same API + credentials, differing only by
  // platform: google (UK AI Overview) vs chat_gpt (US ChatGPT mentions).
  if (engine === "chatgpt") return queryDataForSeo(question, domain, "chatgpt", "chat_gpt");
  return queryDataForSeo(question, domain, "dataforseo", "google");
}

/** Run every configured engine for one question. */
export async function runQuestion(
  question: string,
  domain: string,
): Promise<EngineResult[]> {
  return Promise.all(CONFIG.engines.map((e) => runEngine(e, question, domain)));
}

/**
 * Ask AI directly about the business by name, to gauge whether AI knows the
 * brand at all and what it says. Uses Perplexity when available (genuine UK
 * query), else the DataForSEO Google layer, else mock.
 */
export async function runBrandCheck(businessName: string, domain: string): Promise<BrandCheck> {
  const question = `Tell me about ${businessName}, a hotel. What is it known for and where is it?`;
  const toCheck = (engine: EngineId, r: EngineResult): BrandCheck => ({
    businessName,
    engine,
    answer: r.sampleAnswer ?? null,
    ownDomainCited: r.cited,
    error: r.error,
  });

  if (isMockMode()) return toCheck("perplexity", await queryMock(question, domain, "perplexity"));
  if (perplexityEnabled()) return toCheck("perplexity", await queryPerplexity(question, domain));
  if (dataForSeoEnabled())
    return toCheck("dataforseo", await queryDataForSeo(question, domain, "dataforseo", "google"));
  return { businessName, engine: "perplexity", answer: null, ownDomainCited: false, error: "No engine configured." };
}
