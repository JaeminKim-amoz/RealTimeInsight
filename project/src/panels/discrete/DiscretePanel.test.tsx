/**
 * DiscretePanel (US-016c) — RTL tests.
 *
 * Renders one row per discrete channel binding with a state-bar timeline.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiscretePanel } from './DiscretePanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(channelIds: number[]): PanelInstance {
  return {
    id: 'p-disc',
    kind: 'discrete',
    title: 'Discrete Test',
    layoutNodeId: 'ln-3',
    bindings: channelIds.map((channelId) => ({ type: 'channel', channelId })),
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
  };
}

describe('panels/discrete/DiscretePanel (US-016c)', () => {
  it('renders a panel-body discrete-rows root container', () => {
    // 1006/1007/1008/1210 are all type:'discrete' channels
    const { container } = render(
      <DiscretePanel panel={makePanel([1006, 1007, 1008, 1210])} />
    );
    expect(container.querySelector('.panel-body.discrete-rows')).not.toBeNull();
  });

  it('renders 4 rows for a 4-binding discrete panel', () => {
    const { container } = render(
      <DiscretePanel panel={makePanel([1006, 1007, 1008, 1210])} />
    );
    const rows = container.querySelectorAll('.discrete-row');
    expect(rows.length).toBe(4);
  });

  it('each row contains a state-bar element', () => {
    const { container } = render(
      <DiscretePanel panel={makePanel([1006, 1007, 1008, 1210])} />
    );
    const rows = container.querySelectorAll('.discrete-row');
    rows.forEach((row) => {
      expect(row.querySelector('.state-bar')).not.toBeNull();
    });
  });

  it('each row renders the channel display name', () => {
    const { container } = render(
      <DiscretePanel panel={makePanel([1007])} />
    );
    const row = container.querySelector('.discrete-row') as HTMLElement;
    expect(row.textContent).toContain('PDU BIT');
  });

  it('each row renders a current-state label', () => {
    const { container } = render(
      <DiscretePanel panel={makePanel([1007])} />
    );
    const cur = container.querySelector('.discrete-row .cur-state');
    expect(cur).not.toBeNull();
  });

  it('skips non-discrete bindings (analog channels are excluded)', () => {
    // 1001 is analog → should not produce a row
    const panel = makePanel([1001, 1006]);
    const { container } = render(<DiscretePanel panel={panel} />);
    const rows = container.querySelectorAll('.discrete-row');
    expect(rows.length).toBe(1);
  });

  it('renders empty state when there are no discrete bindings', () => {
    const { container } = render(<DiscretePanel panel={makePanel([])} />);
    expect(container.querySelector('.panel-body.discrete-rows.empty')).not.toBeNull();
  });

  it('state-bar contains at least one segment with a left/width inline style', () => {
    const { container } = render(
      <DiscretePanel panel={makePanel([1006])} />
    );
    const seg = container.querySelector('.state-bar .state-seg') as HTMLElement;
    expect(seg).not.toBeNull();
    expect(seg.style.left).not.toBe('');
    expect(seg.style.width).not.toBe('');
  });
});
