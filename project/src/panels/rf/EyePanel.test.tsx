/**
 * EyePanel (US-2-006c) — RTL tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EyePanel } from './EyePanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-eye',
    kind: 'eye',
    title: 'Eye Diagram',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/rf/EyePanel (US-2-006c)', () => {
  it('renders a panel-body eye root container', () => {
    const { container } = render(<EyePanel panel={makePanel()} mode="live" />);
    expect(container.querySelector('.panel-body.eye')).not.toBeNull();
  });

  it('renders a canvas element', () => {
    const { container } = render(<EyePanel panel={makePanel()} mode="live" />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('renders eye-diagram chrome (Eye Diagram label)', () => {
    const { container } = render(<EyePanel panel={makePanel()} mode="live" />);
    expect(container.textContent).toContain('Eye');
  });

  it('invokes canvas.getContext("2d") on mount', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<EyePanel panel={makePanel()} mode="live" />);
    expect(getContextSpy).toHaveBeenCalled();
    getContextSpy.mockRestore();
  });

  it('mounts with replay mode without throwing', () => {
    expect(() =>
      render(<EyePanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
