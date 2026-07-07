/**
 * Domain + URL normalisation. Everything is compared at the registrable-ish
 * domain level: lowercase, strip scheme / www / path / port.
 */

/** Normalise a user-entered website into a bare domain (max 63 chars kept). */
export function normalizeDomain(input: string): string {
  let s = (input || "").trim().toLowerCase();
  if (!s) return "";
  // Strip scheme.
  s = s.replace(/^[a-z]+:\/\//, "");
  // Strip everything from the first slash, query or hash.
  s = s.split(/[/?#]/)[0];
  // Strip credentials + port.
  s = s.split("@").pop() || s;
  s = s.split(":")[0];
  // Strip leading www.
  s = s.replace(/^www\./, "");
  return s.slice(0, 63);
}

/** Extract a bare domain from any URL string, or "" if it cannot be parsed. */
export function domainFromUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizeDomain(url);
  }
}

/**
 * True when `candidate` is the same registrable site as `target`.
 * Matches exact host or any subdomain of the target (e.g. rooms.hotel.co.uk
 * matches hotel.co.uk).
 */
export function domainsMatch(candidate: string, target: string): boolean {
  const c = normalizeDomain(candidate);
  const t = normalizeDomain(target);
  if (!c || !t) return false;
  return c === t || c.endsWith(`.${t}`) || t.endsWith(`.${c}`);
}
