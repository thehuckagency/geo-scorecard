"use client";
import type { GeoReadiness } from "@/lib/types";

function Tick({ present }: { present: boolean }) {
  return present ? (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gain text-paper">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  ) : (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-sage bg-surface text-muted">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <path d="M5 12h14" />
      </svg>
    </span>
  );
}

export function GeoChecklist({ geo, compact = false }: { geo: GeoReadiness; compact?: boolean }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-ink">On-page GEO readiness</h3>
        <span className="tabular text-[15px] font-semibold text-ink">
          {Math.round(geo.score)}
          <span className="text-muted">/{geo.maxScore}</span>
        </span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out-quint"
          style={{ width: `${(geo.score / geo.maxScore) * 100}%` }}
        />
      </div>

      {geo.error ? (
        <p className="text-[13.5px] leading-snug text-muted">{geo.error}</p>
      ) : (
        <ul className="space-y-2.5">
          {geo.signals.map((s) => (
            <li key={s.id} className="flex items-start gap-2.5">
              <Tick present={s.present} />
              <div className="min-w-0">
                <p className="text-[14px] font-medium leading-snug text-ink">{s.label}</p>
                {!compact && <p className="text-[12.5px] leading-snug text-muted">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
