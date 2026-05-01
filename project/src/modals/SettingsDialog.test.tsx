/**
 * SettingsDialog (US-2-007e) — RTL tests for FULL implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from './SettingsDialog';
import { useUiStore } from '../store/uiStore';
import { useIntegrationStore } from '../store/integrationStore';

beforeEach(() => {
  useUiStore.getState().reset();
  useIntegrationStore.getState().reset();
});

describe('modals/SettingsDialog (US-2-007e FULL)', () => {
  it('renders title, theme selector, keymap selector, and offline mode group', () => {
    render(<SettingsDialog isOpen onClose={() => {}} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('sd-theme')).toBeInTheDocument();
    expect(screen.getByTestId('sd-keymap')).toBeInTheDocument();
    expect(screen.getByTestId('sd-offline-group')).toBeInTheDocument();
  });

  it('theme select: changing to "light" updates uiStore.theme', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog isOpen onClose={() => {}} />);
    const select = screen.getByTestId('sd-theme') as HTMLSelectElement;
    expect(select.value).toBe('dark');
    await user.selectOptions(select, 'light');
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('keymap select: changing to "vim" updates uiStore.keymapPreset', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog isOpen onClose={() => {}} />);
    const select = screen.getByTestId('sd-keymap') as HTMLSelectElement;
    await user.selectOptions(select, 'vim');
    expect(useUiStore.getState().keymapPreset).toBe('vim');
  });

  it('offline mode: default is "offline-preferred"; selecting "airgapped" updates integrationStore', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog isOpen onClose={() => {}} />);
    // default
    expect(
      (screen.getByTestId('sd-offline-radio-offline-preferred') as HTMLInputElement).checked
    ).toBe(true);
    // click airgapped
    await user.click(screen.getByTestId('sd-offline-radio-airgapped'));
    expect(useIntegrationStore.getState().offlineAssets.mode).toBe('airgapped');
    expect(
      (screen.getByTestId('sd-offline-radio-airgapped') as HTMLInputElement).checked
    ).toBe(true);
  });

  it('offline mode: selecting "online-allowed" updates integrationStore', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('sd-offline-radio-online-allowed'));
    expect(useIntegrationStore.getState().offlineAssets.mode).toBe('online-allowed');
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsDialog isOpen onClose={onClose} />);
    await user.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC key calls onClose via modal', () => {
    const onClose = vi.fn();
    render(<SettingsDialog isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
