/**
 * TopBar (US-012) — RTL tests.
 *
 * Verifies brand mark + LIVE/REPLAY mode toggle wired to useSessionStore,
 * RX status LEDs, sheet tabs, and tool button strip.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useSessionStore } from '../store/sessionStore';

describe('shell/TopBar (US-012)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('renders the REALTIMEINSIGHT brand wordmark', () => {
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    expect(screen.getByText('REALTIMEINSIGHT')).toBeInTheDocument();
  });

  it('renders the topbar root with the prototype `topbar` className', () => {
    const { container } = render(
      <TopBar activeSheet="workstation" onSheetChange={() => {}} />
    );
    expect(container.querySelector('.topbar')).not.toBeNull();
  });

  it('LIVE button has `.on` class when appMode === "live"', () => {
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    const liveBtn = screen.getByRole('button', { name: /LIVE/ });
    expect(liveBtn.className).toContain('on');
    const replayBtn = screen.getByRole('button', { name: /REPLAY/ });
    expect(replayBtn.className).not.toContain('on');
  });

  it('clicking REPLAY mutates sessionStore.appMode to "replay"', async () => {
    const user = userEvent.setup();
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    const replayBtn = screen.getByRole('button', { name: /REPLAY/ });
    await user.click(replayBtn);
    expect(useSessionStore.getState().appMode).toBe('replay');
  });

  it('clicking LIVE after REPLAY mutates sessionStore.appMode back to "live"', async () => {
    const user = userEvent.setup();
    useSessionStore.getState().setAppMode('replay');
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    const liveBtn = screen.getByRole('button', { name: /LIVE/ });
    await user.click(liveBtn);
    expect(useSessionStore.getState().appMode).toBe('live');
  });

  it('renders 4 RX status LED indicators', () => {
    const { container } = render(
      <TopBar activeSheet="workstation" onSheetChange={() => {}} />
    );
    const leds = container.querySelectorAll('.rx-led');
    expect(leds.length).toBe(4);
  });

  it('renders bandwidth readout with Mbps unit', () => {
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    expect(screen.getByText(/Mbps/)).toBeInTheDocument();
  });

  it('renders 4 sheet tabs (Workstation/Space/EW/GPS) and marks active one', () => {
    render(<TopBar activeSheet="space" onSheetChange={() => {}} />);
    const wks = screen.getByRole('button', { name: /Workstation/ });
    const spc = screen.getByRole('button', { name: /Space/ });
    const ew = screen.getByRole('button', { name: /EW/ });
    const gps = screen.getByRole('button', { name: /GPS/ });
    expect(wks).toBeInTheDocument();
    expect(spc).toBeInTheDocument();
    expect(ew).toBeInTheDocument();
    expect(gps).toBeInTheDocument();
    expect(spc.className).toContain('on');
    expect(wks.className).not.toContain('on');
  });

  it('clicking sheet tab calls onSheetChange with sheet id', async () => {
    const user = userEvent.setup();
    const onSheetChange = vi.fn();
    render(<TopBar activeSheet="workstation" onSheetChange={onSheetChange} />);
    await user.click(screen.getByRole('button', { name: /Space/ }));
    expect(onSheetChange).toHaveBeenCalledWith('space');
  });

  it('renders tool button strip with 7 buttons (Library/Channels/Layout/Export/MATLAB/LLM/Tweaks)', () => {
    const { container } = render(
      <TopBar activeSheet="workstation" onSheetChange={() => {}} />
    );
    const toolStrip = container.querySelector('.tool-strip');
    expect(toolStrip).not.toBeNull();
    const toolButtons = toolStrip!.querySelectorAll('button');
    expect(toolButtons.length).toBe(7);
    const labels = Array.from(toolButtons).map((b) => b.textContent);
    expect(labels).toEqual([
      'Library',
      'Channels',
      'Layout',
      'Export',
      'MATLAB',
      'LLM',
      'Tweaks',
    ]);
  });

  it('renders project selector', () => {
    render(<TopBar activeSheet="workstation" onSheetChange={() => {}} />);
    expect(screen.getByText(/RTI Flight Test/)).toBeInTheDocument();
  });
});
