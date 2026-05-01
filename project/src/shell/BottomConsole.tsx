/**
 * BottomConsole (US-015) — bottom status strip with ingest, performance,
 * alarm count, and LLM-readiness readouts. Visual port of public/app/shell.jsx
 * BottomConsole, wired to the live Zustand stores.
 */

import { useSessionStore } from '../store/sessionStore';
import { useStreamStore } from '../store/streamStore';
import { useIntegrationStore } from '../store/integrationStore';
import { EVENTS } from '../mock/events';

const HIGH_ALARM_COUNT = EVENTS.filter((e) => e.severity === 'high').length;

function formatInt(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatPct(rate: number): string {
  // Stored as 0..1 ratio; render as XX.XX%.
  return `${(rate * 100).toFixed(2)}%`;
}

interface MetricProps {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'alarm';
}

function Metric({ label, value, tone }: MetricProps) {
  const toneClass = tone ? ` ${tone}` : '';
  return (
    <span className="metric">
      <span className="m-label">{label}</span>
      <span className={`m-val mono${toneClass}`}>{value}</span>
    </span>
  );
}

export function BottomConsole() {
  const ingest = useSessionStore((s) => s.ingest);
  const uiFps = useStreamStore((s) => s.performance.uiFps);
  const llm = useIntegrationStore((s) => s.llm);

  const crcTone: MetricProps['tone'] = ingest.crcFailRate * 100 > 0.5 ? 'warn' : undefined;

  return (
    <div className="bottom-console console">
      <Metric label="pkt/s" value={formatInt(ingest.packetRateHz)} tone="ok" />
      <span className="divider" />
      <Metric label="frame/s" value={formatInt(ingest.frameRateHz)} />
      <span className="divider" />
      <Metric label="CRC fail" value={formatPct(ingest.crcFailRate)} tone={crcTone} />
      <span className="divider" />
      <Metric label="sync loss" value={String(ingest.syncLossCount)} />
      <span className="divider" />
      <Metric label="alarms" value={String(HIGH_ALARM_COUNT)} tone="alarm" />
      <span className="divider" />
      <Metric label="FPS" value={String(Math.round(uiFps))} />
      <span className="divider" />
      <Metric
        label="LLM"
        value={`${llm.modelId} · ${llm.provider === 'local-ollama' ? 'local' : llm.provider}`}
        tone={llm.ready ? 'ok' : undefined}
      />
    </div>
  );
}
