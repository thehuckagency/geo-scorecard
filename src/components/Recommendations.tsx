"use client";
import type { Recommendation } from "@/lib/types";

export function Recommendations({ items }: { items: Recommendation[] }) {
  if (items.length === 0) return null;
  const top = items.slice(0, 5);
  return (
    <ol className="space-y-3">
      {top.map((r, i) => (
        <li key={i} className="flex gap-3.5">
          <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug text-ink">{r.title}</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{r.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
