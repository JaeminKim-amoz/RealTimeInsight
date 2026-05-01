/**
 * LLMDrawer (US-2-004b) — FULL.
 *
 * Right-anchored drawer with chat thread + suggested prompts strip + tool-trace
 * expandables + citation-gated assistant turns. Uses the mock LLM provider
 * (no real HTTP) and reads selectedAnomalyId from selectionStore to seed the
 * 'Why this anomaly?' quick action and derive requiredEvidenceIds for the
 * citation gate (spec §17).
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { useSelectionStore } from '../store/selectionStore';
import {
  askLlm,
  requiredEvidenceForAnomaly,
  SUGGESTED_PROMPTS,
  type LlmResponse,
} from '../llm/mockProvider';

interface LLMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  llmResponse?: LlmResponse;
  /** Required evidence ids the assistant turn must cite. */
  requiredEvidenceIds?: string[];
}

export function LLMDrawer({ isOpen, onClose }: LLMDrawerProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<Set<number>>(new Set());

  const selectedAnomalyId = useSelectionStore((s) => s.selectedAnomalyId);
  const requiredIds = requiredEvidenceForAnomaly(selectedAnomalyId);

  const citationGatePass = (resp: LlmResponse, required: string[]): boolean => {
    if (required.length === 0) return true;
    const cited = new Set(resp.citedEvidenceIds);
    return required.every((id) => cited.has(id));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userTurn: ChatTurn = { role: 'user', text: trimmed };
    setTurns((cur) => [...cur, userTurn]);
    setInput('');
    setBusy(true);
    try {
      const resp = await askLlm(trimmed, { requiredEvidenceIds: requiredIds });
      const assistantTurn: ChatTurn = {
        role: 'assistant',
        text: resp.answer,
        llmResponse: resp,
        requiredEvidenceIds: requiredIds.slice(),
      };
      setTurns((cur) => [...cur, assistantTurn]);
    } finally {
      setBusy(false);
    }
  };

  const toggleTrace = (idx: number) => {
    setExpandedTrace((cur) => {
      const next = new Set(cur);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleQuickWhy = () => {
    if (selectedAnomalyId) {
      setInput(`Why this anomaly? (id=${selectedAnomalyId})`);
    } else {
      setInput('Why this anomaly?');
    }
  };

  // Send button disabled when input is empty or while busy. Per spec §17, the
  // citation gate requirement also disables sending when the prior assistant
  // turn was flagged as missing citations and the user hasn't acted on it.
  const lastAssistantFailedGate = (() => {
    const last = [...turns].reverse().find((t) => t.role === 'assistant');
    if (!last || !last.llmResponse || !last.requiredEvidenceIds) return false;
    return !citationGatePass(last.llmResponse, last.requiredEvidenceIds);
  })();

  const sendDisabled = busy || input.trim().length === 0 || lastAssistantFailedGate;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="llm-drawer drawer-right" ariaLabel="LLM Drawer">
      <div className="modal-hd llm-drawer-hd">
        <span>Mission Assistant</span>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
          data-testid="llm-close"
        >
          ×
        </button>
      </div>

      <div className="llm-drawer-body" data-testid="llm-body">
        {turns.length === 0 && (
          <div className="llm-empty">Ask about a channel, anomaly, or run.</div>
        )}
        {turns.map((t, idx) => {
          if (t.role === 'user') {
            return (
              <div key={idx} className="llm-turn llm-user-turn" data-testid={`llm-user-turn-${idx}`}>
                <span className="llm-role">JW</span>
                <span className="llm-text">{t.text}</span>
              </div>
            );
          }
          // Assistant turn: figure out gate, render trace + evidence chips.
          const reqIds = t.requiredEvidenceIds ?? [];
          const cited = new Set(t.llmResponse?.citedEvidenceIds ?? []);
          const passed = reqIds.length === 0 || reqIds.every((id) => cited.has(id));
          const aIdx = turns.slice(0, idx).filter((x) => x.role === 'assistant').length;
          const traceExpanded = expandedTrace.has(aIdx);
          return (
            <div
              key={idx}
              className={`llm-turn llm-assistant-turn ${passed ? '' : 'llm-citation-fail'}`}
              data-testid={`llm-assistant-turn-${aIdx}`}
            >
              <span className="llm-role">AI</span>
              <div className="llm-assistant-body">
                <div className="llm-text">{t.text}</div>
                {!passed && (
                  <div
                    className="llm-citation-warning"
                    data-testid={`llm-citation-warning-${aIdx}`}
                  >
                    missing citations · need {reqIds.length} evidence id(s)
                  </div>
                )}
                {t.llmResponse && (
                  <>
                    <button
                      type="button"
                      className="llm-tooltrace-toggle"
                      onClick={() => toggleTrace(aIdx)}
                      data-testid={`llm-tooltrace-toggle-${aIdx}`}
                    >
                      {traceExpanded ? '▾' : '▸'} tool trace · {t.llmResponse.toolTrace.length} calls
                    </button>
                    {traceExpanded && (
                      <div
                        className="llm-tooltrace-panel"
                        data-testid={`llm-tooltrace-panel-${aIdx}`}
                      >
                        {t.llmResponse.toolTrace.map((tc, tIdx) => (
                          <div key={tIdx} className="llm-tooltrace-row">
                            <span className="mono llm-tool-name">{tc.name}</span>
                            <span className="mono llm-tool-args">
                              ({Object.entries(tc.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
                            </span>
                            <span className="mono llm-tool-ms">{tc.ms}ms</span>
                            <span className="mono llm-tool-result">→ {tc.result}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.llmResponse.citedEvidenceIds.length > 0 && (
                      <div className="llm-evidence-chips">
                        {t.llmResponse.citedEvidenceIds.map((id) => (
                          <span key={id} className="llm-evidence-chip">
                            {id}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="llm-busy" data-testid="llm-busy">
            running tools…
          </div>
        )}
      </div>

      <div className="llm-drawer-footer">
        <div className="llm-prompt-strip">
          <button
            type="button"
            className="tb-btn"
            onClick={handleQuickWhy}
            data-testid="llm-quick-why"
          >
            Why this anomaly? (auto)
          </button>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              className="tb-btn"
              onClick={() => setInput(p)}
              data-testid={`llm-prompt-${p}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="llm-input-row">
          <textarea
            className="llm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about a channel, anomaly, or run…"
            rows={2}
            data-testid="llm-input"
          />
          <button
            type="button"
            className="tb-btn primary"
            disabled={sendDisabled}
            onClick={() => send(input)}
            data-testid="llm-send"
          >
            Send
          </button>
        </div>
      </div>
    </Modal>
  );
}
