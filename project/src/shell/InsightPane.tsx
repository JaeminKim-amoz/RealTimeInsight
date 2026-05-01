/**
 * InsightPane (US-015) — right-side observation/evidence pane.
 *
 * US-2-005d: When detectedAnomalies.length > 0, lists ALL detected anomalies
 * (sorted by score desc). Each row clickable → selectionStore.selectAnomaly().
 * Mock ANOMALY (anom-001) still renders if no detected anomalies AND
 * selectedAnomalyId === 'anom-001'.
 */

import { useSelectionStore } from '../store/selectionStore';
import { useStreamStore } from '../store/streamStore';
import { lookupAnomaly } from '../mock/anomalies';
import type { AnomalyCandidate, AnomalyDescriptor } from '../types/domain';

function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: AnomalyCandidate;
  onClick: () => void;
}) {
  return (
    <div
      className="candidate"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="rank">#{candidate.rank}</div>
      <div className="cand-body">
        <div className="cand-title">{candidate.title}</div>
        <div className="cand-why">
          {candidate.evidenceKinds.map((e) => (
            <span key={e} className="evidence-chip ev">
              {e}
            </span>
          ))}
          <div className="rationale">{candidate.rationale}</div>
        </div>
      </div>
      <div className="conf">
        <div className="pct">{Math.round(candidate.confidence * 100)}</div>
        <div className="label">conf</div>
      </div>
    </div>
  );
}

function DetectedAnomalyRow({
  anomaly,
  onClick,
}: {
  anomaly: AnomalyDescriptor;
  onClick: () => void;
}) {
  return (
    <div
      className="detected-anomaly-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="da-severity">{anomaly.severity.toUpperCase()}</div>
      <div className="da-label">{anomaly.label}</div>
      <div className="da-score">{anomaly.score.toFixed(2)}</div>
    </div>
  );
}

export function InsightPane() {
  const selectedAnomalyId = useSelectionStore((s) => s.selectedAnomalyId);
  const selectAnomaly = useSelectionStore((s) => s.selectAnomaly);
  const selectGraphNode = useSelectionStore((s) => s.selectGraphNode);
  const detectedAnomalies = useStreamStore((s) => s.detectedAnomalies);

  // Sort detected anomalies by score descending
  const sortedDetected = detectedAnomalies.slice().sort((a, b) => b.score - a.score);

  // When there are detected anomalies, show the detected anomalies list
  if (sortedDetected.length > 0) {
    return (
      <div className="insight-pane pane insight">
        <div className="pane-header">
          <span>Insight · Evidence</span>
          <span className="count">{sortedDetected.length} detected</span>
        </div>
        <div className="insight-body">
          <div className="section-hd">Detected anomalies</div>
          {sortedDetected.map((a) => (
            <DetectedAnomalyRow
              key={a.anomalyId}
              anomaly={a}
              onClick={() => selectAnomaly(a.anomalyId)}
            />
          ))}
        </div>
      </div>
    );
  }

  // No detected anomalies — fall back to mock-based flow
  const anomaly = selectedAnomalyId ? lookupAnomaly(selectedAnomalyId) : undefined;

  if (!anomaly) {
    return (
      <div className="insight-pane pane insight">
        <div className="pane-header">
          <span>Insight · Evidence</span>
          <span className="count">idle</span>
        </div>
        <div className="empty-insight">
          <div className="icon">⌕</div>
          <div>Click an anomaly to inspect</div>
          <div className="empty-hint">
            Insight opens with root-cause candidates, relation graph, and linked evidence.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insight-pane pane insight">
      <div className="pane-header">
        <span>Insight · Evidence</span>
        <span className="count">{anomaly.anomalyId}</span>
      </div>
      <div className="insight-body">
        <div className="obs-card">
          <div className="obs-label">▲ Observation anchor</div>
          <h4>{anomaly.label}</h4>
          <div className="meta">
            <div>
              <b>Channel</b> CH{anomaly.channelId} · {anomaly.channelDisplay}
            </div>
            <div>
              <b>Severity</b> {anomaly.severity.toUpperCase()} · score{' '}
              {anomaly.score.toFixed(2)}
            </div>
            <div>
              <b>Window</b> {anomaly.windowSec[0].toFixed(2)}s –{' '}
              {anomaly.windowSec[1].toFixed(2)}s
            </div>
          </div>
        </div>

        <div className="section-hd">Ranked candidates</div>
        {anomaly.candidates.map((c, i) => (
          <CandidateCard
            key={c.rank}
            candidate={c}
            onClick={() => {
              // Map candidate to a graph node id deterministically by rank.
              const nodeId =
                anomaly.relatedChannelIds[i] != null
                  ? `ch-${anomaly.relatedChannelIds[i]}`
                  : `cand-${c.rank}`;
              selectGraphNode(nodeId);
            }}
          />
        ))}
      </div>
    </div>
  );
}
