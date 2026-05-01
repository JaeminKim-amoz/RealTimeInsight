/**
 * App (US-021) — top-level composition for the RealTimeInsight workstation.
 *
 * Layout: <TopBar /> + <Body /> + <BottomConsole /> + <ModalLayer /> + <CommandPalette />
 * where Body = LeftSidebar (ChannelExplorer) + Sheet (Workstation/Space/Ew/Gps) + InsightPane.
 *
 * Mounts:
 *  - bridge bootstrap (only when running under tauri:dev — `globalThis.__TAURI__` defined)
 *  - global RAF loop fanning out to useStreamStore.tickRaf()
 *  - global Cmd+K listener to open <CommandPalette/>
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar, type SheetId } from '../shell/TopBar';
import { ChannelExplorer } from '../shell/ChannelExplorer';
import { InsightPane } from '../shell/InsightPane';
import { BottomConsole } from '../shell/BottomConsole';
import { WorkstationSheet } from '../sheets/WorkstationSheet';
import { SpaceSheet } from '../sheets/SpaceSheet';
import { EwSheet } from '../sheets/EwSheet';
import { GpsLosSheet } from '../sheets/GpsLosSheet';
import { CommandPalette } from '../modals/CommandPalette';
import { ExportModal } from '../modals/ExportModal';
import { MatlabModal } from '../modals/MatlabModal';
import { LLMDrawer } from '../modals/LLMDrawer';
import { LayoutPresetModal } from '../modals/LayoutPresetModal';
import { SettingsDialog } from '../modals/SettingsDialog';
import { RecordingLibrary } from '../modals/RecordingLibrary';
import { TweaksPanel } from '../modals/TweaksPanel';
import { useSessionStore } from '../store/sessionStore';
import { useStreamStore } from '../store/streamStore';
import { createBridgeClient } from '../bridge/client';
import { RECORDING_DURATION_NS } from '../mock/recording';

type ModalId =
  | 'export'
  | 'matlab'
  | 'llm'
  | 'layout'
  | 'settings'
  | 'library'
  | 'tweaks';

function isTauriEnv(): boolean {
  return Boolean(globalThis.__TAURI__?.core?.invoke);
}

interface AppProps {
  /** Test hook — initial sheet selection (defaults to 'workstation'). */
  initialSheet?: SheetId;
}

export function App({ initialSheet = 'workstation' }: AppProps = {}) {
  const [activeSheet, setActiveSheet] = useState<SheetId>(initialSheet);
  const [openModals, setOpenModals] = useState<Set<ModalId>>(new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);

  const appMode = useSessionStore((s) => s.appMode);
  const tickRaf = useStreamStore((s) => s.tickRaf);

  const toggleModal = useCallback((id: ModalId, open?: boolean) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      const shouldOpen = open ?? !next.has(id);
      if (shouldOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const closeModal = useCallback((id: ModalId) => toggleModal(id, false), [toggleModal]);

  // Cmd+K → open palette (CommandPalette also installs its own ↑↓/Enter listeners).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Global RAF loop → tickRaf() once per frame (single-fire per requestAnimationFrame).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    let rafId = 0;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      tickRaf();
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [tickRaf]);

  // Replay-mode RAF loop (US-2-003): when appMode === 'replay' and isPlaying,
  // advance playback.currentTimeNs by (deltaMs × 1e6 × rate). Wrap to 0 when
  // the cursor passes RECORDING_DURATION_NS if loopEnabled, otherwise pause.
  useEffect(() => {
    if (appMode !== 'replay') return;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    let rafId = 0;
    let cancelled = false;
    let lastMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const loop = () => {
      if (cancelled) return;
      const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const deltaMs = nowMs - lastMs;
      lastMs = nowMs;
      const session = useSessionStore.getState();
      if (session.appMode === 'replay' && session.playback.isPlaying) {
        const advance = deltaMs * 1_000_000 * session.playback.rate;
        const next = Number(session.playback.currentTimeNs) + advance;
        if (next > RECORDING_DURATION_NS) {
          if (session.playback.loopEnabled) {
            session.seekTo('0');
          } else {
            session.seekTo(String(RECORDING_DURATION_NS));
            session.setPlay(false);
          }
        } else {
          session.seekTo(String(Math.round(next)));
        }
      }
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [appMode]);

  // Bridge bootstrap — only when tauri runtime is present. Browser-dev relies on
  // panel-internal placeholders / mock generators (per Critic C3).
  const bridgeStarted = useRef(false);
  useEffect(() => {
    if (bridgeStarted.current) return;
    if (!isTauriEnv()) return;
    bridgeStarted.current = true;
    try {
      const bridge = createBridgeClient();
      bridge
        .startManagedReceiverLoop({
          channelIds: [1001, 8001, 1205],
          expectedBitrateMbps: 30,
        })
        .catch(() => {
          // Bridge failures are non-fatal in slice 1; status surfaces in BottomConsole.
        });
    } catch {
      // createBridgeClient throws when invoke is unavailable. Ignore: browser dev.
    }
  }, []);

  return (
    <div className="app" data-theme="warm" data-density="compact" data-app-mode={appMode}>
      <TopBar
        activeSheet={activeSheet}
        onSheetChange={setActiveSheet}
        onOpenExport={() => toggleModal('export', true)}
        onOpenMatlab={() => toggleModal('matlab', true)}
        onOpenLLM={() => toggleModal('llm', true)}
        onOpenLayout={() => toggleModal('layout', true)}
        onOpenSettings={() => toggleModal('settings', true)}
        onOpenLibrary={() => toggleModal('library', true)}
        onOpenTweaks={() => toggleModal('tweaks', true)}
      />

      <div className="body" data-screen-label="Body">
        <ChannelExplorer />
        <div className="workspace" data-screen-label="Workspace">
          {activeSheet === 'workstation' ? <WorkstationSheet mode={appMode} /> : null}
          {activeSheet === 'space' ? <SpaceSheet mode={appMode} /> : null}
          {activeSheet === 'ew' ? <EwSheet mode={appMode} /> : null}
          {activeSheet === 'gps' ? <GpsLosSheet mode={appMode} /> : null}
        </div>
        <InsightPane />
      </div>

      <BottomConsole />

      <ExportModal isOpen={openModals.has('export')} onClose={() => closeModal('export')} />
      <MatlabModal isOpen={openModals.has('matlab')} onClose={() => closeModal('matlab')} />
      <LLMDrawer isOpen={openModals.has('llm')} onClose={() => closeModal('llm')} />
      <LayoutPresetModal isOpen={openModals.has('layout')} onClose={() => closeModal('layout')} />
      <SettingsDialog isOpen={openModals.has('settings')} onClose={() => closeModal('settings')} />
      <RecordingLibrary isOpen={openModals.has('library')} onClose={() => closeModal('library')} />
      <TweaksPanel isOpen={openModals.has('tweaks')} onClose={() => closeModal('tweaks')} />

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
