import type { EngineId } from "./config";

/** Result of one engine answering one question. */
export interface EngineResult {
  engine: EngineId;
  cited: boolean;
  /** 1-based rank of the user's domain in the source list (null if not cited). */
  position: number | null;
  /** Total sources the engine cited for this question. */
  sourceCount: number;
  /** Other domains cited for this question (excludes the user's domain). */
  competitors: string[];
  /** Optional Google AI Overview search volume (DataForSEO only). */
  aiSearchVolume?: number | null;
  /** Cost of this engine call in USD, if reported. */
  costUsd?: number;
  /** Populated when the engine failed for this question. */
  error?: string;
}

/** All engine results for a single guest question. */
export interface QuestionResult {
  question: string;
  status: "pending" | "running" | "done" | "error";
  engines: EngineResult[];
  /** True if cited by any engine. */
  citedAny: boolean;
  /** Best (lowest) position across engines, null if never cited. */
  bestPosition: number | null;
}

export interface GeoSignal {
  id: string;
  label: string;
  present: boolean;
  points: number; // points awarded when present
  detail: string; // short human explanation
}

export interface GeoReadiness {
  score: number; // 0..CONFIG.weights.geoReadiness
  maxScore: number;
  signals: GeoSignal[];
  analysedUrl: string;
  keyPageUrl: string | null;
  error?: string;
}

export interface CompetitorEntry {
  domain: string;
  count: number; // number of questions where this domain was cited
}

export interface ScoreBreakdown {
  citationRate: number; // 0..50
  positionQuality: number; // 0..15
  competitorGap: number; // 0..15
  geoReadiness: number; // 0..20
  total: number; // 0..100 (rounded)
}

export interface Scorecard {
  citedCount: number; // questions cited in (any engine)
  questionCount: number;
  breakdown: ScoreBreakdown;
  band: { label: string; min: number; max: number };
  competitors: CompetitorEntry[];
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface LeadInput {
  email: string;
  businessName: string;
  name: string;
  consent: boolean;
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  domain: string;
  questions: QuestionResult[];
  geo: GeoReadiness | null;
  lead: LeadInput;
  scorecard: Scorecard | null;
  /** Sum of all engine costs, USD. */
  costUsd: number;
  error?: string;
  /** Whether the completed scorecard has been posted to the lead webhook. */
  webhookSent?: boolean;
}
