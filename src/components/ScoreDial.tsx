"use client";
import { useCountUp } from "@/hooks/useCountUp";

/** Big animated circular score out of `max` with a band label beneath. */
export function ScoreDial({
  value,
  max = 100,
  label,
  size = 208,
  stroke = 14,
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  stroke?: number;
}) {
  const animated = useCountUp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, animated / max));
  const offset = c * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DCE8E2" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#1A2922"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular font-display text-[clamp(3rem,12vw,4rem)] font-semibold leading-none text-ink">
            {Math.round(animated)}
          </span>
          <span className="mt-1 text-[13px] font-medium text-muted">out of {max}</span>
        </div>
      </div>
      {label ? (
        <p className="mt-4 text-balance text-center font-display text-[19px] font-semibold text-ink">
          {label}
        </p>
      ) : null}
    </div>
  );
}
