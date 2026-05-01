/**
 * ChannelMappingEditor (US-2-004c) — RTL tests for FULL implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelMappingEditor } from './ChannelMappingEditor';
import { useWorkspaceStore } from '../store/workspaceStore';

describe('modals/ChannelMappingEditor (US-2-004c FULL)', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it('renders the spreadsheet grid with header columns', () => {
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    // 8 expected columns from spec
    expect(screen.getByText('channelId')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('displayName')).toBeInTheDocument();
    expect(screen.getByText('group')).toBeInTheDocument();
    expect(screen.getByText('channelType')).toBeInTheDocument();
    expect(screen.getByText('sampleRateHz')).toBeInTheDocument();
    expect(screen.getByText('qualityPolicy')).toBeInTheDocument();
    expect(screen.getByText('formula')).toBeInTheDocument();
  });

  it('inline edits a cell via Enter and marks workspace dirty', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    expect(useWorkspaceStore.getState().dirty).toBe(false);
    const cell = screen.getByTestId('cme-cell-1001-displayName');
    await user.click(cell);
    const input = screen.getByTestId('cme-edit-1001-displayName') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'New Bus Voltage{Enter}');
    expect(screen.getByTestId('cme-cell-1001-displayName').textContent).toContain('New Bus Voltage');
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it('search box filters rows by name', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    const search = screen.getByTestId('cme-search') as HTMLInputElement;
    await user.type(search, 'hyd_pressure_1');
    // Row exists.
    expect(screen.getByTestId('cme-row-1205')).toBeInTheDocument();
    // Other channel filtered out.
    expect(screen.queryByTestId('cme-row-1001')).not.toBeInTheDocument();
  });

  it('Add Row button opens form and adds a row when submitted', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('cme-add-btn'));
    const nameInput = screen.getByTestId('cme-add-name') as HTMLInputElement;
    const groupInput = screen.getByTestId('cme-add-group') as HTMLInputElement;
    await user.type(nameInput, 'new_channel_x');
    await user.type(groupInput, 'Test');
    await user.click(screen.getByTestId('cme-add-submit'));
    // New row appears (channelId is auto-assigned to max+1).
    const newRow = screen.getAllByText('new_channel_x');
    expect(newRow.length).toBeGreaterThan(0);
    expect(newRow[0]).toBeInTheDocument();
  });

  it('Delete Row button removes a row after confirm', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    expect(screen.getByTestId('cme-row-1001')).toBeInTheDocument();
    await user.click(screen.getByTestId('cme-delete-1001'));
    // Confirm modal opens.
    expect(screen.getByTestId('cme-confirm-delete')).toBeInTheDocument();
    await user.click(screen.getByTestId('cme-confirm-delete'));
    expect(screen.queryByTestId('cme-row-1001')).not.toBeInTheDocument();
  });

  it('search filters by group as well', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    const search = screen.getByTestId('cme-search') as HTMLInputElement;
    await user.type(search, 'Hydraulic');
    expect(screen.getByTestId('cme-row-1205')).toBeInTheDocument();
    expect(screen.queryByTestId('cme-row-1001')).not.toBeInTheDocument();
  });

  it('Import/Export CSV buttons trigger placeholder messages', async () => {
    const user = userEvent.setup();
    render(<ChannelMappingEditor isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('cme-export-csv'));
    expect(screen.getByTestId('cme-message')).toHaveTextContent(/export/i);
    await user.click(screen.getByTestId('cme-import-csv'));
    expect(screen.getByTestId('cme-message')).toHaveTextContent(/import/i);
  });
});
