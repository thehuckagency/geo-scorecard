/**
 * CONFIG — every non-secret tunable in one place. Safe to import on the client
 * (contains no API keys). Secrets (PERPLEXITY_API_KEY, DATAFORSEO_LOGIN/PASSWORD,
 * LEAD_WEBHOOK_URL, INTERNAL_SECRET, UPSTASH_*) are read directly from
 * process.env inside server-only modules and never surfaced here.
 */

export type EngineId = "perplexity" | "dataforseo";

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

export const CONFIG = {
  // ----- Scoring weights (sum = 100) -----
  weights: {
    citationRate: 50, // % of questions where the domain is cited (both engines)
    positionQuality: 15, // how early the domain appears in the source list
    competitorGap: 15, // penalised when others dominate and the user does not
    geoReadiness: 20, // on-page structural signals
  },

  // ----- Question limits -----
  questions: {
    free: 3, // tested before email capture is required
    full: 10, // tested after email capture
    maxLength: 160,
  },

  // ----- Which engines to run (order shown in UI) -----
  engines: ["perplexity", "dataforseo"] as EngineId[],
  engineLabels: {
    perplexity: "Perplexity",
    dataforseo: "Google AIO",
  } as Record<EngineId, string>,

  // ----- Concurrency + cost guards -----
  concurrency: 3, // parallel questions in the worker
  workerMaxDuration: 300, // seconds (Vercel Pro ceiling)

  // ----- On-page GEO readiness (Layer 2) -----
  geo: {
    // Homepage plus the first key page that resolves is analysed.
    keyPagePaths: ["/faq", "/faqs", "/rooms", "/about", "/contact"],
    fetchTimeoutMs: 8000,
    // A realistic browser UA so hotel sites behind basic bot filters still let
    // us read the public homepage for the readiness check.
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  },

  // ----- Engine endpoints (public URLs, keys applied server-side) -----
  perplexity: {
    endpoint: "https://api.perplexity.ai/chat/completions",
    model: "sonar",
  },
  dataforseo: {
    endpoint: "https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search/live",
    platform: "google",
    locationName: "United Kingdom",
    languageCode: "en",
  },

  // ----- Job lifecycle -----
  job: {
    ttlSeconds: 60 * 60, // keep results for an hour
    pollIntervalMs: 2000,
  },

  // ----- Score bands (descending) -----
  bands: [
    { min: 80, max: 100, label: "Highly visible in AI search" },
    { min: 60, max: 79, label: "Getting cited, room to grow" },
    { min: 40, max: 59, label: "Occasionally surfacing" },
    { min: 20, max: 39, label: "Mostly invisible" },
    { min: 0, max: 19, label: "Not showing up" },
  ] as ScoreBand[],

  // ----- Example placeholders for the guest questions -----
  placeholders: [
    "best boutique hotels in [town]",
    "where to stay near [landmark]",
    "dog friendly hotels in [region]",
    "hotels with parking in [town]",
    "romantic weekend breaks in [region]",
    "family rooms near [landmark]",
    "pet friendly places to stay in [town]",
    "best hotels for a spa break in [region]",
    "hotels with a good restaurant in [town]",
    "affordable luxury hotels near [landmark]",
  ],
} as const;

/** Client-safe public URLs (set via NEXT_PUBLIC_ so they can be read anywhere). */
export const PUBLIC = {
  bookingUrl:
    process.env.NEXT_PUBLIC_BOOKING_URL || "https://calendar.app.google/Eb6QbXhAZZchAwAd6",
  privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL || "https://www.huck.agency/privacy",
} as const;

/** Return the band label for a whole-number score. */
export function bandFor(score: number): ScoreBand {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return CONFIG.bands.find((b) => s >= b.min && s <= b.max) ?? CONFIG.bands[CONFIG.bands.length - 1];
}
