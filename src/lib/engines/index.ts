import "server-only";
import type { EngineId } from "../config";
import { CONFIG } from "../config";
import type { EngineResult } from "../types";
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
  return queryDataForSeo(question, domain);
}

/** Run every configured engine for one question. */
export async function runQuestion(
  question: string,
  domain: string,
): Promise<EngineResult[]> {
  return Promise.all(CONFIG.engines.map((e) => runEngine(e, question, domain)));
}
