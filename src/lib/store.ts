import "server-only";
import { CONFIG } from "./config";
import type { Job } from "./types";

/**
 * Job store abstraction.
 *
 * Production: Upstash Redis over its REST API (set UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN, or the KV_REST_API_URL / KV_REST_API_TOKEN pair that
 * Vercel KV injects). This is REQUIRED on Vercel because the worker invocation
 * and the status-poll invocation are separate processes that must share state.
 *
 * Local dev only: if no Redis is configured we fall back to an in-memory Map.
 * That works within a single `next dev` process but NOT across serverless
 * instances, so never rely on it in production.
 */

const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const usingRedis = Boolean(REST_URL && REST_TOKEN);

// The in-memory fallback must live on globalThis: Next.js can evaluate a module
// more than once across route segments, so a plain module-level Map would not be
// shared between the start, worker and status routes even in one dev process.
const globalStore = globalThis as unknown as {
  __geoJobStore?: Map<string, { value: string; expires: number }>;
};
const memory = (globalStore.__geoJobStore ??= new Map());

function key(id: string): string {
  return `geo-scorecard:job:${id}`;
}

/** Run one Redis command via the Upstash REST API. */
async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

export async function saveJob(job: Job): Promise<void> {
  const value = JSON.stringify(job);
  if (usingRedis) {
    await redisCommand(["SET", key(job.id), value, "EX", CONFIG.job.ttlSeconds]);
    return;
  }
  memory.set(key(job.id), {
    value,
    expires: Date.now() + CONFIG.job.ttlSeconds * 1000,
  });
}

export async function getJob(id: string): Promise<Job | null> {
  if (usingRedis) {
    const raw = (await redisCommand(["GET", key(id)])) as string | null;
    return raw ? (JSON.parse(raw) as Job) : null;
  }
  const entry = memory.get(key(id));
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    memory.delete(key(id));
    return null;
  }
  return JSON.parse(entry.value) as Job;
}
