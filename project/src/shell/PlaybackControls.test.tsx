/**
 * PlaybackControls (US-2-003) — RTL tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybackControls } from './PlaybackControls';
import { useSessionStore } from '../store/sessionStore';
import { useStreamStore } from '../store/streamStore';
import { RECORDING_DURATION_NS } from '../mock/recording';

describe('shell/PlaybackControls (US-2-003)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
  });

  it('renders the .replay-controls root with all 5 transport buttons + rate selector + scrub slider + time display', () => {
    const { container } = render(<PlaybackControls />);
    expect(container.querySelector('.replay-controls')).not.toBeNull();
    expect(container.querySelectorAll('.transport-btn').length).toBe(5);
    expect(container.querySelector('.rate-selector')).not.toBeNull();
    expect(container.querySelector('.scrub-slider')).not.toBeNull();
    expect(container.querySelector('.time-display')).not.toBeNull();
  });

  it('clicking play/pause toggles sessionStore.playback.isPlaying', async () => {
    const user = userEvent.setup();
    render(<PlaybackControls />);
    const btn = screen.getByRole('button', { name: /Play/ });
    expect(useSessionStore.getState().playback.isPlaying).toBe(false);
    await user.click(btn);
    expect(useSessionStore.getState().playback.isPlaying).toBe(true);
    // Re-fetch by aria-label after toggle (label flips to Pause).
    const pauseBtn = screen.getByRole('button', { name: /Pause/ });
    await user.click(pauseBtn);
    expect(useSessionStore.getState().playback.isPlaying).toBe(false);
  });

  it('rate dropdown change calls setRate (e.g. 2x)', async () => {
    const user = userEvent.setup();
    render(<PlaybackControls />);
    const select = screen.getByLabelText(/Playback rate/) as HTMLSelectElement;
    await user.selectOptions(select, '2');
    expect(useSessionStore.getState().playback.rate).toBe(2);
  });

  it('scrub slider change calls seekTo with clamped ns string', () => {
    const { container } = render(<PlaybackControls />);
    const slider = container.querySelector('.scrub-slider') as HTMLInputElement;
    expect(slider).not.toBeNull();
    // Simulate the slider being moved to 30s (30_000_000_000 ns).
    // RTL's fireEvent.change wires through React's synthetic event system.
    fireEvent.change(slider, { target: { value: '30000000000' } });
    expect(useSessionStore.getState().playback.currentTimeNs).toBe('30000000000');
  });

  it('jump-to-start button seeks to 0', async () => {
    const user = userEvent.setup();
    useSessionStore.getState().setCursor('45000000000');
    render(<PlaybackControls />);
    await user.click(screen.getByRole('button', { name: /Jump to start/ }));
    expect(useSessionStore.getState().playback.currentTimeNs).toBe('0');
  });

  it('jump-to-end button seeks to RECORDING_DURATION_NS', async () => {
    const user = userEvent.setup();
    render(<PlaybackControls />);
    await user.click(screen.getByRole('button', { name: /Jump to end/ }));
    expect(useSessionStore.getState().playback.currentTimeNs).toBe(String(RECORDING_DURATION_NS));
  });

  it('step-back -1s clamps to zero, step-forward +1s advances by 1_000_000_000 ns', async () => {
    const user = userEvent.setup();
    useSessionStore.getState().setCursor('500000000'); // 0.5s
    render(<PlaybackControls />);
    await user.click(screen.getByRole('button', { name: /Step back 1 second/ }));
    expect(useSessionStore.getState().playback.currentTimeNs).toBe('0');
    await user.click(screen.getByRole('button', { name: /Step forward 1 second/ }));
    expect(useSessionStore.getState().playback.currentTimeNs).toBe('1000000000');
  });

  it('time-display formats current/total as MM:SS.mmm', () => {
    useSessionStore.getState().setCursor('30500000000'); // 30.5s
    const { container } = render(<PlaybackControls />);
    const td = container.querySelector('.time-display') as HTMLElement;
    expect(td.textContent).toContain('00:30.500');
    expect(td.textContent).toContain('01:00.000'); // total = 60s
  });
});
