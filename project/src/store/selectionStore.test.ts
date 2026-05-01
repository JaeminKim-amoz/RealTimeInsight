import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selectionStore';

describe('store/selectionStore', () => {
  beforeEach(() => useSelectionStore.getState().reset());

  it('initial state empty', () => {
    const s = useSelectionStore.getState();
    expect(s.selectedChannelIds).toEqual([]);
    expect(s.selectedPanelId).toBeNull();
    expect(s.selectedAnomalyId).toBeNull();
    expect(s.linkedCursorEnabled).toBe(true); // default ON per spec UX
    expect(s.globalCursorNs).toBeNull();
  });

  it('selectChannel additive=false replaces', () => {
    useSelectionStore.getState().selectChannel(1001, false);
    useSelectionStore.getState().selectChannel(1002, false);
    expect(useSelectionStore.getState().selectedChannelIds).toEqual([1002]);
  });

  it('selectChannel additive=true accumulates', () => {
    useSelectionStore.getState().selectChannel(1001, true);
    useSelectionStore.getState().selectChannel(1002, true);
    expect(useSelectionStore.getState().selectedChannelIds.sort()).toEqual([1001, 1002]);
  });

  it('selectChannel additive=true toggles existing id off', () => {
    useSelectionStore.getState().selectChannel(1001, true);
    useSelectionStore.getState().selectChannel(1001, true);
    expect(useSelectionStore.getState().selectedChannelIds).toEqual([]);
  });

  it('selectAnomaly + selectPanel + setGlobalCursor', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    useSelectionStore.getState().selectPanel('p1');
    useSelectionStore.getState().setGlobalCursor('182340000000');
    const s = useSelectionStore.getState();
    expect(s.selectedAnomalyId).toBe('anom-001');
    expect(s.selectedPanelId).toBe('p1');
    expect(s.globalCursorNs).toBe('182340000000');
  });

  it('toggleLinkedCursor flips flag', () => {
    expect(useSelectionStore.getState().linkedCursorEnabled).toBe(true);
    useSelectionStore.getState().toggleLinkedCursor();
    expect(useSelectionStore.getState().linkedCursorEnabled).toBe(false);
    useSelectionStore.getState().toggleLinkedCursor();
    expect(useSelectionStore.getState().linkedCursorEnabled).toBe(true);
  });

  it('clearChannelSelection empties the array', () => {
    useSelectionStore.getState().selectChannel(1001, true);
    useSelectionStore.getState().selectChannel(1002, true);
    useSelectionStore.getState().clearChannelSelection();
    expect(useSelectionStore.getState().selectedChannelIds).toEqual([]);
  });
});
