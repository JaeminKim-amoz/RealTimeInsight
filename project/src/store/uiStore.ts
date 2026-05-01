/**
 * UiStore — UI-only preferences slice (US-2-007d).
 *
 * Stores developer-mode tweaks that affect the UI only and are never
 * transmitted to the backend: theme, density, relation-graph layout,
 * and devMode flag.  Not persisted to localStorage; reset on store init.
 */

import { create } from 'zustand';

export type AppTheme = 'dark' | 'light' | 'high-contrast';
export type UiDensity = 'compact' | 'normal' | 'spacious';
export type RelationGraphLayout = 'force' | 'hierarchy' | 'radial';
export type KeymapPreset = 'default' | 'vim' | 'emacs';

export interface UiPreferences {
  theme: AppTheme;
  density: UiDensity;
  relationGraphLayout: RelationGraphLayout;
  keymapPreset: KeymapPreset;
  devMode: boolean;
}

export interface UiStoreState extends UiPreferences {
  setTheme: (theme: AppTheme) => void;
  setDensity: (density: UiDensity) => void;
  setRelationGraphLayout: (layout: RelationGraphLayout) => void;
  setKeymapPreset: (keymap: KeymapPreset) => void;
  setDevMode: (devMode: boolean) => void;
  reset: () => void;
}

const INITIAL: UiPreferences = {
  theme: 'dark',
  density: 'normal',
  relationGraphLayout: 'force',
  keymapPreset: 'default',
  devMode: false,
};

export const useUiStore = create<UiStoreState>((set) => ({
  ...INITIAL,
  setTheme: (theme) => set({ theme }),
  setDensity: (density) => set({ density }),
  setRelationGraphLayout: (layout) => set({ relationGraphLayout: layout }),
  setKeymapPreset: (keymapPreset) => set({ keymapPreset }),
  setDevMode: (devMode) => set({ devMode }),
  reset: () => set({ ...INITIAL }),
}));
