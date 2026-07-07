import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import { CONFIG } from "./config";

export interface Page {
  url: string;
  root: HTMLElement;
}

/** True when a page has enough content to analyse (not a challenge/JS shell). */
function hasContent(root: HTMLElement): boolean {
  const title = (root.querySelector("title")?.textContent || "").trim();
  const text = (root.textContent || "").trim();
  return title.length > 0 || text.length > 300;
}

/** Plain server-to-server fetch. Fast and free, but blocked by some bot walls. */
async function directFetch(url: string): Promise<Page | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.geo.fetchTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": CONFIG.geo.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("html")) return null;
    return { url: res.url || url, root: parse(await res.text()) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Firecrawl scrape: residential proxies + JS render, gets past bot protection. */
async function firecrawlFetch(url: string, apiKey: string): Promise<Page | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      data?: { rawHtml?: string; metadata?: { sourceURL?: string } };
    };
    const html = data?.data?.rawHtml;
    if (!data?.success || !html) return null;
    return { url: data.data?.metadata?.sourceURL || url, root: parse(html) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crawl one URL. Tries a plain fetch first (fast, free); if that is blocked,
 * empty, or a JS/challenge shell, falls back to Firecrawl when FIRECRAWL_API_KEY
 * is set. Without the key it is direct-only (previous behaviour).
 */
export async function crawl(url: string): Promise<Page | null> {
  const direct = await directFetch(url);
  if (direct && hasContent(direct.root)) return direct;

  const key = process.env.FIRECRAWL_API_KEY;
  if (key) {
    const viaFirecrawl = await firecrawlFetch(url, key);
    if (viaFirecrawl) return viaFirecrawl;
  }
  return direct; // may be null, or a thin page if Firecrawl was unavailable
}

/** Whether Firecrawl fallback is configured. */
export const firecrawlEnabled = () => Boolean(process.env.FIRECRAWL_API_KEY);
