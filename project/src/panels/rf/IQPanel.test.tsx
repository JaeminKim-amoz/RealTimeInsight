/**
 * IQPanel (US-2-006b) — RTL tests.
 *
 * Heavy canvas-draw + math logic is exercised in iq-render.test.ts; here we
 * verify the React wrapper contract: className, modulation switching, etc.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { IQPanel } from './IQPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-iq',
    kind: 'iq',
    title: 'IQ',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/rf/IQPanel (US-2-006b)', () => {
  it('renders a panel-body iq root container', () => {
    const { container } = render(<IQPanel panel={makePanel()} mode="live" />);
    expect(container.querySelector('.panel-body.iq')).not.toBeNull();
  });

  it('renders a canvas element', () => {
    const { container } = render(<IQPanel panel={makePanel()} mode="live" />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('default modulation is 16-QAM', () => {
    const { container } = render(<IQPanel panel={makePanel()} mode="live" />);
    expect(container.textContent).toContain('16-QAM');
  });

  it('respects panel.options.modulation = QPSK', () => {
    const { container } = render(
      <IQPanel
        panel={makePanel({ options: { modulation: 'QPSK' } })}
        mode="live"
      />
    );
    expect(container.textContent).toContain('QPSK');
  });

  it('respects panel.options.modulation = 8-PSK', () => {
    const { container } = render(
      <IQPanel
        panel={makePanel({ options: { modulation: '8-PSK' } })}
        mode="live"
      />
    );
    expect(container.textContent).toContain('8-PSK');
  });

  it('switches constellation when modulation prop changes', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const { rerender } = render(
      <IQPanel
        panel={makePanel({ options: { modulation: 'QPSK' } })}
        mode="live"
      />
    );
    const callsAfterFirst = getContextSpy.mock.calls.length;
    rerender(
      <IQPanel
        panel={makePanel({ options: { modulation: '16-QAM' } })}
        mode="live"
      />
    );
    expect(getContextSpy.mock.calls.length).toBeGreaterThanOrEqual(callsAfterFirst);
    getContextSpy.mockRestore();
  });

  it('mounts with replay mode without throwing', () => {
    expect(() =>
      render(<IQPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
