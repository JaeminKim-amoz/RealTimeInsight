/**
 * Attitude3DPanel (US-017d) — RTL tests.
 *
 * @react-three/fiber Canvas is mocked to a div so jsdom doesn't try to spin up
 * WebGL. Pure rotation math has its own coverage in orientation.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: () => {},
  useThree: () => ({ camera: {}, gl: {} }),
}));

import { Attitude3DPanel } from './Attitude3DPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-att',
    kind: 'attitude3d',
    title: 'Attitude Test',
    layoutNodeId: 'ln-1',
    bindings: [
      { type: 'channel', channelId: 2210 },
      { type: 'channel', channelId: 2211 },
      { type: 'channel', channelId: 2212 },
    ],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/attitude3d/Attitude3DPanel (US-017d)', () => {
  it('renders a panel-body adi root container', () => {
    const { container } = render(
      <Attitude3DPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.adi')).not.toBeNull();
  });

  it('mounts the (mocked) R3F Canvas', () => {
    render(<Attitude3DPanel panel={makePanel()} mode="live" />);
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
  });

  it('renders the readout overlay with roll/pitch/yaw labels', () => {
    const { container } = render(
      <Attitude3DPanel panel={makePanel()} mode="live" />
    );
    const readout = container.querySelector('.att-readout');
    expect(readout).not.toBeNull();
    expect(readout?.textContent).toMatch(/ROLL/);
    expect(readout?.textContent).toMatch(/PITCH/);
    expect(readout?.textContent).toMatch(/YAW/);
  });

  it('mounts in replay mode without throwing', () => {
    expect(() =>
      render(<Attitude3DPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
