import { NextResponse } from "next/server";
import { parse } from "node-html-parser";

export const runtime = "nodejs";
export const maxDuration = 180;
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
    ldBlocks: ld.length,
    ldTypes: types,
    mentionsHotel: /"@type"\s*:\s*"(Hotel|LodgingBusiness|LocalBusiness)"/.test(html),
  };
}

const ACCEPT = "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll";

export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { url } = await req.json().catch(() => ({ url: "" }));
  const key = process.env.FIRECRAWL_API_KEY;
  const out: Record<string, unknown> = { url, firecrawlKeySet: Boolean(key) };
  if (!key) return NextResponse.json(out);

  const variants: { label: string; body: Record<string, unknown> }[] = [
    { label: "geo_GB", body: { formats: ["rawHtml"], waitFor: 6000, location: { country: "GB" } } },
    {
      label: "consent_click",
      body: {
        formats: ["rawHtml"],
        location: { country: "GB" },
        actions: [
          { type: "wait", milliseconds: 2500 },
          { type: "click", selector: ACCEPT },
          { type: "wait", milliseconds: 5000 },
        ],
      },
    },
    {
      label: "consent_click_stealth",
      body: {
        formats: ["rawHtml"],
        proxy: "stealth",
        location: { country: "GB" },
        actions: [
          { type: "wait", milliseconds: 2500 },
          { type: "click", selector: ACCEPT },
          { type: "wait", milliseconds: 5000 },
        ],
      },
    },
  ];

  for (const v of variants) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...v.body }),
        cache: "no-store",
      });
      const j = await r.json();
      const html = j?.data?.rawHtml || "";
      out[v.label] = {
        httpStatus: r.status,
        success: j?.success,
        error: j?.error,
        ...(html ? analyse(html) : { noHtml: true }),
      };
    } catch (e) {
      out[v.label] = { error: String(e) };
    }
  }
  return NextResponse.json(out);
}
