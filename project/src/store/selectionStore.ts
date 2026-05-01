/**
 * SelectionStore — owns user selection: channels, panel focus, anomaly anchor,
 * graph node, hover/selected point, linked cursor, global timestamp.
 *
 * Spec §8.3. Per Critic C4 fix, panels render-side observe globalCursorNs +
 * linkedCursorEnabled to draw cursor lines / move markers / jump video frames.
 */

import { create } from 'zustand';

export interface SelectedPoint {
  panelId: string;
  channelId: number;
  timestampNs: string;
  rawValue?: string | number;
  engValue?: number;
  qualityFlags: string[];
  frameId?: string;
  sampleIndex?: number;
  anomalyId?: string;
}

export interface SelectionStoreState {
  selectedChannelIds: number[];
  selectedPanelId: string | null;
  selectedAnomalyId: string | null;
  selectedGraphNodeId: string | null;
  selectedPoint: SelectedPoint | null;
  hoverPoint: SelectedPoint | null;
  linkedCursorEnabled: boolean;
  globalCursorNs: string | null;

  selectChannel: (channelId: number, additive: boolean) => void;
  clearChannelSelection: () => void;
  selectPanel: (panelId: string | null) => void;
  selectAnomaly: (anomalyId: string | null) => void;
  selectGraphNode: (nodeId: string | null) => void;
  setSelectedPoint: (point: SelectedPoint | null) => void;
  setHoverPoint: (point: SelectedPoint | null) => void;
  toggleLinkedCursor: () => void;
  setGlobalCursor: (timeNs: string | null) => void;
  reset: () => void;
}

const INITIAL = {
  selectedChannelIds: [] as number[],
  selectedPanelId: null,
  selectedAnomalyId: null,
  selectedGraphNodeId: null,
  selectedPoint: null,
  hoverPoint: null,
  linkedCursorEnabled: true,
  globalCursorNs: null,
};

export const useSelectionStore = create<SelectionStoreState>((set) => ({
  ...INITIAL,

  selectChannel: (channelId, additive) =>
    set((s) => {
      if (!additive) {
        return { selectedChannelIds: [channelId] };
      }
      const exists = s.selectedChannelIds.includes(channelId);
      return {
        selectedChannelIds: exists
          ? s.selectedChannelIds.filter((id) => id !== channelId)
          : [...s.selectedChannelIds, channelId],
      };
    }),

  clearChannelSelection: () => set({ selectedChannelIds: [] }),
  selectPanel: (id) => set({ selectedPanelId: id }),
  selectAnomaly: (id) => set({ selectedAnomalyId: id }),
  selectGraphNode: (id) => set({ selectedGraphNodeId: id }),
  setSelectedPoint: (p) => set({ selectedPoint: p }),
  setHoverPoint: (p) => set({ hoverPoint: p }),
  toggleLinkedCursor: () => set((s) => ({ linkedCursorEnabled: !s.linkedCursorEnabled })),
  setGlobalCursor: (timeNs) => set({ globalCursorNs: timeNs }),
  reset: () => set({ ...INITIAL }),
}));
