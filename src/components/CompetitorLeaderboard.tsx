"use client";
import { KIND_LABEL } from "@/lib/classify";
import type { CompetitorEntry, CompetitorKind } from "@/lib/types";

const KIND_TONE: Record<CompetitorKind, string> = {
  ota: "border-warn/40 bg-warn/10 text-warn",
  rival: "border-ink/25 bg-ink/5 text-ink",
  info: "border-sage/60 text-muted",
};

/** Top domains AI recommends for these questions, ranked and typed. */
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
    <ul className="space-y-3">
      {competitors.map((c) => (
        <li key={c.domain} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-[14px] font-medium text-ink" title={c.domain}>
            {c.domain}
          </span>
          <span
            className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline ${KIND_TONE[c.kind]}`}
            title={KIND_LABEL[c.kind]}
          >
            {KIND_LABEL[c.kind]}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
            <span
              className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out-quint ${
                c.kind === "ota" ? "bg-warn" : c.kind === "rival" ? "bg-ink" : "bg-sage"
              }`}
              style={{ width: `${(c.count / max) * 100}%` }}
            />
          </span>
          <span className="tabular w-12 shrink-0 text-right text-[13px] text-muted">
            {c.count}/{total}
          </span>
        </li>
      ))}
    </ul>
  );
}
