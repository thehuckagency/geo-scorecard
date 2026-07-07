import type { CompetitorKind } from "./types";
import { normalizeDomain } from "./normalize";

/**
 * Classify a cited domain so hoteliers can tell WHO is beating them:
 *   - "ota"   : booking engines / aggregators / metasearch (a direct-booking problem)
 *   - "info"  : encyclopedias, forums, video, press, tourism boards, orgs, gov
 *   - "rival" : another property (its own site)
 *   - "other" : anything we cannot confidently place
 *
 * Matching is on the registrable domain (the label before the public suffix),
 * so country variants (tripadvisor.ca / .com / .co.uk) resolve the same way, and
 * "hotel"-style names count as rivals rather than being mistaken for OTAs.
 */

// Two-label public suffixes we need to see past to find the real name.
const COMPOUND_SUFFIXES = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "net.uk", "sch.uk", "nhs.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "co.nz", "org.nz", "co.za", "com.sg", "gov.scot", "gov.wales",
]);

// Suffixes that signal an organisation / government / academic site (=> info).
const INFO_SUFFIXES = new Set([
  "org", "org.uk", "gov", "gov.uk", "ac.uk", "edu", "nhs.uk", "gov.scot", "gov.wales", "int",
]);

// Known intermediaries (matched by registrable name, any TLD).
const OTA_NAMES = new Set([
  "booking", "expedia", "hotels", "trivago", "agoda", "lastminute", "laterooms", "kayak",
  "skyscanner", "travelrepublic", "onthebeach", "loveholidays", "secretescapes", "mrandmrssmith",
  "hoseasons", "sykescottages", "cottages", "airbnb", "vrbo", "priceline", "hostelworld",
  "hotelscombined", "reservations", "snaptrip", "canopyandstars", "sawdays", "i-escape",
  "coolstays", "redletterdays", "greatlittlebreaks", "petspyjamas", "caninecottages", "momondo",
  "hotwire", "orbitz", "travelsupermarket", "hotelplanner", "wotif", "ebookers", "getaroom",
  "spabreaks", "buyagift", "virginexperiencedays", "groupon",
]);

// Known info / guide / press / social / search / tourism domains (by name).
const INFO_NAMES = new Set([
  "wikipedia", "wikivoyage", "reddit", "youtube", "quora", "tripadvisor", "yelp", "timeout",
  "theguardian", "guardian", "telegraph", "independent", "forbes", "cntraveller", "cntraveler",
  "condenast", "lonelyplanet", "roughguides", "tripsavvy", "culturetrip", "facebook", "instagram",
  "tiktok", "twitter", "pinterest", "google", "bing", "visitbritain", "visitengland",
  "visitscotland", "visitwales", "nationaltrust", "englishheritage", "bbc", "thetimes",
]);

// Substrings that mark an info/guide/org site.
const INFO_TOKENS = [
  "visit", "wiki", "guide", "magazine", "tourism", "council", "museum", "trust", "gallery",
  "society", "association", "heritage", "gazette", "news", "review",
];

// Substrings that mark an actual property (=> rival).
const HOTEL_TOKENS = [
  "hotel", "inn", "lodge", "resort", "manor", "guesthouse", "bandb", "bnb", "arms", "priory",
  "grange", "hallhotel",
];

interface Parts {
  domain: string;
  name: string; // registrable label
  suffix: string; // public suffix (1 or 2 labels)
}

function parseDomain(input: string): Parts {
  const domain = normalizeDomain(input);
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return { domain, name: domain, suffix: "" };
  const last2 = labels.slice(-2).join(".");
  const suffixLen = COMPOUND_SUFFIXES.has(last2) ? 2 : 1;
  const suffix = labels.slice(labels.length - suffixLen).join(".");
  const name = labels[labels.length - suffixLen - 1] ?? labels[0];
  return { domain, name, suffix };
}

export function classifyDomain(input: string): CompetitorKind {
  const { name, suffix } = parseDomain(input);
  if (!name) return "other";

  if (OTA_NAMES.has(name)) return "ota";
  if (INFO_NAMES.has(name)) return "info";
  if (INFO_SUFFIXES.has(suffix)) return "info";
  if (INFO_TOKENS.some((t) => name.includes(t))) return "info";
  if (HOTEL_TOKENS.some((t) => name.includes(t))) return "rival";
  return "other";
}

export const KIND_LABEL: Record<CompetitorKind, string> = {
  ota: "OTA / aggregator",
  info: "Guide / info site",
  rival: "Rival property",
  other: "Other site",
};
