"use client";
import type { VisibilitySplit } from "@/lib/types";

/** A single stacked bar: own-site vs via-OTA vs invisible, across the questions. */
export function VisibilityBar({ v }: { v: VisibilitySplit }) {
  const total = v.ownDomain + v.viaOta + v.invisible;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const rows = [
    { key: "own", label: "Cited on your own site", n: v.ownDomain, cls: "bg-gain" },
    { key: "ota", label: "Only OTAs cited (not you)", n: v.viaOta, cls: "bg-warn" },
    { key: "none", label: "No one relevant cited", n: v.invisible, cls: "bg-sage" },
  ].filter((r) => r.n > 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunk">
        {rows.map((r) => (
          <div key={r.key} className={r.cls} style={{ width: pct(r.n) }} title={`${r.label}: ${r.n}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-[13.5px] text-muted">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.cls}`} />
            <span className="text-ink">{r.n}</span> of {total} · {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
