/**
 * TestReportModal (US-2-007c) — RTL tests for FULL implementation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestReportModal } from './TestReportModal';
import type { SequenceRunResult } from './SequenceValidator';

const PASS_RESULT: SequenceRunResult = {
  verdict: 'pass',
  steps: [
    { stepId: 's1', status: 'pass', detail: 'within band' },
    { stepId: 's2', status: 'pass', detail: 'within band' },
  ],
};

const FAIL_RESULT: SequenceRunResult = {
  verdict: 'fail',
  steps: [
    { stepId: 's1', status: 'pass', detail: 'within band' },
    { stepId: 's2', status: 'fail', detail: 'out-of-band' },
  ],
};

describe('modals/TestReportModal (US-2-007c FULL)', () => {
  it('renders custom title, aircraft, mission metadata', () => {
    render(
      <TestReportModal
        isOpen
        onClose={() => {}}
        title="T-247 Acceptance Report"
        aircraft="T-247 · s/n 00142"
        mission="Sortie 2026-04-20-A"
      />
    );
    expect(screen.getByTestId('trm-title').textContent).toContain('T-247 Acceptance Report');
    expect(screen.getByTestId('trm-aircraft').textContent).toContain('T-247');
    expect(screen.getByTestId('trm-mission').textContent).toContain('Sortie 2026-04-20-A');
  });

  it('renders PASS verdict + correct counts when given all-pass result', () => {
    render(<TestReportModal isOpen onClose={() => {}} result={PASS_RESULT} />);
    expect(screen.getByTestId('trm-verdict').textContent).toBe('PASS');
    expect(screen.getByTestId('trm-counts').textContent).toContain('2 passed');
    expect(screen.getByTestId('trm-counts').textContent).toContain('0 failed');
  });

  it('renders FAIL verdict + partial counts when given mixed result', () => {
    render(<TestReportModal isOpen onClose={() => {}} result={FAIL_RESULT} />);
    expect(screen.getByTestId('trm-verdict').textContent).toBe('FAIL');
    expect(screen.getByTestId('trm-counts').textContent).toContain('1 passed');
    expect(screen.getByTestId('trm-counts').textContent).toContain('1 failed');
  });

  it('renders channel statistics table with 12 rows', () => {
    render(<TestReportModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('trm-channels-table')).toBeInTheDocument();
    // 12 mock channels
    expect(screen.getAllByTestId(/^trm-channel-row-/).length).toBe(12);
    // spot-check hyd_pA row
    expect(screen.getByTestId('trm-channel-row-1205')).toBeInTheDocument();
  });

  it('renders sequence steps table with step rows', () => {
    render(<TestReportModal isOpen onClose={() => {}} result={PASS_RESULT} />);
    expect(screen.getByTestId('trm-steps-table')).toBeInTheDocument();
    expect(screen.getByTestId('trm-step-row-s1')).toBeInTheDocument();
    expect(screen.getByTestId('trm-step-row-s2')).toBeInTheDocument();
  });

  it('Export to PDF shows stub message', async () => {
    const user = userEvent.setup();
    render(<TestReportModal isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('trm-pdf-message')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('trm-export-pdf'));
    expect(screen.getByTestId('trm-pdf-message').textContent).toContain(
      'PDF export not yet implemented'
    );
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TestReportModal isOpen onClose={onClose} />);
    await user.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
