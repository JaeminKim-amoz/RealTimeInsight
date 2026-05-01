import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './sessionStore';
import { useStreamStore } from './streamStore';
import { RECORDED_CHANNEL_IDS } from '../mock/recording';

describe('store/sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
  });

  it('initial state — Live mode, not playing, ingest fields zero', () => {
    const s = useSessionStore.getState();
    expect(s.appMode).toBe('live');
    expect(s.activeProjectId).toBeNull();
    expect(s.activeRunId).toBeNull();
    expect(s.playback.isPlaying).toBe(false);
    expect(s.playback.rate).toBe(1);
    expect(s.ingest.sourceConnected).toBe(false);
    expect(s.ingest.packetRateHz).toBe(0);
  });

  it('setAppMode toggles between live and replay; resets playback.isPlaying', () => {
    const { setAppMode, togglePlay } = useSessionStore.getState();
    togglePlay(); // start playing in live
    expect(useSessionStore.getState().playback.isPlaying).toBe(true);
    setAppMode('replay');
    expect(useSessionStore.getState().appMode).toBe('replay');
    expect(useSessionStore.getState().playback.isPlaying).toBe(false); // reset on mode switch
  });

  it('setRate clamps non-finite values', () => {
    useSessionStore.getState().setRate(2);
    expect(useSessionStore.getState().playback.rate).toBe(2);
    useSessionStore.getState().setRate(NaN);
    expect(useSessionStore.getState().playback.rate).toBe(2); // unchanged
  });

  it('setCursor updates currentTimeNs', () => {
    useSessionStore.getState().setCursor('182340000000');
    expect(useSessionStore.getState().playback.currentTimeNs).toBe('182340000000');
  });

  it('updateIngest applies partial patches', () => {
    useSessionStore.getState().updateIngest({ sourceConnected: true, packetRateHz: 3247 });
    const s = useSessionStore.getState();
    expect(s.ingest.sourceConnected).toBe(true);
    expect(s.ingest.packetRateHz).toBe(3247);
    expect(s.ingest.crcFailRate).toBe(0); // untouched
  });
});

describe('store/sessionStore — replay mode (US-2-003)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
  });

  it('enterReplayMode flips appMode to "replay" and resets cursor + isPlaying', () => {
    useSessionStore.getState().setCursor('99999');
    useSessionStore.getState().setPlay(true);
    useSessionStore.getState().enterReplayMode();
    const s = useSessionStore.getState();
    expect(s.appMode).toBe('replay');
    expect(s.playback.currentTimeNs).toBe('0');
    expect(s.playback.isPlaying).toBe(false);
  });

  it('enterReplayMode hydrates streamStore buffers for all 9 recorded channels', () => {
    useSessionStore.getState().enterReplayMode();
    const stream = useStreamStore.getState();
    // One subscription registered per channel under panelId `replay-fixture-<id>`.
    for (const channelId of RECORDED_CHANNEL_IDS) {
      const refs = stream.panelDataRefs[`replay-fixture-${channelId}`];
      expect(refs).toBeDefined();
      expect(refs.length).toBe(1);
      const subId = refs[0];
      const buf = stream.buffers[subId];
      expect(buf).toBeDefined();
      // 60s × 200Hz = 12 000 frames per channel.
      expect(buf.length).toBe(12_000);
    }
  });

  it('exitReplayMode restores live mode and clears playback transport', () => {
    useSessionStore.getState().enterReplayMode();
    useSessionStore.getState().setPlay(true);
    useSessionStore.getState().setCursor('30000000000');
    useSessionStore.getState().exitReplayMode();
    const s = useSessionStore.getState();
    expect(s.appMode).toBe('live');
    expect(s.playback.isPlaying).toBe(false);
    expect(s.playback.currentTimeNs).toBe('0');
    expect(s.playback.rate).toBe(1);
  });

  it('seekTo updates currentTimeNs without flipping appMode or isPlaying', () => {
    useSessionStore.getState().enterReplayMode();
    useSessionStore.getState().setPlay(true);
    useSessionStore.getState().seekTo('30000000000'); // jump to 30s
    const s = useSessionStore.getState();
    expect(s.appMode).toBe('replay');
    expect(s.playback.currentTimeNs).toBe('30000000000');
    expect(s.playback.isPlaying).toBe(true);
  });
});
