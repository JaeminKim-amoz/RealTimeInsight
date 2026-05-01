/**
 * SequenceValidator (US-2-007b) — RTL tests for FULL implementation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SequenceValidator } from './SequenceValidator';

const realRandom = Math.random;
afterEach(() => {
  Math.random = realRandom;
});

describe('modals/SequenceValidator (US-2-007b FULL)', () => {
  it('renders default steps with channelId / min / max / hold inputs', () => {
    render(<SequenceValidator isOpen onClose={() => {}} />);
    expect(screen.getByTestId('sv-step-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('sv-step-channel-0')).toBeInTheDocument();
    expect(screen.getByTestId('sv-step-min-0')).toBeInTheDocument();
    expect(screen.getByTestId('sv-step-max-0')).toBeInTheDocument();
    expect(screen.getByTestId('sv-step-hold-0')).toBeInTheDocument();
  });

  it('Add Step appends a new row', async () => {
    const user = userEvent.setup();
    render(<SequenceValidator isOpen onClose={() => {}} />);
    const before = screen.queryAllByTestId(/^sv-step-row-/).length;
    await user.click(screen.getByTestId('sv-add-step'));
    const after = screen.queryAllByTestId(/^sv-step-row-/).length;
    expect(after).toBe(before + 1);
  });

  it('Remove Step deletes a row; reorder up/down works', async () => {
    const user = userEvent.setup();
    render(<SequenceValidator isOpen onClose={() => {}} />);
    // Capture first row's stepId before reordering.
    const row0Before = screen.getByTestId('sv-step-row-0').textContent ?? '';
    await user.click(screen.getByTestId('sv-step-down-0'));
    const row0After = screen.getByTestId('sv-step-row-0').textContent ?? '';
    expect(row0After).not.toEqual(row0Before);
    // Remove first row.
    const remaining = screen.queryAllByTestId(/^sv-step-row-/).length;
    await user.click(screen.getByTestId('sv-step-remove-0'));
    expect(screen.queryAllByTestId(/^sv-step-row-/).length).toBe(remaining - 1);
  });

  it('Record / Stop toggles capture indicator', async () => {
    const user = userEvent.setup();
    render(<SequenceValidator isOpen onClose={() => {}} />);
    expect(screen.queryByTestId('sv-capturing')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('sv-record'));
    expect(screen.getByTestId('sv-capturing')).toBeInTheDocument();
    await user.click(screen.getByTestId('sv-stop'));
    expect(screen.queryByTestId('sv-capturing')).not.toBeInTheDocument();
  });

  it('Run Sequence produces a verdict + per-step results (deterministic via Math.random stub)', async () => {
    Math.random = () => 0.99; // forces all-pass
    const user = userEvent.setup();
    render(<SequenceValidator isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('sv-run'));
    expect(screen.getByTestId('sv-results')).toBeInTheDocument();
    expect(screen.getByTestId('sv-overall-verdict').textContent).toBe('pass');
    // Now force all-fail.
    Math.random = () => 0.0;
    await user.click(screen.getByTestId('sv-run'));
    expect(screen.getByTestId('sv-overall-verdict').textContent).toBe('fail');
  });

  it('Generate Report invokes onOpenReport with the run result', async () => {
    Math.random = () => 0.99;
    const user = userEvent.setup();
    const onOpenReport = vi.fn();
    render(<SequenceValidator isOpen onClose={() => {}} onOpenReport={onOpenReport} />);
    await user.click(screen.getByTestId('sv-generate-report'));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
    const arg = onOpenReport.mock.calls[0][0];
    expect(arg).toHaveProperty('verdict');
    expect(arg).toHaveProperty('steps');
  });
});
