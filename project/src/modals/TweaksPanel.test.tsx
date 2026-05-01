/**
 * TweaksPanel (US-2-007d) — RTL tests for FULL implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TweaksPanel } from './TweaksPanel';
import { useUiStore } from '../store/uiStore';

beforeEach(() => {
  useUiStore.getState().reset();
});

describe('modals/TweaksPanel (US-2-007d FULL)', () => {
  it('renders panel title and all three tweak groups', () => {
    render(<TweaksPanel isOpen onClose={() => {}} />);
    expect(screen.getByText('Tweaks')).toBeInTheDocument();
    expect(screen.getByTestId('tweak-theme-group')).toBeInTheDocument();
    expect(screen.getByTestId('tweak-density-group')).toBeInTheDocument();
    expect(screen.getByTestId('tweak-graph-layout')).toBeInTheDocument();
  });

  it('theme picker: clicking Light sets uiStore.theme to "light"', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('tweak-theme-light'));
    expect(useUiStore.getState().theme).toBe('light');
    expect(screen.getByTestId('tweak-theme-light')).toHaveClass('on');
    expect(screen.getByTestId('tweak-theme-dark')).not.toHaveClass('on');
  });

  it('density toggle: clicking Compact sets uiStore.density to "compact"', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('tweak-density-compact'));
    expect(useUiStore.getState().density).toBe('compact');
    expect(screen.getByTestId('tweak-density-compact')).toHaveClass('on');
  });

  it('relation-graph layout selector: changing to Hierarchy updates uiStore', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel isOpen onClose={() => {}} />);
    const select = screen.getByTestId('tweak-graph-layout') as HTMLSelectElement;
    expect(select.value).toBe('force');
    await user.selectOptions(select, 'hierarchy');
    expect(useUiStore.getState().relationGraphLayout).toBe('hierarchy');
  });

  it('dev mode checkbox: toggling shows/hides dev info banner and sets uiStore.devMode', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('tweak-devinfo')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('tweak-devmode'));
    expect(useUiStore.getState().devMode).toBe(true);
    expect(screen.getByTestId('tweak-devinfo')).toBeInTheDocument();
    await user.click(screen.getByTestId('tweak-devmode'));
    expect(useUiStore.getState().devMode).toBe(false);
    expect(screen.queryByTestId('tweak-devinfo')).not.toBeInTheDocument();
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TweaksPanel isOpen onClose={onClose} />);
    await user.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC key calls onClose via modal', () => {
    const onClose = vi.fn();
    render(<TweaksPanel isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
