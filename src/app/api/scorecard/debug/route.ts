import { NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

/**
 * TEMPORARY diagnostic: returns the raw DataForSEO LLM Mentions response so we
 * can confirm the response schema and parsing. Secret-gated. Remove after use.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const keyword = body.keyword || "best hotels in edinburgh";
  const domain = body.domain || "booking.com";
  const platform = body.platform || "google";
  const keywordOnly = body.keywordOnly === true;
  const matchType = body.matchType; // e.g. "partial_match"
  const scope = body.scope; // e.g. ["any"] or ["answer"]

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    return NextResponse.json({ error: "No DataForSEO creds set." }, { status: 400 });
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  const target: Record<string, unknown>[] = [
    { keyword, search_scope: scope || ["answer"] },
  ];
  if (!keywordOnly) target.push({ domain, search_scope: ["sources"] });

  const task: Record<string, unknown> = {
    platform,
    language_code: CONFIG.dataforseo.languageCode,
    target,
  };
  if (matchType) task.match_type = matchType;
  if (platform === "google") task.location_name = CONFIG.dataforseo.locationName;

  const res = await fetch(CONFIG.dataforseo.endpoint, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    cache: "no-store",
  });
  const raw = await res.json();

  const t = raw?.tasks?.[0];
  const items = t?.result?.[0]?.items ?? [];
  return NextResponse.json({
    httpStatus: res.status,
    taskStatusCode: t?.status_code,
    taskStatusMessage: t?.status_message,
    taskCost: t?.cost,
    resultCount: t?.result?.length ?? 0,
    itemCount: items.length,
    firstItemKeys: items[0] ? Object.keys(items[0]) : [],
    firstItemSources: items[0]?.sources?.slice(0, 5) ?? [],
    // Truncated raw for shape inspection.
    rawSample: JSON.stringify(raw).slice(0, 1500),
  });
}
