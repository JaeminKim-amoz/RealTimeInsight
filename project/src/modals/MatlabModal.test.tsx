/**
 * MatlabModal (US-020b) — RTL tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatlabModal } from './MatlabModal';
import { useIntegrationStore } from '../store/integrationStore';

describe('modals/MatlabModal (US-020b)', () => {
  beforeEach(() => {
    useIntegrationStore.getState().reset();
  });

  it('renders 6 preset buttons', () => {
    render(<MatlabModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('matlab-preset-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('matlab-preset-split')).toBeInTheDocument();
    expect(screen.getByTestId('matlab-preset-xy')).toBeInTheDocument();
    expect(screen.getByTestId('matlab-preset-spectrogram')).toBeInTheDocument();
    expect(screen.getByTestId('matlab-preset-evidence-bundle')).toBeInTheDocument();
    expect(screen.getByTestId('matlab-preset-compare-runs')).toBeInTheDocument();
  });

  it('clicking a preset updates the script preview', async () => {
    const user = userEvent.setup();
    render(<MatlabModal isOpen onClose={() => {}} />);
    const initial = screen.getByTestId('matlab-script').textContent;
    await user.click(screen.getByTestId('matlab-preset-spectrogram'));
    const after = screen.getByTestId('matlab-script').textContent;
    expect(after).not.toBe(initial);
    expect(after).toContain('spectrogram');
  });

  it('Plot in MATLAB button is disabled when bridge is not connected', () => {
    render(<MatlabModal isOpen onClose={() => {}} />);
    const btn = screen.getByTestId('plot-in-matlab') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Plot in MATLAB button is enabled when matlab.connected=true', () => {
    useIntegrationStore.getState().setMatlabState({ connected: true, version: 'R2024b' });
    render(<MatlabModal isOpen onClose={() => {}} />);
    const btn = screen.getByTestId('plot-in-matlab') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows bridge offline status by default', () => {
    render(<MatlabModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('matlab-bridge-status').textContent).toContain('offline');
  });

  it('returns null when isOpen=false', () => {
    const { container } = render(<MatlabModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
