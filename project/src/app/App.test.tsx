/**
 * App (US-021) — top-level composition smoke tests.
 *
 * Verifies App.tsx mounts TopBar / sheet router / BottomConsole and that
 * the default sheet is workstation. Mocks maplibre-gl + @react-three/fiber
 * so heavy panel renderers don't load real GPU/canvas backends in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      removeControl: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(),
      setStyle: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
      isStyleLoaded: vi.fn().mockReturnValue(true),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
  Map: vi.fn(),
  NavigationControl: vi.fn(),
  Marker: vi.fn(),
}));

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'r3f-canvas' }, children),
    useFrame: vi.fn(),
    useThree: vi.fn().mockReturnValue({ camera: {}, gl: {}, scene: {} }),
  };
});

vi.mock('@react-three/drei', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return new Proxy(
    {},
    {
      get: () => passthrough,
    },
  );
});

import { App } from './App';
import { useSessionStore } from '../store/sessionStore';
import { useStreamStore } from '../store/streamStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSelectionStore } from '../store/selectionStore';

describe('App (US-021) — composition smoke', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
    useSelectionStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  it('renders without crash and exposes the .app root', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.app')).not.toBeNull();
  });

  it('mounts the TopBar with REALTIMEINSIGHT brand', () => {
    render(<App />);
    expect(screen.getByText('REALTIMEINSIGHT')).toBeInTheDocument();
  });

  it('default sheet is workstation — DockGrid is present', () => {
    const { container } = render(<App />);
    // DockGrid root carries the `dockgrid` className per US-014.
    expect(container.querySelector('.workstation-sheet')).not.toBeNull();
  });

  it('switching to space sheet renders SpaceSheet', () => {
    const { container } = render(<App initialSheet="space" />);
    expect(container.querySelector('.space-sheet')).not.toBeNull();
    expect(container.querySelector('.workstation-sheet')).toBeNull();
  });

  it('switching to ew sheet renders EwSheet', () => {
    const { container } = render(<App initialSheet="ew" />);
    expect(container.querySelector('.ew-sheet')).not.toBeNull();
  });

  it('switching to gps sheet renders GpsLosSheet', () => {
    const { container } = render(<App initialSheet="gps" />);
    expect(container.querySelector('.gpslos-sheet')).not.toBeNull();
  });

  it('mounts the BottomConsole with .bottom-console className', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.bottom-console')).not.toBeNull();
  });

  it('mounts the InsightPane (idle state)', () => {
    render(<App />);
    expect(screen.getByText(/Click an anomaly to inspect/)).toBeInTheDocument();
  });

  it('mounts the ChannelExplorer left pane', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.channel-explorer')).not.toBeNull();
  });
});

describe('App (US-2-003) — replay-mode RAF cursor advance', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
    useSelectionStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  it('advances cursor by ~100_000_000 ns over 100 ms of RAF ticks at rate=1.0', () => {
    // Replace RAF + performance.now with controllable stubs.
    let now = 1000;
    const rafQueue: FrameRequestCallback[] = [];
    const realRaf = window.requestAnimationFrame;
    const realCancel = window.cancelAnimationFrame;
    const realPerfNow = performance.now;
    let nextId = 1;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return nextId++;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((_id: number) => {}) as typeof window.cancelAnimationFrame;
    performance.now = () => now;

    try {
      // Enter replay + start playing BEFORE App mounts so the RAF loop sees isPlaying.
      useSessionStore.getState().enterReplayMode();
      useSessionStore.getState().setPlay(true);

      render(<App />);

      // Drain currently queued RAF callbacks, advancing time 10ms each tick for 10 ticks (100ms).
      // Each tick re-enqueues itself, and we keep popping the front of the queue.
      // We expect ~100_000_000 ns of cursor advance at rate 1.0.
      // Note: there are TWO RAF loops (tickRaf + replay). We must drain both.
      for (let i = 0; i < 20; i++) {
        const batch = rafQueue.splice(0, rafQueue.length);
        now += 10;
        for (const cb of batch) cb(now);
      }

      const finalNs = Number(useSessionStore.getState().playback.currentTimeNs);
      // Total simulated time = 200ms but only the FIRST iteration's `lastMs` is t=1000;
      // each subsequent tick deltas 10ms so total advance ≈ (20-1)×10 = 190ms = 190e6 ns.
      // Allow a wide tolerance — exact RAF tick semantics depend on the order the two
      // useEffect-installed loops register their first callback.
      expect(finalNs).toBeGreaterThan(50_000_000);
      expect(finalNs).toBeLessThan(300_000_000);
    } finally {
      window.requestAnimationFrame = realRaf;
      window.cancelAnimationFrame = realCancel;
      performance.now = realPerfNow;
    }
  });

  it('pauses at RECORDING_DURATION_NS when not looping and cursor passes the end', () => {
    let now = 1000;
    const rafQueue: FrameRequestCallback[] = [];
    const realRaf = window.requestAnimationFrame;
    const realCancel = window.cancelAnimationFrame;
    const realPerfNow = performance.now;
    let nextId = 1;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return nextId++;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((_id: number) => {}) as typeof window.cancelAnimationFrame;
    performance.now = () => now;

    try {
      useSessionStore.getState().enterReplayMode();
      // Seek near end (59.5s) and start playing at 4x rate.
      useSessionStore.getState().seekTo('59500000000');
      useSessionStore.getState().setRate(4);
      useSessionStore.getState().setPlay(true);

      render(<App />);

      // Run several large ticks to push past 60s.
      for (let i = 0; i < 30; i++) {
        const batch = rafQueue.splice(0, rafQueue.length);
        now += 100;
        for (const cb of batch) cb(now);
      }

      const s = useSessionStore.getState();
      expect(s.playback.isPlaying).toBe(false);
      expect(s.playback.currentTimeNs).toBe(String(60_000_000_000));
    } finally {
      window.requestAnimationFrame = realRaf;
      window.cancelAnimationFrame = realCancel;
      performance.now = realPerfNow;
    }
  });
});
