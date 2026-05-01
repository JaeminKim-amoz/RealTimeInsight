/**
 * Mock LLM provider (US-2-004b) — keyword→canned-response map.
 *
 * Returns synthetic LlmResponse objects keyed by query keywords. The current
 * anomaly fixture (mock/anomalies.ts) drives the citation gate via
 * requiredEvidenceIds derived from the active anomaly's candidates.
 *
 * No HTTP, no real model calls — slice-2 placeholder.
 */

import { ANOMALY } from '../mock/anomalies';

export interface ToolTraceEntry {
  name: string;
  args: Record<string, unknown>;
  ms: number;
  result: string;
}

export interface LlmResponse {
  answer: string;
  toolTrace: ToolTraceEntry[];
  citedEvidenceIds: string[];
  /** When the answer fails to cover all required evidence ids, suggested ids
   * the caller could attach to satisfy the gate. */
  suggestedEvidenceIds?: string[];
}

export interface AskLlmContext {
  /** Required evidence ids the answer must cite (citation gate per spec §17). */
  requiredEvidenceIds: string[];
}

/**
 * Compute the required evidence ids for an anomaly. Uses the candidate
 * `rank` plus the anomaly id to produce stable ids (e.g. `anom-001-cand-1`).
 */
export function requiredEvidenceForAnomaly(anomalyId: string | null): string[] {
  if (!anomalyId) return [];
  // Slice-2: only ANOMALY (anom-001) is available; any other id yields [].
  if (ANOMALY.anomalyId !== anomalyId) return [];
  return ANOMALY.candidates.map((c) => `${ANOMALY.anomalyId}-cand-${c.rank}`);
}

interface CannedAnswer {
  answer: string;
  toolTrace: ToolTraceEntry[];
  cited: (anomalyId: string | null) => string[];
}

const ANOMALY_ANSWER: CannedAnswer = {
  answer:
    'Running a root-cause trace on Hyd Pressure A. Three high-confidence candidates: bus current transient leads by 120ms, PDU BIT fault co-occurs, hyd bypass valve transitions just before spike.',
  toolTrace: [
    { name: 'find_anomalies', args: { channel: 1205, window: '±0.2s' }, ms: 42, result: '1 anomaly · score 0.93' },
    { name: 'correlate', args: { targets: 'nearby subsystems', lag: '±500ms' }, ms: 118, result: '11 channels, top 3 shown' },
    { name: 'read_formulas', args: { subsystem: 'hydraulic' }, ms: 22, result: 'P = f(V,I,valve) bridge formula found' },
  ],
  cited: (id) => requiredEvidenceForAnomaly(id),
};

const RELATED_CHANNELS_ANSWER: CannedAnswer = {
  answer:
    'Channels currently correlated with Hyd Pressure A: bus_current (1002), pdu_word (1007), hyd_discretes (1210), accel_z (2215), hyd_pressure_2 (1206).',
  toolTrace: [
    { name: 'correlate', args: { source: 1205, lag: '±200ms' }, ms: 95, result: '5 hits' },
  ],
  cited: () => [], // intentionally fails the citation gate when an anomaly is active
};

const COMPARE_ANSWER: CannedAnswer = {
  answer:
    'Run 0918 had a near-identical signature on the Power→Hyd bridge — resolved by replacing PDU-4 fuse. 2.1σ spectral match.',
  toolTrace: [
    { name: 'search_recordings', args: { tail: 'T-247', signature: 'hyd-spike-with-i-lead' }, ms: 3200, result: '3 matches' },
    { name: 'open_bookmark', args: { run: '0918' }, ms: 14, result: 'loaded' },
  ],
  cited: (id) => requiredEvidenceForAnomaly(id),
};

const CRC_ANSWER: CannedAnswer = {
  answer:
    'CRC burst at T+182.4s lasted 145ms across video and PCM streams. Burst aligned with hyd valve transition — likely shared PDU under-volt window.',
  toolTrace: [
    { name: 'find_anomalies', args: { type: 'crc' }, ms: 38, result: '1 cluster · 145ms' },
  ],
  cited: () => [],
};

const FALLBACK_ANSWER: CannedAnswer = {
  answer:
    "I'd reach for the evidence graph and run correlate + find_anomalies on the named channels. Want me to build a focused workspace?",
  toolTrace: [
    { name: 'plan', args: { goal: 'route query to tools' }, ms: 80, result: 'drafted' },
  ],
  cited: () => [],
};

function classify(query: string): CannedAnswer {
  const q = query.toLowerCase();
  if (q.includes('anomaly') || q.includes('why')) return ANOMALY_ANSWER;
  if (q.includes('related') || q.includes('correlate')) return RELATED_CHANNELS_ANSWER;
  if (q.includes('compare') || q.includes('last run') || q.includes('previous')) return COMPARE_ANSWER;
  if (q.includes('crc') || q.includes('burst')) return CRC_ANSWER;
  return FALLBACK_ANSWER;
}

/**
 * Mock askLlm — returns the canned response for the provided query
 * keywords, with citedEvidenceIds derived from the context's required set.
 *
 * Synchronous Promise resolution (no setTimeout) so unit tests can `await`
 * without fake-timers plumbing.
 */
export async function askLlm(query: string, context: AskLlmContext): Promise<LlmResponse> {
  const canned = classify(query);
  // Use the anomaly id implied by the required evidence to pick cited ids.
  const anomalyId = context.requiredEvidenceIds[0]?.split('-cand-')[0] ?? null;
  const citedEvidenceIds = canned.cited(anomalyId);
  const missing = context.requiredEvidenceIds.filter((id) => !citedEvidenceIds.includes(id));
  return {
    answer: canned.answer,
    toolTrace: canned.toolTrace,
    citedEvidenceIds,
    suggestedEvidenceIds: missing.length > 0 ? missing : undefined,
  };
}

export const SUGGESTED_PROMPTS: ReadonlyArray<string> = [
  'Why this anomaly?',
  'Show related channels',
  'Compare to last run',
  'Explain CRC burst',
];
