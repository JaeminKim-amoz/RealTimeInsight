/**
 * Trajectory3DPanel (US-017e) — RTL tests.
 *
 * @react-three/fiber Canvas is mocked. Pure geometry math has its own coverage
 * in geometry.test.ts. We assert mount + helper integration.
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

import { Trajectory3DPanel } from './Trajectory3DPanel';
import { buildTrackGeometry } from './geometry';
import { TRACK_POINTS } from '../../mock/trackPoints';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-traj',
    kind: 'trajectory3d',
    title: 'Trajectory Test',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/trajectory3d/Trajectory3DPanel (US-017e)', () => {
  it('renders a panel-body trajectory3d root container', () => {
    const { container } = render(
      <Trajectory3DPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.trajectory3d')).not.toBeNull();
  });

  it('mounts the (mocked) R3F Canvas', () => {
    render(<Trajectory3DPanel panel={makePanel()} mode="live" />);
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
  });

  it('helper buildTrackGeometry produces 3 floats per track point', () => {
    const arr = buildTrackGeometry(TRACK_POINTS);
    expect(arr.length).toBe(TRACK_POINTS.length * 3);
  });

  it('mounts in replay mode without throwing', () => {
    expect(() =>
      render(<Trajectory3DPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
