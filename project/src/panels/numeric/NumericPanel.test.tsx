/**
 * NumericPanel (US-016b) — RTL tests.
 *
 * Renders one tile per channel binding. Each tile shows display name, current
 * value (2-decimal format), unit, and a min/avg/max meta line. Power Bus
 * #1001 in live mode shows "Bridge offline" stale indicator when the
 * stream buffer is empty.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { NumericPanel } from './NumericPanel';
import { useSessionStore } from '../../store/sessionStore';
import type { PanelInstance } from '../../types/domain';

function makePanel(channelIds: number[]): PanelInstance {
  return {
    id: 'p-numeric',
    kind: 'numeric',
    title: 'Numeric Test',
    layoutNodeId: 'ln-2',
    bindings: channelIds.map((channelId) => ({ type: 'channel', channelId })),
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
  };
}

describe('panels/numeric/NumericPanel (US-016b)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('renders a panel-body numeric-grid root container', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1001, 1002])} mode="live" />
    );
    expect(container.querySelector('.panel-body.numeric-grid')).not.toBeNull();
  });

  it('renders 6 tiles for a 6-binding panel', () => {
    const { container } = render(
      <NumericPanel
        panel={makePanel([1001, 1002, 1003, 1004, 1005, 1206])}
        mode="live"
      />
    );
    const tiles = container.querySelectorAll('.numeric-tile');
    expect(tiles.length).toBe(6);
  });

  it('renders the channel display name in each tile', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1001])} mode="live" />
    );
    const tile = container.querySelector('.numeric-tile') as HTMLElement;
    expect(tile.textContent).toContain('Bus Voltage 28V');
  });

  it('formats the current value to 2 decimals with the channel unit', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1001])} mode="live" />
    );
    const valEl = container.querySelector('.numeric-tile .tile-val') as HTMLElement;
    // value text follows pattern "<num>.<2 decimals>" + unit "V"
    expect(valEl.textContent).toMatch(/-?\d+\.\d{2}/);
    expect(valEl.textContent).toContain('V');
  });

  it('renders sample-rate badge for each binding', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1001])} mode="live" />
    );
    // 1001 has sampleRateHz = 200
    const badge = container.querySelector('.numeric-tile .rate-badge') as HTMLElement;
    expect(badge?.textContent).toContain('200');
  });

  it('skips bindings whose channelId does not resolve to a channel', () => {
    const panel = makePanel([1001]);
    panel.bindings.push({ type: 'channel', channelId: 999999 });
    const { container } = render(<NumericPanel panel={panel} mode="live" />);
    const tiles = container.querySelectorAll('.numeric-tile');
    expect(tiles.length).toBe(1);
  });

  it('shows "Bridge offline" stale indicator on tile #1001 when no buffer is present', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1001])} mode="live" />
    );
    const stale = container.querySelector('.numeric-tile[data-channel-id="1001"] .stale-indicator');
    expect(stale).not.toBeNull();
  });

  it('attaches alarm class to alarm-armed channel tile (1205)', () => {
    const { container } = render(
      <NumericPanel panel={makePanel([1205])} mode="live" />
    );
    const tile = container.querySelector('.numeric-tile') as HTMLElement;
    expect(tile.className).toContain('alarm-armed');
  });
});
