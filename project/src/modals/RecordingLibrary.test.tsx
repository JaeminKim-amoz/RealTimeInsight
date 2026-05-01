/**
 * RecordingLibrary (US-2-004d) — RTL tests for FULL implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordingLibrary } from './RecordingLibrary';
import { useSessionStore } from '../store/sessionStore';

describe('modals/RecordingLibrary (US-2-004d FULL)', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('renders 12 recording rows by default', () => {
    render(<RecordingLibrary isOpen onClose={() => {}} />);
    const rows = screen.getAllByTestId(/^rec-row-/);
    expect(rows).toHaveLength(12);
  });

  it('renders 3 mission facets in the sidebar', () => {
    render(<RecordingLibrary isOpen onClose={() => {}} />);
    expect(screen.getByTestId('rec-facet-mission-Project Apollo')).toBeInTheDocument();
    expect(screen.getByTestId('rec-facet-mission-Phoenix')).toBeInTheDocument();
    expect(screen.getByTestId('rec-facet-mission-Halcyon')).toBeInTheDocument();
  });

  it('clicking a mission facet filters rows to that mission only', async () => {
    const user = userEvent.setup();
    render(<RecordingLibrary isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('rec-facet-mission-Phoenix'));
    const rows = screen.getAllByTestId(/^rec-row-/);
    expect(rows).toHaveLength(4);
    rows.forEach((r) => {
      expect(r).toHaveTextContent('Phoenix');
    });
  });

  it('search box filters by mission name', async () => {
    const user = userEvent.setup();
    render(<RecordingLibrary isOpen onClose={() => {}} />);
    await user.type(screen.getByTestId('rec-search'), 'halcyon');
    const rows = screen.getAllByTestId(/^rec-row-/);
    expect(rows).toHaveLength(4);
  });

  it('clicking load on a recording calls enterReplayMode and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const enterReplaySpy = vi.spyOn(useSessionStore.getState(), 'enterReplayMode');
    render(<RecordingLibrary isOpen onClose={onClose} />);
    const row = screen.getByTestId('rec-row-rec-001');
    await user.click(within(row).getByTestId('rec-load-rec-001'));
    expect(enterReplaySpy).toHaveBeenCalled();
    expect(useSessionStore.getState().activeRunId).toBe('rec-001');
    expect(onClose).toHaveBeenCalled();
  });

  it('Aircraft facet click filters rows to that aircraft', async () => {
    const user = userEvent.setup();
    render(<RecordingLibrary isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('rec-facet-aircraft-RQ-180-A'));
    const rows = screen.getAllByTestId(/^rec-row-/);
    expect(rows).toHaveLength(4);
    rows.forEach((r) => {
      expect(r).toHaveTextContent('RQ-180-A');
    });
  });
});
