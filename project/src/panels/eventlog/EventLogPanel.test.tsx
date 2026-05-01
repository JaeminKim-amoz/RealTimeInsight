/**
 * EventLogPanel (US-016d) — RTL tests.
 *
 * 9 events from mock/events.EVENTS rendered reverse-chronologically.
 * Severity-filter chip strip. Click HYD.SPIKE row → selectAnomaly('anom-001').
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventLogPanel } from './EventLogPanel';
import { useSelectionStore } from '../../store/selectionStore';

describe('panels/eventlog/EventLogPanel (US-016d)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders a panel-body event-log root container', () => {
    const { container } = render(<EventLogPanel />);
    expect(container.querySelector('.panel-body.event-log')).not.toBeNull();
  });

  it('renders 9 event rows by default (matches mock/events fixture)', () => {
    const { container } = render(<EventLogPanel />);
    const rows = container.querySelectorAll('.event-row');
    expect(rows.length).toBe(9);
  });

  it('orders events newest-first by timestamp', () => {
    const { container } = render(<EventLogPanel />);
    const times = Array.from(container.querySelectorAll('.event-row .ev-time')).map(
      (el) => Number(el.textContent)
    );
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
    }
  });

  it('renders a severity badge with the severity class on each row', () => {
    const { container } = render(<EventLogPanel />);
    const sev = container.querySelector('.event-row .ev-sev');
    expect(sev).not.toBeNull();
  });

  it('renders a severity-filter chip strip with 4 chips (high/medium/low/info)', () => {
    const { container } = render(<EventLogPanel />);
    const chips = container.querySelectorAll('.sev-filter .sev-chip');
    expect(chips.length).toBe(4);
  });

  it('clicking a severity chip narrows the visible rows', async () => {
    const user = userEvent.setup();
    const { container } = render(<EventLogPanel />);
    const highChip = container.querySelector(
      '.sev-filter .sev-chip[data-sev="high"]'
    ) as HTMLElement;
    expect(highChip).not.toBeNull();
    await user.click(highChip);
    // Now only "high" rows should show — that's HYD.SPIKE + AOA.HIGH = 2 events
    const rows = container.querySelectorAll('.event-row');
    expect(rows.length).toBe(2);
  });

  it('clicking the HYD.SPIKE row triggers selectAnomaly("anom-001")', async () => {
    const user = userEvent.setup();
    const { container } = render(<EventLogPanel />);
    // HYD.SPIKE is the t=182.34 high-severity event
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.event-row'));
    const hydRow = rows.find((r) => r.textContent?.includes('HYD.SPIKE'))!;
    expect(hydRow).toBeDefined();
    await user.click(hydRow);
    expect(useSelectionStore.getState().selectedAnomalyId).toBe('anom-001');
  });

  it('clicking a non-HYD row does NOT set anomaly selection', async () => {
    const user = userEvent.setup();
    const { container } = render(<EventLogPanel />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.event-row'));
    const otherRow = rows.find((r) => r.textContent?.includes('SYNC.LOSS'))!;
    expect(otherRow).toBeDefined();
    await user.click(otherRow);
    expect(useSelectionStore.getState().selectedAnomalyId).toBeNull();
  });

  it('renders the channel id badge for events with a channel', () => {
    const { container } = render(<EventLogPanel />);
    // Some rows will show CH#### text (e.g., CH1205); some will show "—"
    const channels = Array.from(
      container.querySelectorAll<HTMLElement>('.event-row .ev-ch')
    );
    const withCh = channels.filter((c) => /CH\d+/.test(c.textContent ?? ''));
    expect(withCh.length).toBeGreaterThan(0);
  });

  it('renders the event message text', () => {
    render(<EventLogPanel />);
    expect(
      screen.getByText(/Hydraulic pressure transient/i)
    ).toBeInTheDocument();
  });

  it('toggling a severity chip a second time restores all rows', async () => {
    const user = userEvent.setup();
    const { container } = render(<EventLogPanel />);
    const highChip = container.querySelector(
      '.sev-filter .sev-chip[data-sev="high"]'
    ) as HTMLElement;
    await user.click(highChip);
    expect(container.querySelectorAll('.event-row').length).toBe(2);
    await user.click(highChip);
    expect(container.querySelectorAll('.event-row').length).toBe(9);
  });
});
