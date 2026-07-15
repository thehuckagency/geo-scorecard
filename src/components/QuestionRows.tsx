"use client";
import { CONFIG } from "@/lib/config";
import type { EngineResult, QuestionResult } from "@/lib/types";
import { Skeleton } from "./Skeleton";

function EngineChip({ e }: { e: EngineResult }) {
  const label = CONFIG.engineLabels[e.engine];
  let text: string;
  let tone: string;
  if (e.error) {
    text = "Unavailable";
    tone = "border-sage/60 text-muted";
  } else if (e.cited) {
    const freq =
      e.responsesSampled && e.responsesSampled > 1 && e.citedShare != null
        ? ` · ${Math.round(e.citedShare * 100)}%`
        : "";
    text = `${e.position ? `Cited #${e.position}` : "Cited"}${freq}`;
    tone = "border-gain/40 bg-gain/10 text-gain";
  } else {
    text = "Not cited";
    tone = "border-sage/60 text-muted";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${tone}`}>
      <span className="font-semibold">{label}</span>
      <span aria-hidden>·</span>
      {text}
    </span>
  );
}

function StatusDot({ status }: { status: QuestionResult["status"] }) {
  const cls =
    status === "done"
      ? "bg-gain"
      : status === "running"
        ? "bg-ink animate-pulse"
        : status === "error"
          ? "bg-warn"
          : "bg-sage";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} aria-label={status} />;
}

export function QuestionRows({ questions }: { questions: QuestionResult[] }) {
  return (
    <ul className="divide-y divide-sage/40">
      {questions.map((q, i) => {
        const competitors = Array.from(new Set(q.engines.flatMap((e) => e.competitors))).slice(0, 3);
        const answer = q.engines.find((e) => e.sampleAnswer)?.sampleAnswer;
        const volume = q.engines.find((e) => e.aiSearchVolume)?.aiSearchVolume;
        const related = q.engines.find((e) => e.relatedQuestions?.length)?.relatedQuestions ?? [];
        return (
          <li key={i} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5">
                <StatusDot status={q.status} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[15px] font-medium leading-snug text-ink">{q.question}</p>
                  {volume ? (
                    <span className="tabular shrink-0 text-[12px] text-muted">
                      ~{volume.toLocaleString("en-GB")} AI searches/mo
                    </span>
                  ) : null}
                </div>

                {q.status === "pending" || q.status === "running" ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Skeleton className="h-[26px] w-[92px] rounded-full" />
                      <Skeleton className="h-[26px] w-[96px] rounded-full" />
                      <Skeleton className="h-[26px] w-[84px] rounded-full" />
                    </div>
                    <p className="mt-2 text-[12.5px] text-muted">
                      {q.status === "running" ? "Checking AI search..." : "Queued"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.engines.map((e) => (
                        <EngineChip key={e.engine} e={e} />
                      ))}
                    </div>

                    {answer ? (
                      <p className="mt-2.5 rounded-lg bg-surface-sunk/50 px-3 py-2 text-[13px] italic leading-snug text-muted">
                        <span className="mr-1 font-semibold not-italic text-muted/80">What AI said:</span>
                        &ldquo;{answer}&rdquo;
                      </p>
                    ) : null}

                    {!q.citedAny && competitors.length > 0 && (
                      <p className="mt-2 text-[13px] leading-snug text-muted">
                        Cited instead:{" "}
                        <span className="font-medium text-ink">{competitors.join(", ")}</span>
                      </p>
                    )}

                    {related.length > 0 && (
                      <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
                        People also ask AI: {related.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
