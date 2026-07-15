"use client";

/** Pulsing placeholder block. Reduced-motion is handled globally in globals.css. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-md bg-sage/30 ${className}`}
    />
  );
}

/** Processing state for the score header: a pulsing dial + live progress. */
export function ProcessingScore({
  domain,
  done,
  total,
}: {
  domain: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="flex flex-col items-center"
      role="status"
      aria-live="polite"
      aria-label={`Checking AI search, ${done} of ${total} questions done`}
    >
      <div className="relative h-52 w-52">
        {/* base ring */}
        <div className="absolute inset-0 rounded-full border-[14px] border-surface-sunk" />
        {/* pulsing skeleton fill */}
        <div className="absolute inset-[14px] animate-pulse rounded-full bg-sage/20" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular font-display text-[2.6rem] font-semibold leading-none text-ink">
            {done}
            <span className="text-muted">/{total}</span>
          </span>
          <span className="mt-1 text-[12.5px] font-medium text-muted">questions checked</span>
        </div>
      </div>

      <p className="mt-5 font-display text-[19px] font-semibold text-ink">
        Checking your AI visibility
      </p>

      <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-sunk">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out-quint"
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>

      <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-muted">
        Asking Perplexity, Google AI and ChatGPT your {total} guest{" "}
        {total === 1 ? "question" : "questions"} about{" "}
        <span className="font-medium text-ink">{domain}</span>. This takes a moment.
      </p>
    </div>
  );
}

/** Skeleton for the "priority fixes" card. */
export function FixesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3.5">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the "who AI recommends instead" leaderboard. */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-32 shrink-0" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton rows for the "question by question" card before questions arrive. */
export function QuestionsSkeleton() {
  return (
    <div className="divide-y divide-sage/40">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 py-4 first:pt-0">
          <Skeleton className="h-3.5 w-3/5" />
          <div className="flex gap-1.5">
            <Skeleton className="h-[26px] w-[92px] rounded-full" />
            <Skeleton className="h-[26px] w-[96px] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the visibility split card. */
export function VisibilitySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
