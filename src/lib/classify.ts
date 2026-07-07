import type { CompetitorKind } from "./types";
import { normalizeDomain } from "./normalize";

/**
 * Classify a cited domain so hoteliers can tell WHO is beating them:
 *   - "ota"   : booking engines / aggregators / metasearch (a direct-booking problem)
 *   - "info"  : encyclopedias, forums, video, press, tourism boards (context, not a rival)
 *   - "rival" : anything else, most likely another property or its site
 */

const OTA_DOMAINS = new Set([
  "booking.com",
  "expedia.co.uk",
  "expedia.com",
  "hotels.com",
  "trivago.co.uk",
  "trivago.com",
  "agoda.com",
  "lastminute.com",
  "laterooms.com",
  "kayak.co.uk",
  "kayak.com",
  "skyscanner.net",
  "travelrepublic.co.uk",
  "onthebeach.co.uk",
  "loveholidays.com",
  "secretescapes.com",
  "mrandmrssmith.com",
  "hoseasons.co.uk",
  "sykescottages.co.uk",
  "cottages.com",
  "airbnb.co.uk",
  "airbnb.com",
  "vrbo.com",
  "priceline.com",
  "hostelworld.com",
  "spabreaks.com",
  "redletterdays.co.uk",
  "greatlittlebreaks.com",
  "petspyjamas.com",
  "caninecottages.co.uk",
  "coolstays.com",
  "i-escape.com",
  "hotelscombined.com",
  "reservations.com",
]);

const OTA_KEYWORDS = ["booking", "hotels", "rooms", "breaks", "cottages", "holiday", "escapes"];

const INFO_DOMAINS = new Set([
  "en.wikipedia.org",
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
  "quora.com",
  "tripadvisor.co.uk",
  "tripadvisor.com",
  "timeout.com",
  "theguardian.com",
  "forbes.com",
  "cntraveller.com",
  "conde-nast-johansens.com",
  "nationaltrust.org.uk",
  "visitbritain.com",
  "visitengland.com",
  "google.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
]);

const INFO_SUFFIXES = [".gov.uk", ".gov", ".ac.uk", ".edu"];
const INFO_KEYWORDS = ["visit", "wiki", "guide", "blog", "magazine", "traveltips", "tourism"];

export function classifyDomain(input: string): CompetitorKind {
  const d = normalizeDomain(input);
  if (!d) return "rival";
  if (OTA_DOMAINS.has(d)) return "ota";
  if (INFO_DOMAINS.has(d)) return "info";
  if (INFO_SUFFIXES.some((s) => d.endsWith(s))) return "info";
  if (INFO_KEYWORDS.some((k) => d.includes(k))) return "info";
  if (OTA_KEYWORDS.some((k) => d.includes(k))) return "ota";
  return "rival";
}

export const KIND_LABEL: Record<CompetitorKind, string> = {
  ota: "OTA / aggregator",
  info: "Guide / info site",
  rival: "Rival property",
};
