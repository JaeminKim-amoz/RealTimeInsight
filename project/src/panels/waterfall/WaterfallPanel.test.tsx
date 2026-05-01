/**
 * WaterfallPanel (US-017a) — RTL tests.
 *
 * Heavy canvas-draw logic is exercised in render.test.ts; here we only verify
 * the React wrapper contract: className and canvas mount.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WaterfallPanel } from './WaterfallPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-waterfall',
    kind: 'waterfall',
    title: 'Waterfall Test',
    layoutNodeId: 'ln-1',
    bindings: [{ type: 'channel', channelId: 5001 }],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/waterfall/WaterfallPanel (US-017a)', () => {
  it('renders a panel-body waterfall root container', () => {
    const { container } = render(
      <WaterfallPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.waterfall')).not.toBeNull();
  });

  it('renders a canvas element', () => {
    const { container } = render(
      <WaterfallPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('canvas.waterfall-body')).not.toBeNull();
  });

  it('invokes canvas.getContext("2d") on mount', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<WaterfallPanel panel={makePanel()} mode="live" />);
    expect(getContextSpy).toHaveBeenCalled();
    getContextSpy.mockRestore();
  });

  it('mounts with replay mode without throwing', () => {
    expect(() =>
      render(<WaterfallPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
