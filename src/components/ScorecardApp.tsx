"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG, PUBLIC } from "@/lib/config";
import type {
  GeoReadiness,
  JobStatus,
  QuestionResult,
  Scorecard as ScorecardType,
} from "@/lib/types";
import { Logo } from "./Logo";
import { ScoreDial } from "./ScoreDial";
import { GeoChecklist } from "./GeoChecklist";
import { QuestionRows } from "./QuestionRows";
import { CompetitorLeaderboard } from "./CompetitorLeaderboard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase = "domain" | "ready" | "running" | "done";

interface StatusResponse {
  status: JobStatus;
  domain: string;
  mock: boolean;
  progress: { done: number; total: number };
  geo: GeoReadiness | null;
  questions: QuestionResult[];
  scorecard: ScorecardType | null;
  error?: string;
}

function HeaderBar() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-2 pt-7 sm:px-8">
      <Logo className="h-6 w-auto text-ink sm:h-7" />
      <a
        href={PUBLIC.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group focus-ring inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        Visit huck.agency to learn more
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform duration-300 ease-out-quint group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </a>
    </header>
  );
}

export default function ScorecardApp() {
  const [phase, setPhase] = useState<Phase>("domain");
  const [domain, setDomain] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geo, setGeo] = useState<GeoReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Questions + lead
  const [questions, setQuestions] = useState<string[]>(["", "", ""]);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Job / polling
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const pollRef = useRef<number | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const maxQuestions = emailValid ? CONFIG.questions.full : CONFIG.questions.free;

  // --- Step 1: domain -> instant GEO ---
  const runGeo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const d = domain.trim();
      if (!d || !d.includes(".")) {
        setError("Please enter a valid website domain.");
        return;
      }
      setGeoLoading(true);
      try {
        const res = await fetch("/api/scorecard/geo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: d }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not analyse that site.");
        setDomain(data.domain);
        setGeo(data.geo);
        setPhase("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setGeoLoading(false);
      }
    },
    [domain],
  );

  // --- Step 2: email gate -> start job ---
  const start = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const qs = questions.map((q) => q.trim()).filter(Boolean);
      if (qs.length === 0) {
        setError("Please enter at least one guest question.");
        return;
      }
      if (!emailValid) {
        setError("Please enter a valid work email.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/scorecard/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Consent is given by submitting the form (passive notice below the fields).
          body: JSON.stringify({ domain, questions: qs, email: email.trim(), businessName, name, consent: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start the check.");
        setPhase("running");
        beginPolling(data.jobId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setSubmitting(false);
      }
    },
    [questions, emailValid, domain, email, businessName, name],
  );

  const beginPolling = useCallback((jobId: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/scorecard/status?jobId=${encodeURIComponent(jobId)}`);
        const data: StatusResponse = await res.json();
        if (!res.ok) return;
        setStatus(data);
        if (data.geo) setGeo(data.geo);
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase("done");
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, CONFIG.job.pollIntervalMs);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const setQuestion = (i: number, v: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? v : q)));

  const addQuestion = () =>
    setQuestions((prev) => (prev.length < maxQuestions ? [...prev, ""] : prev));

  const sc = status?.scorecard ?? null;

  return (
    <div className="min-h-screen bg-paper">
      <HeaderBar />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-8 sm:px-8 sm:pt-12">
        <h1 className="max-w-3xl text-balance font-display text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-ink">
          Are you showing up when people ask AI where to stay?
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-[16.5px] leading-relaxed text-muted sm:text-[18px]">
          More and more guests start their search in ChatGPT, Perplexity and Google AI, not on a
          search results page. Enter your website and a few of the questions your guests ask, and we
          will show you how often AI actually recommends you, and where your competitors are getting
          cited instead.
        </p>
      </section>

      <main className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        {/* Step 1: domain */}
        {phase === "domain" && (
          <form onSubmit={runGeo} className="card p-6 sm:p-8">
            <p className="text-[15px] leading-relaxed text-muted">
              Tell us your domain and the questions your ideal guest might ask. We will check what
              the AI says back.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                  https://
                </span>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  aria-label="Website domain"
                  placeholder="yourhotel.co.uk"
                  className="field pl-[4.75rem]"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary shrink-0" disabled={geoLoading}>
                {geoLoading ? "Checking your site..." : "Check my site"}
              </button>
            </div>
            {error && <p role="alert" className="mt-3 text-[13.5px] font-medium text-ink">{error}</p>}
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Free and instant. We read your homepage to score how ready you are to be cited by AI.
            </p>
          </form>
        )}

        {/* Step 2: GEO shown + questions + email gate */}
        {phase === "ready" && geo && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-8">
            <div className="card p-6 sm:p-7">
              <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.04em] text-muted">
                {domain}
              </p>
              <GeoChecklist geo={geo} />
              <p className="mt-5 border-t border-sage/50 pt-4 text-[13.5px] leading-snug text-muted">
                This is your free on-page score. The live check below shows whether AI actually cites
                you when guests ask.
              </p>
            </div>

            <form onSubmit={start} className="card p-6 sm:p-8">
              <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">
                What do your guests ask AI?
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
                Add the questions an ideal guest might type into ChatGPT or Google AI.
              </p>

              <div className="mt-4 space-y-2.5">
                {questions.map((q, i) => (
                  <input
                    key={i}
                    type="text"
                    aria-label={`Guest question ${i + 1}`}
                    placeholder={CONFIG.placeholders[i % CONFIG.placeholders.length]}
                    className="field"
                    value={q}
                    onChange={(e) => setQuestion(i, e.target.value)}
                  />
                ))}
              </div>
              {questions.length < maxQuestions ? (
                <button type="button" onClick={addQuestion} className="focus-ring mt-2.5 text-[13.5px] font-semibold text-gain hover:text-ink">
                  + Add another question
                </button>
              ) : !emailValid ? (
                <p className="mt-2.5 text-[13px] text-muted">
                  Add your email below to test up to {CONFIG.questions.full} questions.
                </p>
              ) : null}

              <div className="mt-5 border-t border-sage/50 pt-5">
                <p className="text-[14.5px] leading-relaxed text-muted">
                  Want the full scorecard? We will send you a clear report with every question we
                  tested, the exact sources AI cited instead of you, and the three fixes that will
                  get you mentioned. Just tell us where to send it.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="email" required autoComplete="email" aria-label="Work email" placeholder="Work email" className="field sm:col-span-2" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input type="text" autoComplete="organization" aria-label="Hotel or business name (optional)" placeholder="Hotel name (optional)" className="field" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  <input type="text" autoComplete="name" aria-label="Your name (optional)" placeholder="Your name (optional)" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                {error && <p role="alert" className="mt-3 text-[13.5px] font-medium text-ink">{error}</p>}
                <button type="submit" className="btn-primary mt-4 w-full sm:w-auto" disabled={submitting}>
                  {submitting ? "Starting..." : "Send me my full scorecard"}
                </button>
                <p className="mt-3 text-[13px] leading-snug text-muted">
                  No spam, no sales pressure. Just your score and a plan you can act on.
                </p>
                <p className="mt-2 text-[12px] leading-snug text-muted">
                  By requesting your scorecard you agree to Huck contacting you about your results,
                  per our{" "}
                  <a href={PUBLIC.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2 hover:text-gain">privacy policy</a>.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: running / done */}
        {(phase === "running" || phase === "done") && (
          <Results phase={phase} domain={domain} status={status} geo={geo} sc={sc} />
        )}
      </main>
    </div>
  );
}

function Results({
  phase,
  domain,
  status,
  geo,
  sc,
}: {
  phase: Phase;
  domain: string;
  status: StatusResponse | null;
  geo: GeoReadiness | null;
  sc: ScorecardType | null;
}) {
  const qs = status?.questions ?? [];
  const progress = status?.progress ?? { done: 0, total: qs.length };
  const done = phase === "done" && sc;

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="card p-6 text-center sm:p-10">
        {status?.mock && (
          <p className="mx-auto mb-4 inline-block rounded-full border border-sage/60 bg-surface px-3 py-1 text-[12px] font-medium text-muted">
            Demo data. Add API keys for live results.
          </p>
        )}
        {done && sc ? (
          <>
            <h2 className="mb-6 font-display text-[clamp(1.4rem,3.5vw,1.9rem)] font-semibold text-ink">
              Your AI Visibility Score: {sc.breakdown.total} / 100
            </h2>
            <ScoreDial value={sc.breakdown.total} label={sc.band.label} />
            <p className="mx-auto mt-6 max-w-xl text-[15.5px] leading-relaxed text-ink">
              We checked {sc.questionCount} guest questions across AI search. You were cited in{" "}
              {sc.citedCount} of them. Here is where you are winning, where you are invisible, and
              who is being recommended in your place.
            </p>
          </>
        ) : (
          <>
            <ScoreDial value={0} />
            <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              Checking {progress.total} guest questions across AI search for{" "}
              <span className="font-medium text-ink">{domain}</span>. {progress.done} of{" "}
              {progress.total} done.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-question results */}
        <div className="card p-6 sm:p-7">
          <h3 className="mb-4 text-[15px] font-semibold text-ink">Question by question</h3>
          {qs.length ? (
            <QuestionRows questions={qs} />
          ) : (
            <p className="text-[14px] text-muted">Preparing your questions...</p>
          )}
        </div>

        <div className="space-y-6">
          {/* Competitors */}
          <div className="card p-6 sm:p-7">
            <h3 className="mb-4 text-[15px] font-semibold text-ink">
              Who AI recommends instead
            </h3>
            {sc ? (
              <CompetitorLeaderboard competitors={sc.competitors} total={sc.questionCount} />
            ) : (
              <p className="text-[14px] text-muted">Building the leaderboard as answers land...</p>
            )}
          </div>

          {/* GEO checklist */}
          {geo && (
            <div className="card p-6 sm:p-7">
              <GeoChecklist geo={geo} />
            </div>
          )}
        </div>
      </div>

      {/* Summary + CTA */}
      {done && sc && (
        <div className="card p-6 text-center sm:p-8">
          <p className="mx-auto max-w-2xl text-[15.5px] leading-relaxed text-ink">
            {summarySentence(domain, sc, geo)}
          </p>
          <a
            href={PUBLIC.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-5"
          >
            Book a free 20-minute AI search review with Huck
          </a>
        </div>
      )}
    </div>
  );
}

function summarySentence(domain: string, sc: ScorecardType, geo: GeoReadiness | null): string {
  const top = sc.competitors[0]?.domain;
  const geoLine = geo ? ` Your on-page GEO readiness is ${Math.round(geo.score)} out of ${geo.maxScore}.` : "";
  const citeLine =
    sc.citedCount > 0
      ? `${domain} was cited in ${sc.citedCount} of ${sc.questionCount} questions we tested.`
      : `${domain} was not cited in any of the ${sc.questionCount} questions we tested.`;
  const compLine = top ? ` ${top} was recommended most often in your place.` : "";
  return `${citeLine}${compLine}${geoLine}`;
}
