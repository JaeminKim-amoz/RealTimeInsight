/**
 * SessionStore — owns application mode (live/replay), playback transport,
 * ingest health snapshot. Spec §8.2.
 *
 * StreamStore (US-006) holds per-channel buffers + subscriptions; SessionStore
 * holds only the time/mode/health-readout primitives.
 */

import { create } from 'zustand';
import { loadRecordingIntoStreamStore } from '../mock/recording';

export type AppMode = 'live' | 'replay';

export interface PlaybackState {
  isPlaying: boolean;
  rate: number;
  currentTimeNs: string;
  selectionRange: [string, string] | null;
  loopEnabled: boolean;
}

export interface IngestSnapshot {
  sourceConnected: boolean;
  packetRateHz: number;
  frameRateHz: number;
  crcFailRate: number;
  syncLossCount: number;
}

export interface SessionStoreState {
  appMode: AppMode;
  activeProjectId: string | null;
  activeRunId: string | null;
  playback: PlaybackState;
  ingest: IngestSnapshot;

  setAppMode: (mode: AppMode) => void;
  setActiveProject: (id: string | null) => void;
  setActiveRun: (id: string | null) => void;
  togglePlay: () => void;
  setPlay: (isPlaying: boolean) => void;
  setRate: (rate: number) => void;
  setCursor: (timeNs: string) => void;
  setSelectionRange: (range: [string, string] | null) => void;
  setLoopEnabled: (enabled: boolean) => void;
  updateIngest: (patch: Partial<IngestSnapshot>) => void;
  /** US-2-003: enter replay mode and hydrate streamStore from RECORDED_BUFFER. */
  enterReplayMode: () => void;
  /** US-2-003: leave replay mode, reset transport, return to live (synthesizer) source. */
  exitReplayMode: () => void;
  /** US-2-003: scrub-bar / transport seek — sets cursor and emits a hint for panels to refresh. */
  seekTo: (timeNs: string) => void;
  reset: () => void;
}

const INITIAL_PLAYBACK: PlaybackState = {
  isPlaying: false,
  rate: 1,
  currentTimeNs: '0',
  selectionRange: null,
  loopEnabled: false,
};

const INITIAL_INGEST: IngestSnapshot = {
  sourceConnected: false,
  packetRateHz: 0,
  frameRateHz: 0,
  crcFailRate: 0,
  syncLossCount: 0,
};

export const useSessionStore = create<SessionStoreState>((set) => ({
  appMode: 'live',
  activeProjectId: null,
  activeRunId: null,
  playback: { ...INITIAL_PLAYBACK },
  ingest: { ...INITIAL_INGEST },

  setAppMode: (mode) =>
    set((s) => ({
      appMode: mode,
      // Reset playback isPlaying on mode switch (live↔replay) per spec semantics.
      playback: { ...s.playback, isPlaying: false },
    })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setActiveRun: (id) => set({ activeRunId: id }),
  togglePlay: () => set((s) => ({ playback: { ...s.playback, isPlaying: !s.playback.isPlaying } })),
  setPlay: (isPlaying) => set((s) => ({ playback: { ...s.playback, isPlaying } })),
  setRate: (rate) =>
    set((s) => (Number.isFinite(rate) && rate > 0 ? { playback: { ...s.playback, rate } } : s)),
  setCursor: (timeNs) => set((s) => ({ playback: { ...s.playback, currentTimeNs: timeNs } })),
  setSelectionRange: (range) => set((s) => ({ playback: { ...s.playback, selectionRange: range } })),
  setLoopEnabled: (enabled) => set((s) => ({ playback: { ...s.playback, loopEnabled: enabled } })),
  updateIngest: (patch) => set((s) => ({ ingest: { ...s.ingest, ...patch } })),
  enterReplayMode: () => {
    loadRecordingIntoStreamStore();
    set({
      appMode: 'replay',
      playback: { ...INITIAL_PLAYBACK, currentTimeNs: '0', isPlaying: false },
    });
  },
  exitReplayMode: () =>
    set({
      appMode: 'live',
      playback: { ...INITIAL_PLAYBACK },
    }),
  seekTo: (timeNs) =>
    set((s) => ({
      playback: { ...s.playback, currentTimeNs: timeNs },
    })),
  reset: () =>
    set({
      appMode: 'live',
      activeProjectId: null,
      activeRunId: null,
      playback: { ...INITIAL_PLAYBACK },
      ingest: { ...INITIAL_INGEST },
    }),
}));
