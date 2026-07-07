"use client";
import type { CompetitorEntry } from "@/lib/types";

/** Top domains AI recommends for these questions, ranked by how many they won. */
export function CompetitorLeaderboard({
  competitors,
  total,
}: {
  competitors: CompetitorEntry[];
  total: number;
}) {
  if (competitors.length === 0) {
    return (
      <p className="text-[14px] leading-snug text-muted">
        No competing domains dominated these answers. That is a good sign.
      </p>
    );
  }
  const max = Math.max(...competitors.map((c) => c.count), 1);
  return (
    <ul className="space-y-2.5">
      {competitors.map((c) => (
        <li key={c.domain} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-[14px] font-medium text-ink" title={c.domain}>
            {c.domain}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-muted transition-[width] duration-700 ease-out-quint"
              style={{ width: `${(c.count / max) * 100}%` }}
            />
          </span>
          <span className="tabular w-16 shrink-0 text-right text-[13px] text-muted">
            {c.count}/{total}
          </span>
        </li>
      ))}
    </ul>
  );
}
