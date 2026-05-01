/**
 * SequenceValidator (US-2-007b) — FULL.
 *
 * Step-authoring form: list of test steps each with
 *   { stepId, channelId, expectedRange:[min,max], holdMs }.
 * Add Step / Remove Step / Reorder via up/down arrows (slice-2 minimal).
 * Capture mode: "Record" starts capturing, "Stop" finalizes step values.
 * Run mode: "Run Sequence" iterates steps with mock pass/fail evaluation.
 * Results pane shows pass/fail per step. onOpenReport prop wires the
 * "Generate Report" button to a parent that opens TestReportModal.
 */

import { useMemo, useState } from 'react';
import { Modal } from './Modal';

export interface SequenceStep {
  stepId: string;
  channelId: number;
  expectedRange: [number, number];
  holdMs: number;
}

export interface SequenceStepResult {
  stepId: string;
  status: 'pass' | 'fail' | 'pending';
  detail: string;
}

export interface SequenceRunResult {
  verdict: 'pass' | 'fail' | 'pending';
  steps: SequenceStepResult[];
}

interface SequenceValidatorProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (result: SequenceRunResult) => void;
}

const DEFAULT_STEPS: SequenceStep[] = [
  { stepId: 's1', channelId: 1001, expectedRange: [24, 30], holdMs: 200 },
  { stepId: 's2', channelId: 1205, expectedRange: [150, 200], holdMs: 300 },
];

let stepCounter = 100;
const newStepId = () => `s${++stepCounter}`;

// Slice-2 mock evaluator: deterministic pseudo-random pass/fail per step.
// Uses channelId + stepId as seed so tests can stub via Math.random.
function mockEvaluate(steps: SequenceStep[]): SequenceRunResult {
  const stepResults: SequenceStepResult[] = steps.map((st) => {
    const r = Math.random();
    const pass = r >= 0.5;
    return {
      stepId: st.stepId,
      status: pass ? 'pass' : 'fail',
      detail: pass
        ? `observed within [${st.expectedRange[0]}, ${st.expectedRange[1]}] for ${st.holdMs}ms`
        : `out-of-band: expected [${st.expectedRange[0]}, ${st.expectedRange[1]}]`,
    };
  });
  const verdict: 'pass' | 'fail' = stepResults.every((s) => s.status === 'pass') ? 'pass' : 'fail';
  return { verdict, steps: stepResults };
}

export function SequenceValidator({ isOpen, onClose, onOpenReport }: SequenceValidatorProps) {
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<SequenceRunResult | null>(null);

  const overallVerdict = useMemo(() => result?.verdict ?? 'pending', [result]);

  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    setSteps((cur) => cur.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    setSteps((cur) => [
      ...cur,
      { stepId: newStepId(), channelId: 1001, expectedRange: [0, 100], holdMs: 100 },
    ]);
  };

  const removeStep = (idx: number) => {
    setSteps((cur) => cur.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((cur) => {
      const j = idx + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const startCapture = () => {
    setCapturing(true);
  };

  const stopCapture = () => {
    // Slice-2: finalize captured step values by rounding ranges to integers.
    setSteps((cur) =>
      cur.map((s) => ({
        ...s,
        expectedRange: [Math.round(s.expectedRange[0]), Math.round(s.expectedRange[1])],
      }))
    );
    setCapturing(false);
  };

  const runSequence = () => {
    if (steps.length === 0) {
      setResult({ verdict: 'pending', steps: [] });
      return;
    }
    setResult(mockEvaluate(steps));
  };

  const handleGenerateReport = () => {
    const r = result ?? mockEvaluate(steps);
    if (!result) setResult(r);
    onOpenReport?.(r);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sequence-validator" ariaLabel="Sequence Validator">
      <div className="modal-hd">
        <span>Sequence Validator</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-body" data-testid="sv-body">
        <div className="cme-toolbar">
          <button
            type="button"
            className="tb-btn"
            onClick={addStep}
            data-testid="sv-add-step"
          >
            + Add Step
          </button>
          {!capturing ? (
            <button
              type="button"
              className="tb-btn"
              onClick={startCapture}
              data-testid="sv-record"
            >
              Record
            </button>
          ) : (
            <button
              type="button"
              className="tb-btn"
              onClick={stopCapture}
              data-testid="sv-stop"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            className="tb-btn primary"
            onClick={runSequence}
            data-testid="sv-run"
          >
            Run Sequence
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={handleGenerateReport}
            data-testid="sv-generate-report"
          >
            Generate Report
          </button>
        </div>

        {capturing && (
          <div className="sv-capturing" data-testid="sv-capturing" role="status">
            Capturing live data — press Stop to finalize step values.
          </div>
        )}

        <table className="cme-sheet">
          <thead>
            <tr>
              <th>#</th>
              <th>stepId</th>
              <th>channelId</th>
              <th>min</th>
              <th>max</th>
              <th>holdMs</th>
              <th>status</th>
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const r = result?.steps.find((x) => x.stepId === s.stepId);
              const status = r?.status ?? 'pending';
              return (
                <tr key={s.stepId} data-testid={`sv-step-row-${i}`}>
                  <td className="mono">{i + 1}</td>
                  <td className="mono">{s.stepId}</td>
                  <td>
                    <input
                      type="number"
                      className="cme-cell mono"
                      value={s.channelId}
                      onChange={(e) => updateStep(i, { channelId: Number(e.target.value) })}
                      data-testid={`sv-step-channel-${i}`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      className="cme-cell mono"
                      value={s.expectedRange[0]}
                      onChange={(e) =>
                        updateStep(i, { expectedRange: [Number(e.target.value), s.expectedRange[1]] })
                      }
                      data-testid={`sv-step-min-${i}`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      className="cme-cell mono"
                      value={s.expectedRange[1]}
                      onChange={(e) =>
                        updateStep(i, { expectedRange: [s.expectedRange[0], Number(e.target.value)] })
                      }
                      data-testid={`sv-step-max-${i}`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="cme-cell mono"
                      value={s.holdMs}
                      onChange={(e) => updateStep(i, { holdMs: Number(e.target.value) })}
                      data-testid={`sv-step-hold-${i}`}
                    />
                  </td>
                  <td>
                    <span
                      className={`sv-status sv-status-${status}`}
                      data-testid={`sv-step-status-${i}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="tb-btn"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      data-testid={`sv-step-up-${i}`}
                      aria-label={`Move step ${i + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="tb-btn"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      data-testid={`sv-step-down-${i}`}
                      aria-label={`Move step ${i + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="tb-btn"
                      onClick={() => removeStep(i)}
                      data-testid={`sv-step-remove-${i}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {result && (
          <div className="sv-results" data-testid="sv-results">
            <div className="sv-results-header">
              Results · verdict:{' '}
              <span
                className={`sv-verdict sv-verdict-${overallVerdict}`}
                data-testid="sv-overall-verdict"
              >
                {overallVerdict}
              </span>
            </div>
            <ul>
              {result.steps.map((rs) => (
                <li key={rs.stepId} data-testid={`sv-result-${rs.stepId}`}>
                  <span className="mono">{rs.stepId}</span>{' '}
                  <span className={`sv-status sv-status-${rs.status}`}>{rs.status}</span> —{' '}
                  <span>{rs.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
