import "server-only";
import type { HTMLElement } from "node-html-parser";

/**
 * Many hotels inject their schema through Google Tag Manager, so it is absent
 * from the served HTML and only appears in a full consumer browser. Rendering
 * crawlers often cannot reproduce that (bot detection, consent gating). But the
 * schema is defined inside the GTM container file, which is public and needs no
 * rendering, so we fetch the container(s) referenced on the page and read the
 * schema types straight out of them.
 */

const GTM_ID = /GTM-[A-Z0-9]+/g;
const TYPE = /"@type"\s*:\s*\[?\s*"([A-Za-z]+)"/g;

export async function tagManagerSchemaTypes(roots: HTMLElement[]): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const root of roots) {
    for (const m of root.toString().matchAll(GTM_ID)) ids.add(m[0]);
  }

  const types = new Set<string>();
  await Promise.all(
    [...ids].slice(0, 3).map(async (id) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${id}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        // Container JSON is backslash-escaped; unescape quotes before matching.
        const js = (await res.text()).replace(/\\"/g, '"');
        for (const m of js.matchAll(TYPE)) types.add(m[1].toLowerCase());
      } catch {
        /* ignore unreachable / slow containers */
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return types;
}
