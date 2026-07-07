# AI Search Visibility Scorecard (GEO Scorecard)

A single-page lead-gen tool for **Huck**. It shows a hotel how visible it is in AI
search answers and scores its GEO readiness out of 100. Two layers:

- **Layer 1, live AI citation check** (the differentiator): for each guest question we
  query **Perplexity Sonar** (primary, UK-targeted) and **DataForSEO LLM Mentions** for
  the **Google AI Overview** layer, then check whether the user's domain appears in the
  cited sources.
- **Layer 2, on-page GEO readiness** (free, instant): we fetch the homepage plus a key
  page and score structural signals that make a site citable by AI (schema, FAQ content,
  clean headings, entity clarity, extractable facts).

Built with **Next.js (App Router) + TypeScript + Tailwind**, deployed on **Vercel**. All
API credentials and the site fetch live on serverless routes and are never exposed to the
browser. UK English, no em dashes.

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # optional; runs in MOCK mode with no keys
npm run dev                    # http://localhost:3300 (or 3000)
npm run build                  # production build
```

With **no API keys set, the app runs in MOCK mode**: the full flow works with synthetic
but plausible results, so you can see and demo everything before spending on live APIs. A
"Demo data" badge shows on the results while mock mode is active.

---

## Architecture: async job + polling (beats serverless timeouts)

DataForSEO's live task can take up to 120s and Vercel functions are time-limited, so the
AI checks never run inside the request that serves the page. The flow:

```
1. POST /api/scorecard/geo    (sync, free)  -> fetch homepage + key page, return GEO score
2. POST /api/scorecard/start  (fast)        -> validate, create job, return jobId,
                                               then fire the worker via after()
3.      /api/scorecard/worker (background)   -> runs GEO + all engines, writes partial
                                               results to the store, scores, posts lead
4. GET  /api/scorecard/status?jobId=  (poll) -> frontend polls every 2s, renders progress
                                               per question, then the final 0-100 score
```

- The **worker** sets `export const maxDuration = 60` (works on every Vercel plan).
  In practice DataForSEO LLM Mentions returns in ~2s and Perplexity in a few seconds, so
  60s is ample; Pro is not required. `start`, `status` and `geo` use short limits too. See
  the `route.ts` files under `src/app/api/scorecard/`.
- `start` hands off to the worker with `after()` (from `next/server`) so the worker runs
  on its own invocation with its own time budget, authenticated by `INTERNAL_SECRET`.
- Concurrency is capped by `CONFIG.concurrency` (default 3) and question count by
  `CONFIG.questions.full` (default 10) to control cost. Total API cost per scorecard is
  summed (`job.costUsd`, Perplexity usage cost + DataForSEO task cost) and included in the
  lead payload.

### The job store (required in production)

The worker invocation and the status-poll invocation are separate serverless processes, so
they must share state via Redis. `src/lib/store.ts` uses the **Upstash Redis REST API** and
reads either `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` **or** the
`KV_REST_API_URL` / `KV_REST_API_TOKEN` pair that **Vercel KV** injects. Without Redis it
falls back to an in-memory map that only works in a single local `next dev` process, never
in production.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `PERPLEXITY_API_KEY` | server | Perplexity Sonar (primary engine). Blank = mock. |
| `DATAFORSEO_LOGIN` | server | DataForSEO Basic auth login. |
| `DATAFORSEO_PASSWORD` | server | DataForSEO Basic auth password. Blank = mock. |
| `MOCK_MODE` | server | Set to `1` to force synthetic results even with keys. |
| `FIRECRAWL_API_KEY` | server | Optional. Fallback crawler used only when a plain fetch of the hotel's site is bot-blocked; improves GEO reliability and tailored question suggestions. Direct-only without it. |
| `UPSTASH_REDIS_REST_URL` | server | Job store (or use Vercel KV's `KV_REST_API_URL`). |
| `UPSTASH_REDIS_REST_TOKEN` | server | Job store token (or `KV_REST_API_TOKEN`). |
| `LEAD_WEBHOOK_URL` | server | Where the completed scorecard JSON is POSTed (CRM / Airtable / Zapier). |
| `INTERNAL_SECRET` | server | Shared secret gating the worker route. Set a random value in prod. |
| `NEXT_PUBLIC_BOOKING_URL` | client | Post-results "Book a review" link. |
| `NEXT_PUBLIC_PRIVACY_URL` | client | Privacy policy link on the consent checkbox. |

If **both** engines are unconfigured the app auto-enables mock mode. If only one engine is
configured, the other is reported as unavailable per question rather than failing the run.

---

## The `CONFIG` object

All non-secret tunables live in one object in [`src/lib/config.ts`](src/lib/config.ts):

- **`weights`** (sum 100): `citationRate` 50, `positionQuality` 15, `competitorGap` 15,
  `geoReadiness` 20.
- **`questions`**: `free` 3, `full` 10, `maxLength` 160.
- **`engines`**: `["perplexity", "dataforseo"]` (order shown in UI) with display labels.
- **`concurrency`** 3, **`workerMaxDuration`** 300.
- **`geo`**: key-page paths tried, fetch timeout, and the browser user-agent used.
- **`perplexity`** / **`dataforseo`**: endpoints, model, platform, UK location/language.
- **`bands`**: the five score ranges and labels.
- **`placeholders`**: example guest questions.

Update any figure there without touching logic. Scoring lives in
[`src/lib/scoring.ts`](src/lib/scoring.ts) (pure, testable).

### How the 0-100 score is built

- **AI citation rate (50):** linear on the share of questions where the domain is cited by
  any engine.
- **Citation position quality (15):** higher when the domain appears earlier in the source
  list, averaged over cited questions.
- **Competitor gap (15):** reduced by the share of questions where competitors were cited
  but the user was not.
- **On-page GEO readiness (20):** sum of structural signals present (business schema 4, FAQ
  schema 2, FAQ content 3, clean headings 2, entity clarity 3, extractable facts 2, review
  markup 2, described images 2).

Rounded to a whole number, mapped to a band label (80+ "Highly visible in AI search" down
to 0-19 "Not showing up").

### Findings shown beyond the score

- **What AI actually said** per question (a real answer excerpt), plus AI search volume and
  the related "people also ask AI" fan-out queries.
- **Citation frequency** for the DataForSEO layers: not just cited yes/no, but the share of
  sampled AI responses that cite you (a confidence signal).
- **Competitor leaderboard, typed:** each cited domain tagged OTA/aggregator, guide/info, or
  rival property, so "beaten by Booking.com" reads differently from "beaten by a rival hotel".
- **Visibility split:** how many questions you win on your own site vs where only OTAs are
  cited vs where no one relevant is cited.
- **Brand check:** what AI says when asked about the business by name, and whether it is
  recognised at all (needs the optional business-name field).
- **Prioritised fixes:** a ranked, specific action list generated from the citation and GEO
  gaps (`src/lib/recommendations.ts`).

The DataForSEO layers query **keyword-only** and aggregate across sampled recorded AI
responses; sending a domain target too would AND the two and return nothing whenever the user
is not already cited. Tune the sample with `CONFIG.dataforseo.sampleLimit`.

---

## Lead capture payload

When the worker finishes it POSTs a flat JSON body to `LEAD_WEBHOOK_URL` (logged to the
server console if unset). Shape:

```json
{
  "email": "gm@example-hotel.co.uk",
  "businessName": "The Example Hotel",
  "name": "Alex Smith",
  "consent": true,
  "domain": "example-hotel.co.uk",
  "score": 73,
  "band": "Getting cited, room to grow",
  "questionsTested": 3,
  "questionsCited": 2,
  "scoreCitationRate": 33.3,
  "scorePositionQuality": 13.5,
  "scoreCompetitorGap": 10,
  "scoreGeoReadiness": 15,
  "geoScore": 15,
  "geoSignalsPresent": ["FAQ schema markup", "Clean heading hierarchy"],
  "geoSignalsMissing": ["Hotel / LocalBusiness schema"],
  "questions": [
    {
      "question": "best boutique hotels in the New Forest",
      "cited": false,
      "bestPosition": null,
      "engines": [
        { "engine": "perplexity", "cited": false, "position": null, "competitors": ["sawdays.co.uk"] },
        { "engine": "dataforseo", "cited": false, "position": null, "competitors": ["booking.com"] }
      ]
    }
  ],
  "topCompetitors": ["booking.com (3)", "tripadvisor.co.uk (2)"],
  "apiCostUsd": 0.075,
  "source": "ai-search-visibility-scorecard",
  "submittedAt": "2026-07-07T13:01:08.504Z"
}
```

`email` is the required, validated field; `businessName` and `name` are optional; `consent`
records the GDPR checkbox.

---

## Deploy to Vercel

1. Push to GitHub, import the repo in Vercel (framework auto-detects Next.js).
2. Add a **job store**: either add **Vercel KV** to the project (it injects `KV_REST_API_*`),
   or create an **Upstash Redis** DB and set `UPSTASH_REDIS_REST_URL` + `..._TOKEN`.
3. Set the env vars above (`PERPLEXITY_API_KEY`, `DATAFORSEO_LOGIN`/`PASSWORD`,
   `LEAD_WEBHOOK_URL`, `INTERNAL_SECRET`, `NEXT_PUBLIC_BOOKING_URL`, `NEXT_PUBLIC_PRIVACY_URL`).
   Leave the engine keys blank to ship in mock mode first.
4. Runs on any plan (the worker uses a 60s `maxDuration`); **Vercel Pro is not required**.
5. Redeploy after any env change (Next inlines `NEXT_PUBLIC_*` at build time).

### Cost per scorecard

Perplexity `sonar` is a fraction of a cent per question. **DataForSEO bills roughly $0.15-0.20
per call**, and there are two DataForSEO layers (Google AIO + ChatGPT), so a full 10-question
run is about **$3-4**. Levers: lower `CONFIG.dataforseo.sampleLimit`, reduce the question cap,
or remove `"chatgpt"` from `CONFIG.engines`. Every run logs its total (`apiCostUsd`).

## Embedding

The page sets `frame-ancestors *` so it can be embedded in an `<iframe>` on the Huck site.

## Project structure

```
src/
  app/
    page.tsx, layout.tsx, globals.css
    api/scorecard/{geo,start,status,worker}/route.ts
  lib/
    config.ts            CONFIG + public URLs + band lookup
    types.ts             shared data model
    normalize.ts         domain normalisation + matching
    scoring.ts           pure 0-100 scoring
    store.ts             Upstash/KV job store (+ in-memory dev fallback)
    webhook.ts           lead payload + POST
    geo/analyze.ts       on-page GEO readiness (Layer 2)
    engines/             perplexity, dataforseo, mock, runner, shared
  components/            ScorecardApp, ScoreDial, GeoChecklist, QuestionRows, CompetitorLeaderboard, Logo
  hooks/useCountUp.ts
```
