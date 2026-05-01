/**
 * SpectrumPanel (US-2-006a) — RTL tests.
 *
 * Heavy canvas-draw logic is exercised in spectrum-render.test.ts; here we
 * verify the React wrapper contract: className, canvas mount, header readouts.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SpectrumPanel } from './SpectrumPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-spectrum',
    kind: 'spectrum-rf',
    title: 'Spectrum',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/rf/SpectrumPanel (US-2-006a)', () => {
  it('renders a panel-body spectrum-rf root container', () => {
    const { container } = render(
      <SpectrumPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.spectrum-rf')).not.toBeNull();
  });

  it('renders a canvas element', () => {
    const { container } = render(
      <SpectrumPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('shows header chrome with default Center/Span/Ref readouts', () => {
    const { container } = render(
      <SpectrumPanel panel={makePanel()} mode="live" />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Center');
    expect(text).toContain('Span');
    expect(text).toContain('Ref');
    expect(text).toContain('1500'); // default centerFreqMhz
    expect(text).toContain('500'); // default spanMhz
    expect(text).toContain('-30'); // default refLevelDbm
  });

  it('honors panel.options overrides', () => {
    const { container } = render(
      <SpectrumPanel
        panel={makePanel({
          options: { centerFreqMhz: 2400, spanMhz: 100, refLevelDbm: -20 },
        })}
        mode="live"
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('2400');
    expect(text).toContain('100');
    expect(text).toContain('-20');
  });

  it('shows RBW, VBW, sweep time, peak markers (M1/M2)', () => {
    const { container } = render(
      <SpectrumPanel panel={makePanel()} mode="live" />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('RBW');
    expect(text).toContain('VBW');
    expect(text).toContain('M1');
    expect(text).toContain('M2');
  });

  it('invokes canvas.getContext("2d") on mount', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<SpectrumPanel panel={makePanel()} mode="live" />);
    expect(getContextSpy).toHaveBeenCalled();
    getContextSpy.mockRestore();
  });

  it('mounts with replay mode without throwing', () => {
    expect(() =>
      render(<SpectrumPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
