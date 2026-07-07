import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import { CONFIG } from "../config";
import type { GeoReadiness, GeoSignal } from "../types";

interface Fetched {
  url: string;
  root: HTMLElement;
}

async function fetchHtml(url: string): Promise<Fetched | null> {
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
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return null;
    const html = await res.text();
    return { url: res.url || url, root: parse(html) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Collect every JSON-LD @type on a page (handles @graph + arrays + nesting). */
function jsonLdTypes(root: HTMLElement): Set<string> {
  const types = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") types.add(t.toLowerCase());
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x.toLowerCase()));
    Object.values(obj).forEach(walk);
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(script.textContent));
    } catch {
      /* ignore malformed blocks */
    }
  }
  return types;
}

const BUSINESS_TYPES = [
  "hotel",
  "lodgingbusiness",
  "bedandbreakfast",
  "resort",
  "motel",
  "hostel",
  "campground",
  "localbusiness",
  "restaurant",
  "touristattraction",
];

const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;

function questionLikeCount(root: HTMLElement): number {
  const nodes = root.querySelectorAll("h2, h3, h4, summary, dt, [class*='faq'] *");
  let count = 0;
  const seen = new Set<string>();
  for (const el of nodes) {
    const text = (el.textContent || "").trim();
    if (text.length > 8 && text.length < 200 && text.includes("?") && !seen.has(text)) {
      seen.add(text);
      count++;
    }
  }
  return count;
}

/**
 * Analyse a domain's on-page GEO readiness. Fetches the homepage and the first
 * key page that resolves, then scores structural signals (a signal counts if
 * present on either page). Total is CONFIG.weights.geoReadiness (20).
 */
export async function analyzeGeo(domain: string): Promise<GeoReadiness> {
  const maxScore = CONFIG.weights.geoReadiness;
  const home =
    (await fetchHtml(`https://${domain}`)) ?? (await fetchHtml(`http://${domain}`));

  if (!home) {
    return {
      score: 0,
      maxScore,
      analysedUrl: `https://${domain}`,
      keyPageUrl: null,
      error: "We could not reach the site to analyse it.",
      signals: [],
    };
  }

  // First key page that resolves.
  let keyPage: Fetched | null = null;
  for (const path of CONFIG.geo.keyPagePaths) {
    keyPage = await fetchHtml(`https://${domain}${path}`);
    if (keyPage) break;
  }

  const pages = [home, keyPage].filter(Boolean) as Fetched[];
  const anyPage = (fn: (p: Fetched) => boolean) => pages.some(fn);

  const types = new Set<string>();
  pages.forEach((p) => jsonLdTypes(p.root).forEach((t) => types.add(t)));

  const hasBusinessSchema = BUSINESS_TYPES.some((t) => types.has(t));
  const hasFaqSchema = types.has("faqpage") || types.has("question");
  const faqContent = anyPage((p) => questionLikeCount(p.root) >= 2);

  const h1Count = home.root.querySelectorAll("h1").length;
  const h2Count = home.root.querySelectorAll("h2").length;
  const cleanHeadings = h1Count === 1 && h2Count >= 2;

  const title = (home.root.querySelector("title")?.textContent || "").trim();
  const metaDesc = (
    home.root.querySelector('meta[name="description"]')?.getAttribute("content") || ""
  ).trim();
  const entityClarity = title.length >= 10 && metaDesc.length >= 50;

  const hasTel = anyPage((p) => p.root.querySelectorAll('a[href^="tel:"]').length > 0);
  const hasPostcode = anyPage((p) => UK_POSTCODE.test(p.root.textContent || ""));
  const hasAddressSchema = types.has("postaladdress") || types.has("place");
  const extractableFacts = hasTel || hasPostcode || hasAddressSchema;

  const signals: GeoSignal[] = [
    {
      id: "business-schema",
      label: "Hotel / LocalBusiness schema",
      present: hasBusinessSchema,
      points: 5,
      detail: hasBusinessSchema
        ? "Structured business data helps AI identify and quote you."
        : "Add Hotel or LocalBusiness JSON-LD so AI can identify you.",
    },
    {
      id: "faq-schema",
      label: "FAQ schema markup",
      present: hasFaqSchema,
      points: 3,
      detail: hasFaqSchema
        ? "FAQPage markup gives AI ready-made question and answer pairs."
        : "Add FAQPage schema to your common guest questions.",
    },
    {
      id: "faq-content",
      label: "FAQ-style questions and answers",
      present: faqContent,
      points: 3,
      detail: faqContent
        ? "Question-led content matches how guests ask AI."
        : "Write answers to the exact questions guests ask.",
    },
    {
      id: "headings",
      label: "Clean heading hierarchy",
      present: cleanHeadings,
      points: 3,
      detail: cleanHeadings
        ? "One clear H1 with structured H2s is easy to parse."
        : "Use a single H1 and clear H2 sections.",
    },
    {
      id: "entity-clarity",
      label: "Clear title and description",
      present: entityClarity,
      points: 3,
      detail: entityClarity
        ? "A descriptive title and meta description state who you are."
        : "Write a specific title and meta description.",
    },
    {
      id: "extractable-facts",
      label: "Extractable facts (address, contact)",
      present: extractableFacts,
      points: 3,
      detail: extractableFacts
        ? "Address and contact details are easy for AI to lift."
        : "Publish your address, postcode and phone number as text.",
    },
  ];

  const score = signals.reduce((sum, s) => sum + (s.present ? s.points : 0), 0);

  return {
    score: Math.min(maxScore, score),
    maxScore,
    analysedUrl: home.url,
    keyPageUrl: keyPage?.url ?? null,
    signals,
  };
}
