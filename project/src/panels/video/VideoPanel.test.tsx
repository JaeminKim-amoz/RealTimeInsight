/**
 * VideoPanel (US-017c) — RTL tests.
 *
 * Video element is a placeholder in slice 1. We assert a placeholder element
 * + a telemetry overlay strip whose timecode reflects globalCursorNs (Critic
 * C4 cursor sync).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { VideoPanel } from './VideoPanel';
import { useSelectionStore } from '../../store/selectionStore';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-video',
    kind: 'video',
    title: 'Video Test',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/video/VideoPanel (US-017c)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders a panel-body video root container', () => {
    const { container } = render(
      <VideoPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.video')).not.toBeNull();
  });

  it('renders the video placeholder (no real source in slice 1)', () => {
    render(<VideoPanel panel={makePanel()} mode="live" />);
    expect(screen.getByTestId('video-placeholder')).toBeInTheDocument();
  });

  it('renders a telemetry overlay strip', () => {
    render(<VideoPanel panel={makePanel()} mode="live" />);
    expect(screen.getByTestId('video-overlay')).toBeInTheDocument();
  });

  it('overlay shows the current cursor time when globalCursorNs is set', () => {
    useSelectionStore.getState().setGlobalCursor('1500000000');
    render(<VideoPanel panel={makePanel()} mode="live" />);
    const overlay = screen.getByTestId('video-overlay');
    // Should reflect time = 1.500s formatted
    expect(overlay.textContent).toMatch(/1\.500/);
  });

  it('overlay updates when globalCursorNs changes (Critic C4)', () => {
    render(<VideoPanel panel={makePanel()} mode="live" />);
    act(() => {
      useSelectionStore.getState().setGlobalCursor('2750000000');
    });
    const overlay = screen.getByTestId('video-overlay');
    expect(overlay.textContent).toMatch(/2\.750/);
  });

  it('overlay shows placeholder dash when cursor is null', () => {
    useSelectionStore.getState().setGlobalCursor(null);
    render(<VideoPanel panel={makePanel()} mode="live" />);
    const overlay = screen.getByTestId('video-overlay');
    expect(overlay.textContent).toMatch(/—/);
  });
});
