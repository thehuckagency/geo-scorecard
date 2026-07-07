"use client";
import { CONFIG } from "@/lib/config";
import type { EngineResult, QuestionResult } from "@/lib/types";

function EngineChip({ e }: { e: EngineResult }) {
  const label = CONFIG.engineLabels[e.engine];
  let text: string;
  let tone: string;
  if (e.error) {
    text = "Unavailable";
    tone = "border-sage/60 text-muted";
  } else if (e.cited) {
    text = e.position ? `Cited #${e.position}` : "Cited";
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
  if (status === "done") {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-gain" aria-label="done" />;
  }
  if (status === "running") {
    return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ink" aria-label="running" />;
  }
  if (status === "error") {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-warn" aria-label="error" />;
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-label="pending" />;
}

export function QuestionRows({ questions }: { questions: QuestionResult[] }) {
  return (
    <ul className="divide-y divide-sage/40">
      {questions.map((q, i) => {
        const competitors = Array.from(
          new Set(q.engines.flatMap((e) => e.competitors)),
        ).slice(0, 3);
        return (
          <li key={i} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5">
                <StatusDot status={q.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-ink">{q.question}</p>

                {q.status === "pending" || q.status === "running" ? (
                  <p className="mt-1.5 text-[13px] text-muted">
                    {q.status === "running" ? "Checking AI search..." : "Queued"}
                  </p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.engines.map((e) => (
                        <EngineChip key={e.engine} e={e} />
                      ))}
                    </div>
                    {!q.citedAny && competitors.length > 0 && (
                      <p className="mt-2 text-[13px] leading-snug text-muted">
                        Cited instead:{" "}
                        <span className="font-medium text-ink">{competitors.join(", ")}</span>
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
