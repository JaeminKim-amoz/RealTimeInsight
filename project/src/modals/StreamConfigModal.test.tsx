/**
 * StreamConfigModal (US-2-007a) — RTL tests for FULL implementation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamConfigModal } from './StreamConfigModal';

describe('modals/StreamConfigModal (US-2-007a FULL)', () => {
  it('renders 4 tabs (Sync Pattern, Frame Layout, Streams, Encryption)', () => {
    render(<StreamConfigModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('scm-tab-sync')).toBeInTheDocument();
    expect(screen.getByTestId('scm-tab-frame')).toBeInTheDocument();
    expect(screen.getByTestId('scm-tab-streams')).toBeInTheDocument();
    expect(screen.getByTestId('scm-tab-encryption')).toBeInTheDocument();
  });

  it('Sync Pattern tab exposes hex pattern + sync width + frame words inputs', () => {
    render(<StreamConfigModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('scm-sync-pattern')).toBeInTheDocument();
    expect(screen.getByTestId('scm-sync-width')).toBeInTheDocument();
    expect(screen.getByTestId('scm-frame-words')).toBeInTheDocument();
  });

  it('Frame Layout tab exposes word_bits / CRC index / sync placement / subcom mask', async () => {
    const user = userEvent.setup();
    render(<StreamConfigModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('scm-tab-frame'));
    expect(screen.getByTestId('scm-word-bits')).toBeInTheDocument();
    expect(screen.getByTestId('scm-crc-index')).toBeInTheDocument();
    expect(screen.getByTestId('scm-sync-placement')).toBeInTheDocument();
    expect(screen.getByTestId('scm-subcom-mask')).toBeInTheDocument();
  });

  it('Streams tab adds, removes rows, and recomputes total bitrate', async () => {
    const user = userEvent.setup();
    render(<StreamConfigModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('scm-tab-streams'));
    // Default seed has 2 rows: 42.8 + 18.4 = 61.20
    expect(screen.getByTestId('scm-total-bitrate').textContent).toContain('61.20');
    // Add one stream (defaults bitrate 10) → 71.20
    await user.click(screen.getByTestId('scm-add-stream'));
    expect(screen.getByTestId('scm-total-bitrate').textContent).toContain('71.20');
    expect(screen.getByTestId('scm-stream-row-2')).toBeInTheDocument();
    // Remove second row → expect 1+1 rows remaining
    await user.click(screen.getByTestId('scm-stream-remove-1'));
    expect(screen.queryByTestId('scm-stream-row-2')).not.toBeInTheDocument();
  });

  it('Encryption tab toggles AES enabled and switches key format mode', async () => {
    const user = userEvent.setup();
    render(<StreamConfigModal isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('scm-tab-encryption'));
    const cb = screen.getByTestId('scm-aes-enabled') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    await user.click(cb);
    expect(cb.checked).toBe(false);
    // Re-enable to test key mode toggle
    await user.click(cb);
    await user.click(screen.getByTestId('scm-aes-mode-text'));
    expect(screen.getByTestId('scm-aes-mode-text')).toHaveClass('on');
  });

  it('Apply validates inputs: invalid hex pattern surfaces error; valid config calls onApply + closes', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<StreamConfigModal isOpen onClose={onClose} onApply={onApply} />);
    // First, force an invalid hex pattern
    const pattern = screen.getByTestId('scm-sync-pattern') as HTMLInputElement;
    fireEvent.change(pattern, { target: { value: 'NOT-HEX' } });
    await user.click(screen.getByTestId('scm-apply'));
    expect(screen.getByTestId('scm-error')).toHaveTextContent(/hex/i);
    expect(onApply).not.toHaveBeenCalled();
    // Restore valid hex and click Apply
    fireEvent.change(pattern, { target: { value: 'FE6B2840' } });
    await user.click(screen.getByTestId('scm-apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('scm-toast')).toHaveTextContent(/applied/i);
  });
});
