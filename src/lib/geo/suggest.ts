import type { HTMLElement } from "node-html-parser";
import type { Page } from "../crawl";

/**
 * Derive three tailored guest questions from already-crawled pages of the
 * hotel's site, so the intake form is pre-filled with location- and style-
 * specific phrasing instead of generic placeholders. Pulls town/region from
 * JSON-LD address (with a title/meta "in {place}" fallback) plus style and
 * audience signals. Returns [] when no location is found (keep placeholders).
 *
 * Pages are supplied by the shared crawler, which uses Firecrawl as a fallback
 * when a site blocks a plain fetch.
 */

interface Profile {
  town?: string;
  region?: string;
}

/** Town / region from JSON-LD PostalAddress across the crawled pages. */
function extractSchemaProfile(roots: HTMLElement[]): Profile {
  const profile: Profile = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const o = node as Record<string, unknown>;
    if (!profile.town && typeof o.addressLocality === "string" && o.addressLocality.trim()) {
      profile.town = o.addressLocality.trim();
    }
    if (!profile.region && typeof o.addressRegion === "string" && o.addressRegion.trim()) {
      profile.region = o.addressRegion.trim();
    }
    Object.values(o).forEach(walk);
  };
  for (const root of roots) {
    for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(s.textContent));
      } catch {
        /* ignore malformed */
      }
    }
  }
  return profile;
}

// Words that follow "in ..." but are not places.
const NON_PLACE = new Set([
  "the", "style", "comfort", "luxury", "heart", "centre", "center", "countryside",
  "middle", "season", "world", "town", "city", "our", "your", "a", "an", "one",
  "time", "touch", "need", "which", "advance", "person",
]);

/** Fallback: pull a place name from a "... in {Place}" phrase in title/meta/H1. */
function extractPhraseProfile(home: HTMLElement): Profile {
  const raw = [
    home.querySelector("title")?.textContent,
    home.querySelector('meta[name="description"]')?.getAttribute("content"),
    home.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    home.querySelector("h1")?.textContent,
  ]
    .filter(Boolean)
    .join(" . ");
  const m = raw.match(/\bin\s+(?:the\s+)?([A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,2})/);
  if (!m) return {};
  const place = m[1].trim();
  if (NON_PLACE.has(place.split(/[ -]/)[0].toLowerCase())) return {};
  return { region: place };
}

/** Corpus for style / audience signals (headings, meta, and a slice of body). */
function corpus(roots: HTMLElement[]): string {
  const home = roots[0];
  const bits = [
    home.querySelector("title")?.textContent,
    home.querySelector('meta[name="description"]')?.getAttribute("content"),
    ...home.querySelectorAll("h1, h2, h3").map((h) => h.textContent),
    (home.textContent || "").slice(0, 6000),
  ];
  return bits.filter(Boolean).join(" ").toLowerCase();
}

export function suggestFromPages(pages: Page[]): string[] {
  if (pages.length === 0) return [];
  const roots = pages.map((p) => p.root);

  const schema = extractSchemaProfile(roots);
  const phrase = schema.town || schema.region ? {} : extractPhraseProfile(roots[0]);
  const town = schema.town;
  const region = schema.region || phrase.region;
  const place = town || region;
  if (!place) return []; // cannot tailor without a location
  const wider = region || town!;

  const text = corpus(roots);
  const style = /boutique/.test(text)
    ? "boutique "
    : /luxur|5[- ]star|five[- ]star/.test(text)
      ? "luxury "
      : /country house|manor|estate/.test(text)
        ? "country house "
        : "";
  const pet = /\bdogs?\b|pet[- ]friendly|dogs welcome/.test(text);
  const spa = /\bspa\b/.test(text);
  const family = /family|families|children|\bkids\b/.test(text);
  const romantic = /romantic|couples/.test(text);
  const parking = /parking/.test(text);

  const candidates: string[] = [`best ${style}hotels in ${place}`];
  if (pet) candidates.push(`dog friendly hotels in ${wider}`);
  if (spa) candidates.push(`best hotels for a spa break in ${wider}`);
  if (family) candidates.push(`family hotels in ${place}`);
  if (romantic) candidates.push(`romantic hotels in ${wider}`);
  candidates.push(`where to stay in ${place}`);
  if (parking) candidates.push(`hotels with parking in ${place}`);
  candidates.push(`best places to stay in ${wider}`);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
    if (out.length === 3) break;
  }
  return out;
}
