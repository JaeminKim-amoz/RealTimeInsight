/**
 * StripChartPanel (US-016a) — RTL tests.
 *
 * Heavy canvas-draw logic is exercised in render.test.ts; here we only verify
 * the React wrapper contract: className, empty-state, and anomaly-marker
 * passthrough hook.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StripChartPanel } from './StripChartPanel';
import { useSelectionStore } from '../../store/selectionStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStreamStore } from '../../store/streamStore';
import { RECORDED_BUFFER } from '../../mock/recording';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-strip',
    kind: 'strip',
    title: 'Strip Test',
    layoutNodeId: 'ln-1',
    bindings: [
      { type: 'channel', channelId: 1001 },
      { type: 'channel', channelId: 1002 },
    ],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/strip/StripChartPanel (US-016a)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders a panel-body strip root container', () => {
    const { container } = render(
      <StripChartPanel panel={makePanel()} mode="live" />
    );
    const root = container.querySelector('.panel-body.strip');
    expect(root).not.toBeNull();
  });

  it('renders a canvas element when bindings are present', () => {
    const { container } = render(
      <StripChartPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('canvas.strip-chart')).not.toBeNull();
  });

  it('renders empty state when there are no channel bindings', () => {
    const empty = makePanel({ bindings: [] });
    const { container } = render(<StripChartPanel panel={empty} mode="live" />);
    expect(container.querySelector('.panel-body.strip.empty')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders a legend item per channel binding', () => {
    const { container } = render(
      <StripChartPanel panel={makePanel()} mode="live" />
    );
    const items = container.querySelectorAll('.legend .legend-item');
    expect(items.length).toBe(2);
  });

  it('attaches data-anomaly-active when anomaly anom-001 is selected and 1205 is bound', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    const panel = makePanel({
      bindings: [{ type: 'channel', channelId: 1205 }],
    });
    const { container } = render(<StripChartPanel panel={panel} mode="live" />);
    const root = container.querySelector('.panel-body.strip') as HTMLElement;
    expect(root.dataset.anomalyActive).toBe('true');
  });

  it('does NOT attach data-anomaly-active when 1205 binding is absent', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    const { container } = render(
      <StripChartPanel panel={makePanel()} mode="live" />
    );
    const root = container.querySelector('.panel-body.strip') as HTMLElement;
    expect(root.dataset.anomalyActive).not.toBe('true');
  });

  it('invokes canvas.getContext("2d") on mount', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<StripChartPanel panel={makePanel()} mode="live" />);
    expect(getContextSpy).toHaveBeenCalled();
    getContextSpy.mockRestore();
  });

  it('shows "Bridge offline" placeholder when panel #1001 has no buffer in live mode', () => {
    const panel = makePanel({
      id: '1001',
      bindings: [{ type: 'channel', channelId: 1001 }],
    });
    const { container } = render(<StripChartPanel panel={panel} mode="live" />);
    expect(container.querySelector('.bridge-offline')).not.toBeNull();
  });
});

describe('panels/strip/StripChartPanel — replay-mode binding (US-2-003)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
  });

  it('renders strip canvas using RECORDED_BUFFER values when appMode === "replay"', () => {
    // The strip panel slices SAMPLE_COUNT (600) frames ending at the playback
    // cursor; the legend value reflects the LAST (right-edge) sample. At
    // cursor=0 the cursorIdx is 0 so the window is [0..600) and the last
    // sample shown is recorded[599], NOT recorded[0].
    useSessionStore.getState().setAppMode('replay');
    useSessionStore.getState().setCursor('0');
    const panel = makePanel({
      bindings: [{ type: 'channel', channelId: 1001 }],
    });
    const { container } = render(<StripChartPanel panel={panel} mode="replay" />);
    expect(container.querySelector('canvas.strip-chart')).not.toBeNull();

    // The right-edge sample of the visible window in replay mode at cursor=0
    // is recorded[Math.min(SAMPLE_COUNT - 1, recorded.length - 1)] = recorded[599].
    const expected = RECORDED_BUFFER[1001][599].value.toFixed(2);
    const legendVal = container.querySelector('.legend .legend-item .val') as HTMLElement;
    expect(legendVal.textContent).toContain(expected);
  });

  it('seek to mid-fixture (30s) updates legend value to the matching RECORDED_BUFFER frame', () => {
    useSessionStore.getState().setAppMode('replay');
    // 30s at 200Hz = sample index 6000. The window is [5401..6001), legend
    // shows recorded[6000].
    useSessionStore.getState().setCursor('30000000000');
    const panel = makePanel({
      bindings: [{ type: 'channel', channelId: 1001 }],
    });
    const { container } = render(<StripChartPanel panel={panel} mode="replay" />);
    const expected = RECORDED_BUFFER[1001][6000].value.toFixed(2);
    const legendVal = container.querySelector('.legend .legend-item .val') as HTMLElement;
    expect(legendVal.textContent).toContain(expected);
  });

  it('does NOT show bridge-offline placeholder when in replay mode', () => {
    useSessionStore.getState().setAppMode('replay');
    const panel = makePanel({
      id: '1001',
      bindings: [{ type: 'channel', channelId: 1001 }],
    });
    const { container } = render(<StripChartPanel panel={panel} mode="live" />);
    expect(container.querySelector('.bridge-offline')).toBeNull();
  });
});
