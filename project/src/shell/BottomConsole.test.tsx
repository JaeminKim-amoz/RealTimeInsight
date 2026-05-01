/**
 * BottomConsole (US-015) — RTL tests.
 *
 * Verifies stat readouts wired to sessionStore.ingest, streamStore.performance,
 * integrationStore.llm, plus alarm count derived from EVENTS.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { BottomConsole } from './BottomConsole';
import { useSessionStore } from '../store/sessionStore';
import { useStreamStore } from '../store/streamStore';
import { useIntegrationStore } from '../store/integrationStore';

describe('shell/BottomConsole (US-015)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useStreamStore.getState().reset();
    useIntegrationStore.getState().reset();
  });

  it('renders the bottom-console root className', () => {
    const { container } = render(<BottomConsole />);
    expect(container.querySelector('.bottom-console')).not.toBeNull();
  });

  it('renders all 7 stat readouts (PKT/S, FRAME/S, CRC FAIL%, SYNC LOSS, ALARMS, FPS, LLM)', () => {
    const { container } = render(<BottomConsole />);
    const labels = Array.from(container.querySelectorAll('.m-label')).map(
      (el) => el.textContent?.toLowerCase() ?? ''
    );
    expect(labels).toContain('pkt/s');
    expect(labels).toContain('frame/s');
    expect(labels).toContain('crc fail');
    expect(labels).toContain('sync loss');
    expect(labels).toContain('alarms');
    expect(labels).toContain('fps');
    expect(labels).toContain('llm');
  });

  it('PKT/S shows the formatted packetRateHz value', () => {
    useSessionStore.getState().updateIngest({ packetRateHz: 3247 });
    const { container } = render(<BottomConsole />);
    const pktMetric = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'pkt/s'
    )!;
    const value = within(pktMetric as HTMLElement).getByText(/3,?247/);
    expect(value).toBeInTheDocument();
  });

  it('FRAME/S shows the formatted frameRateHz value', () => {
    useSessionStore.getState().updateIngest({ frameRateHz: 847 });
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'frame/s'
    )!;
    expect(within(m as HTMLElement).getByText(/847/)).toBeInTheDocument();
  });

  it('CRC FAIL shows percent formatted to 2 decimals', () => {
    useSessionStore.getState().updateIngest({ crcFailRate: 0.0012 });
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'crc fail'
    )!;
    expect(within(m as HTMLElement).getByText(/0\.12%/)).toBeInTheDocument();
  });

  it('SYNC LOSS shows count from sessionStore.ingest.syncLossCount', () => {
    useSessionStore.getState().updateIngest({ syncLossCount: 3 });
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'sync loss'
    )!;
    expect(within(m as HTMLElement).getByText(/^3$/)).toBeInTheDocument();
  });

  it('ALARMS shows the count of high-severity events in mock EVENTS (2 high)', () => {
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'alarms'
    )!;
    expect(within(m as HTMLElement).getByText(/^2$/)).toBeInTheDocument();
  });

  it('FPS shows uiFps value from streamStore.performance', () => {
    useStreamStore.getState().updatePerformance({ uiFps: 59 });
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'fps'
    )!;
    expect(within(m as HTMLElement).getByText(/^59$/)).toBeInTheDocument();
  });

  it('LLM shows model and provider from integrationStore.llm', () => {
    const { container } = render(<BottomConsole />);
    const m = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'llm'
    )!;
    expect(within(m as HTMLElement).getByText(/llama-3\.1-8b/)).toBeInTheDocument();
  });

  it('updating sessionStore.updateIngest({packetRateHz: 3247}) changes the PKT/S display', () => {
    const { container } = render(<BottomConsole />);
    act(() => {
      useSessionStore.getState().updateIngest({ packetRateHz: 3247 });
    });
    const pktMetric = Array.from(container.querySelectorAll('.metric')).find(
      (el) => el.querySelector('.m-label')?.textContent?.toLowerCase() === 'pkt/s'
    )!;
    expect(within(pktMetric as HTMLElement).getByText(/3,?247/)).toBeInTheDocument();
  });
});
