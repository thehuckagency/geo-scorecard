import { NextResponse } from "next/server";
import { parse } from "node-html-parser";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

function analyse(html: string) {
  const root = parse(html);
  const ld = root.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  ld.forEach((s) => {
    try {
      const walk = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        const o = n as Record<string, unknown>;
        if (typeof o["@type"] === "string") types.push(o["@type"] as string);
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(s.textContent));
    } catch {
      /* ignore */
    }
  });
  return {
    length: html.length,
    ldBlocks: ld.length,
    ldTypes: types,
    itemtypes: root.querySelectorAll("[itemtype]").length,
    mentionsSchemaOrg: html.includes("schema.org"),
    mentionsHotel: /"@type"\s*:\s*"Hotel"/.test(html),
  };
}

/** TEMPORARY: compare direct vs Firecrawl output for a URL. Remove after use. */
export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { url } = await req.json().catch(() => ({ url: "" }));
  const out: Record<string, unknown> = { url };

  try {
    const d = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    out.direct = { status: d.status, ...analyse(await d.text()) };
  } catch (e) {
    out.direct = { error: String(e) };
  }

  const key = process.env.FIRECRAWL_API_KEY;
  out.firecrawlKeySet = Boolean(key);
  if (key) {
    for (const opts of [
      { formats: ["rawHtml"] },
      { formats: ["rawHtml"], waitFor: 3500 },
      { formats: ["html"], waitFor: 3500 },
    ]) {
      try {
        const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, ...opts }),
          cache: "no-store",
        });
        const j = await r.json();
        const html = j?.data?.rawHtml || j?.data?.html || "";
        out[`firecrawl_${opts.formats[0]}${(opts as { waitFor?: number }).waitFor ? "_wait" : ""}`] = {
          httpStatus: r.status,
          success: j?.success,
          ...(html ? analyse(html) : { noHtml: true, keys: Object.keys(j?.data || {}) }),
        };
      } catch (e) {
        out[`firecrawl_${opts.formats[0]}`] = { error: String(e) };
      }
    }
  }

  return NextResponse.json(out);
}
