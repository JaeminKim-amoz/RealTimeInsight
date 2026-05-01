/**
 * InsightPane (US-015) — RTL tests.
 *
 * Verifies empty state when no anomaly is selected, and root-cause
 * candidate rendering plus selection wiring when anomaly is selected.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightPane } from './InsightPane';
import { useSelectionStore } from '../store/selectionStore';
import { useStreamStore } from '../store/streamStore';

describe('shell/InsightPane (US-015)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders the insight-pane root className', () => {
    const { container } = render(<InsightPane />);
    expect(container.querySelector('.insight-pane')).not.toBeNull();
  });

  it('shows empty state when no anomaly is selected', () => {
    render(<InsightPane />);
    expect(screen.getByText(/Click an anomaly to inspect/i)).toBeInTheDocument();
  });

  it('renders 4 root-cause candidates when anom-001 is selected', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    const { container } = render(<InsightPane />);
    const cards = container.querySelectorAll('.candidate');
    expect(cards.length).toBe(4);
  });

  it('renders the anomaly label when an anomaly is selected', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    render(<InsightPane />);
    expect(
      screen.getByText('Pressure spike with correlated current disturbance')
    ).toBeInTheDocument();
  });

  it('does not render candidates when anomaly id is not found', () => {
    useSelectionStore.getState().selectAnomaly('anom-zzz');
    const { container } = render(<InsightPane />);
    const cards = container.querySelectorAll('.candidate');
    expect(cards.length).toBe(0);
    // Falls back to empty-state copy.
    expect(screen.getByText(/Click an anomaly to inspect/i)).toBeInTheDocument();
  });

  it('clicking a candidate calls selectGraphNode in the store', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().selectAnomaly('anom-001');
    const { container } = render(<InsightPane />);
    const firstCandidate = container.querySelector<HTMLElement>('.candidate')!;
    expect(firstCandidate).not.toBeNull();
    await user.click(firstCandidate);
    // The first candidate is "Bus current transient" → ch-1002 evidence kind.
    // We simply assert the store mutated to a non-null graph node id.
    expect(useSelectionStore.getState().selectedGraphNodeId).not.toBeNull();
  });

  it('renders evidence chips for each candidate', () => {
    useSelectionStore.getState().selectAnomaly('anom-001');
    const { container } = render(<InsightPane />);
    const evChips = container.querySelectorAll('.evidence-chip');
    // Sum of evidenceKinds across the 4 candidates = 3+2+2+2 = 9
    expect(evChips.length).toBeGreaterThanOrEqual(9);
  });
});

// ── US-2-005d — detected anomalies integration ────────────────────────────

describe('shell/InsightPane — detected anomalies (US-2-005d)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
    useStreamStore.getState().reset();
  });

  it('renders detected anomalies list when detectedAnomalies is non-empty', () => {
    // Inject a detected anomaly directly into the stream store
    useStreamStore.setState({
      detectedAnomalies: [
        {
          anomalyId: 'hyd-pressure-spike-0',
          channelId: 1205,
          channelDisplay: 'Hydraulic Press. A',
          timestampNs: '0',
          severity: 'high',
          score: 0.85,
          label: 'Hydraulic spike',
          windowSec: [0, 1],
          candidates: [],
          relatedChannelIds: [],
        },
      ],
    });
    render(<InsightPane />);
    expect(screen.getByText(/Hydraulic spike/i)).toBeInTheDocument();
  });

  it('clicking a detected anomaly row calls selectionStore.selectAnomaly with its id', async () => {
    const user = userEvent.setup();
    useStreamStore.setState({
      detectedAnomalies: [
        {
          anomalyId: 'hyd-pressure-spike-0',
          channelId: 1205,
          channelDisplay: 'Hydraulic Press. A',
          timestampNs: '0',
          severity: 'high',
          score: 0.85,
          label: 'Hydraulic spike',
          windowSec: [0, 1],
          candidates: [],
          relatedChannelIds: [],
        },
      ],
    });
    render(<InsightPane />);
    const row = screen.getByText(/Hydraulic spike/i).closest('[role="button"]');
    expect(row).not.toBeNull();
    await user.click(row as HTMLElement);
    expect(useSelectionStore.getState().selectedAnomalyId).toBe('hyd-pressure-spike-0');
  });

  it('shows ANOMALY mock fallback when no detected anomalies and selectedAnomalyId is anom-001', () => {
    // No detected anomalies in stream store (default after reset)
    useSelectionStore.getState().selectAnomaly('anom-001');
    render(<InsightPane />);
    // The mock ANOMALY label should be shown
    expect(
      screen.getByText('Pressure spike with correlated current disturbance')
    ).toBeInTheDocument();
  });
});
