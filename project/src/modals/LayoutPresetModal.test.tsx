/**
 * LayoutPresetModal (US-2-004a) — RTL tests for FULL implementation.
 *
 * Tests the 3-tab gallery: Factory Presets / My Workspaces / Team · Shared.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutPresetModal } from './LayoutPresetModal';
import { useWorkspaceStore } from '../store/workspaceStore';
import { buildFactoryPresets } from '../store/presets/layoutPresets';

describe('modals/LayoutPresetModal (US-2-004a FULL)', () => {
  beforeEach(() => {
    // Reset workspace store and seed with factory presets only.
    const factory = buildFactoryPresets();
    useWorkspaceStore.setState({
      workspaceId: null,
      workspaceName: null,
      layoutTree: null,
      panels: {},
      presets: factory,
      dirty: false,
    });
  });

  it('renders three tabs: Factory Presets / My Workspaces / Team · Shared', () => {
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('layout-tab-factory')).toBeInTheDocument();
    expect(screen.getByTestId('layout-tab-saved')).toBeInTheDocument();
    expect(screen.getByTestId('layout-tab-shared')).toBeInTheDocument();
  });

  it('Factory Presets tab shows 6 preset cards by default', () => {
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    const cards = screen.getAllByTestId(/^layout-preset-card-/);
    expect(cards).toHaveLength(6);
    expect(screen.getByText('Flight Analysis')).toBeInTheDocument();
    expect(screen.getByText('RF / Spectrum')).toBeInTheDocument();
    expect(screen.getByText('Integrated Map + Video')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Triage')).toBeInTheDocument();
    expect(screen.getByText('Mission Rehearsal')).toBeInTheDocument();
    expect(screen.getByText('Engineering Check')).toBeInTheDocument();
  });

  it('clicking a factory preset card calls loadPreset and closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LayoutPresetModal isOpen onClose={onClose} />);
    await user.click(screen.getByTestId('layout-preset-card-rf-spectrum'));
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBe('rf-spectrum');
    expect(state.layoutTree).not.toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('switching to My Workspaces shows non-factory presets only', async () => {
    const user = userEvent.setup();
    // Add a saved workspace.
    useWorkspaceStore.setState((s) => ({
      presets: [
        ...s.presets,
        {
          id: 'user-saved-1',
          label: 'My custom workspace',
          layoutTree: { type: 'flat-grid', id: 'g1', columns: 1, rows: 1, cells: [] },
          panels: {},
        },
      ],
    }));
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('layout-tab-saved'));
    expect(screen.getByText('My custom workspace')).toBeInTheDocument();
    // Factory presets should NOT appear in saved tab.
    expect(screen.queryByText('Flight Analysis')).not.toBeInTheDocument();
  });

  it('rename inline edit updates the preset label', async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState((s) => ({
      presets: [
        ...s.presets,
        {
          id: 'user-saved-r',
          label: 'before',
          layoutTree: { type: 'flat-grid', id: 'g1', columns: 1, rows: 1, cells: [] },
          panels: {},
        },
      ],
    }));
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('layout-tab-saved'));
    await user.click(screen.getByTestId('rename-user-saved-r'));
    const input = screen.getByTestId('rename-input-user-saved-r') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'after');
    fireEvent.blur(input);
    const state = useWorkspaceStore.getState();
    const target = state.presets.find((p) => p.id === 'user-saved-r');
    expect(target?.label).toBe('after');
  });

  it('delete button removes the preset from the list', async () => {
    const user = userEvent.setup();
    useWorkspaceStore.setState((s) => ({
      presets: [
        ...s.presets,
        {
          id: 'user-saved-d',
          label: 'doomed',
          layoutTree: { type: 'flat-grid', id: 'g1', columns: 1, rows: 1, cells: [] },
          panels: {},
        },
      ],
    }));
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('layout-tab-saved'));
    expect(screen.getByText('doomed')).toBeInTheDocument();
    await user.click(screen.getByTestId('delete-user-saved-d'));
    const state = useWorkspaceStore.getState();
    expect(state.presets.find((p) => p.id === 'user-saved-d')).toBeUndefined();
  });

  it('Team · Shared tab lists 3 mock shared workspaces', async () => {
    const user = userEvent.setup();
    render(<LayoutPresetModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('layout-tab-shared'));
    const rows = screen.getAllByTestId(/^shared-row-/);
    expect(rows).toHaveLength(3);
    expect(screen.getByText('sortie-0420 post-debrief')).toBeInTheDocument();
    expect(screen.getByText('link-budget-0918')).toBeInTheDocument();
    expect(screen.getByText('CRC cluster analysis')).toBeInTheDocument();
  });

  it('clicking a shared workspace loads its layoutTree and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LayoutPresetModal isOpen onClose={onClose} />);
    await user.click(screen.getByTestId('layout-tab-shared'));
    const row = screen.getByTestId('shared-row-shared-debrief-0420');
    await user.click(within(row).getByText('Load'));
    const state = useWorkspaceStore.getState();
    expect(state.layoutTree).not.toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});
