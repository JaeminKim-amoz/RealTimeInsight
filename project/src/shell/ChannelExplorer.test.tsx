/**
 * ChannelExplorer (US-013) — RTL tests.
 *
 * Verifies search, filter chips, group expansion, drag-start payload,
 * and Favorites surfacing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelExplorer } from './ChannelExplorer';

describe('shell/ChannelExplorer (US-013)', () => {
  beforeEach(() => {
    // No store reset needed — explorer is purely view-driven by mock data.
  });

  it('renders the leftpane / channel-explorer root', () => {
    const { container } = render(<ChannelExplorer />);
    expect(container.querySelector('.leftpane')).not.toBeNull();
    expect(container.querySelector('.channel-explorer')).not.toBeNull();
  });

  it('renders 6 group headers by default', () => {
    const { container } = render(<ChannelExplorer />);
    const groupHeaders = container.querySelectorAll('.tree-group');
    expect(groupHeaders.length).toBe(6);
  });

  it('typing "voltage" in the search filters list to channels with that substring', async () => {
    const user = userEvent.setup();
    const { container } = render(<ChannelExplorer />);
    const input = container.querySelector('.searchbox input') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, 'voltage');
    // Scope to the All Channels section (favorites duplicates some channels).
    const allSection = container.querySelector('.all-section')!;
    const visibleNames = Array.from(
      allSection.querySelectorAll('.ch-name')
    ).map((n) => n.textContent);
    // Channels matching "voltage": 1001 bus_voltage, 1003 batt_voltage
    expect(visibleNames).toContain('Bus Voltage 28V');
    expect(visibleNames).toContain('Battery Voltage');
    // Non-matching channels should not be visible in the tree.
    expect(visibleNames).not.toContain('Hydraulic Press. A');
    expect(visibleNames).not.toContain('Roll');
  });

  it('clicking the "alarmed" chip narrows list to channels with alarmArmed === true', async () => {
    const user = userEvent.setup();
    const { container } = render(<ChannelExplorer />);
    const chip = screen.getByRole('button', { name: /alarmed/i });
    await user.click(chip);
    expect(chip.className).toContain('on');
    // The only alarmed channel in mock is 1205 (Hydraulic Press. A).
    const allSection = container.querySelector('.all-section')!;
    const visibleNames = Array.from(
      allSection.querySelectorAll('.ch-name')
    ).map((n) => n.textContent);
    expect(visibleNames).toContain('Hydraulic Press. A');
    expect(visibleNames).not.toContain('Bus Voltage 28V');
    expect(visibleNames).not.toContain('Roll');
    // Tree groups for non-matching subsystems should be empty (still group headers visible).
    const groups = container.querySelectorAll('.tree-group');
    expect(groups.length).toBe(6);
  });

  it('drag start on a channel row sets payload via dataTransfer.setData', () => {
    const { container } = render(<ChannelExplorer />);
    const rows = container.querySelectorAll<HTMLElement>('.ch-row');
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0]!;

    // Build a minimal mock dataTransfer; jsdom's DragEvent doesn't have one.
    const setData = (() => {
      let captured: { format: string; data: string } | null = null;
      const fn = (format: string, data: string) => {
        captured = { format, data };
      };
      // Attach to fn for test access
      (fn as any).get = () => captured;
      return fn;
    })();

    const dataTransfer = {
      setData,
      effectAllowed: '',
      getData: (_: string) => '',
      dropEffect: '',
    };
    const event = new Event('dragstart', { bubbles: true, cancelable: true }) as Event & {
      dataTransfer: unknown;
    };
    (event as any).dataTransfer = dataTransfer;
    firstRow.dispatchEvent(event);

    const captured = (setData as any).get();
    expect(captured).not.toBeNull();
    expect(captured.format).toBe('application/x-channel');
    const payload = JSON.parse(captured.data);
    expect(payload.kind).toBe('channel-drag');
    expect(typeof payload.channelId).toBe('number');
    expect(typeof payload.displayName).toBe('string');
    expect(typeof payload.channelType).toBe('string');
  });

  it('renders a Favorites section that lists 6 favorite channels from mock data', () => {
    const { container } = render(<ChannelExplorer />);
    const favSection = container.querySelector('.favorites-section');
    expect(favSection).not.toBeNull();
    const favRows = favSection!.querySelectorAll('.ch-row');
    // Mock: 1001, 1002, 1205, 2210, 2211, 5001 → 6 favorites.
    expect(favRows.length).toBe(6);
  });

  it('renders all 8 filter chips', () => {
    const { container } = render(<ChannelExplorer />);
    const chips = container.querySelectorAll('.filter-chips .chip');
    expect(chips.length).toBe(8);
  });

  it('clicking a group header toggles its open class', async () => {
    const user = userEvent.setup();
    const { container } = render(<ChannelExplorer />);
    const firstGroup = container.querySelector<HTMLElement>('.tree-group')!;
    const initiallyOpen = firstGroup.className.includes('open');
    await user.click(firstGroup);
    const afterClick = firstGroup.className.includes('open');
    expect(afterClick).toBe(!initiallyOpen);
  });
});
