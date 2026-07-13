import "server-only";
import { type HTMLElement } from "node-html-parser";
import { CONFIG } from "../config";
import { crawl, hasStructuredData, type Page } from "../crawl";
import type { GeoReadiness, GeoSignal } from "../types";

/**
 * Collect every schema type on a page: JSON-LD @type (handles @graph + arrays +
 * nesting) and microdata itemtype (e.g. schema.org/Hotel).
 */
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
  // Microdata: itemtype="https://schema.org/Hotel" -> "hotel".
  for (const el of root.querySelectorAll("[itemtype]")) {
    const seg = (el.getAttribute("itemtype") || "").split("/").pop()?.trim().toLowerCase();
    if (seg) types.add(seg);
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
 * Crawl the homepage plus up to two key pages (contact/about for address,
 * faq/rooms for GEO signals) via the shared crawler (Firecrawl fallback). The
 * crawled pages are reused for both the GEO score and the question suggestions.
 */
export async function crawlSite(domain: string): Promise<{ home: Page; pages: Page[] } | null> {
  // If the homepage has no structured data in its raw HTML, render it via
  // Firecrawl before concluding there is none (many sites inject schema by JS).
  const renderIfNoSchema = { retryRenderIf: (r: HTMLElement) => !hasStructuredData(r) };
  const home =
    (await crawl(`https://${domain}`, renderIfNoSchema)) ??
    (await crawl(`http://${domain}`, renderIfNoSchema));
  if (!home) return null;

  const extras: Page[] = [];
  for (const group of [
    ["/contact", "/contact-us", "/about"],
    ["/faq", "/faqs", "/rooms"],
  ]) {
    for (const path of group) {
      const p = await crawl(`https://${domain}${path}`);
      if (p) {
        extras.push(p);
        break;
      }
    }
  }
  return { home, pages: [home, ...extras] };
}

/**
 * Score on-page GEO readiness from already-crawled pages. A signal counts if
 * present on any page. Total is CONFIG.weights.geoReadiness (20).
 */
export function computeGeo(home: Page, pages: Page[]): GeoReadiness {
  const maxScore = CONFIG.weights.geoReadiness;
  const anyPage = (fn: (p: Page) => boolean) => pages.some(fn);

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

  const hasReviewSchema = types.has("aggregaterating") || types.has("review") || types.has("rating");

  const hasImageSchema = types.has("imageobject");
  const hasOgImage = anyPage(
    (p) => !!p.root.querySelector('meta[property="og:image"]')?.getAttribute("content"),
  );
  const hasAltImages = anyPage(
    (p) => p.root.querySelectorAll("img[alt]").filter((el) => (el.getAttribute("alt") || "").trim().length > 3).length >= 3,
  );
  const hasImages = hasImageSchema || hasOgImage || hasAltImages;

  const signals: GeoSignal[] = [
    {
      id: "business-schema",
      label: "Hotel / LocalBusiness schema",
      present: hasBusinessSchema,
      points: 4,
      detail: hasBusinessSchema
        ? "Structured business data helps AI identify and quote you."
        : "No Hotel or LocalBusiness schema in your crawlable HTML. If yours is added by JavaScript, add it to the page source too, as most AI crawlers do not run JavaScript.",
    },
    {
      id: "faq-schema",
      label: "FAQ schema markup",
      present: hasFaqSchema,
      points: 2,
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
      points: 2,
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
      points: 2,
      detail: extractableFacts
        ? "Address and contact details are easy for AI to lift."
        : "Publish your address, postcode and phone number as text.",
    },
    {
      id: "reviews",
      label: "Review and rating markup",
      present: hasReviewSchema,
      points: 2,
      detail: hasReviewSchema
        ? "Machine-readable ratings are a strong signal AI trusts."
        : "Add aggregateRating and Review schema so AI can see your rating.",
    },
    {
      id: "images",
      label: "Described images",
      present: hasImages,
      points: 2,
      detail: hasImages
        ? "Captioned, described imagery adds extractable detail."
        : "Add descriptive alt text and an og:image to your key pages.",
    },
  ];

  const score = signals.reduce((sum, s) => sum + (s.present ? s.points : 0), 0);

  return {
    score: Math.min(maxScore, score),
    maxScore,
    analysedUrl: home.url,
    keyPageUrl: pages.find((p) => p.url !== home.url)?.url ?? null,
    signals,
  };
}

/** Crawl a domain and score its GEO readiness (used by the worker). */
export async function analyzeGeo(domain: string): Promise<GeoReadiness> {
  const site = await crawlSite(domain);
  if (!site) {
    return {
      score: 0,
      maxScore: CONFIG.weights.geoReadiness,
      analysedUrl: `https://${domain}`,
      keyPageUrl: null,
      error: "We could not reach the site to analyse it.",
      signals: [],
    };
  }
  return computeGeo(site.home, site.pages);
}
