/**
 * ExportModal (US-020a) — RTL tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportModal } from './ExportModal';
import { useIntegrationStore } from '../store/integrationStore';

describe('modals/ExportModal (US-020a)', () => {
  beforeEach(() => {
    useIntegrationStore.getState().reset();
  });

  it('renders all 5 tabs', () => {
    render(<ExportModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('export-tab-csv')).toBeInTheDocument();
    expect(screen.getByTestId('export-tab-parquet')).toBeInTheDocument();
    expect(screen.getByTestId('export-tab-arrow')).toBeInTheDocument();
    expect(screen.getByTestId('export-tab-matlab')).toBeInTheDocument();
    expect(screen.getByTestId('export-tab-snapshot')).toBeInTheDocument();
  });

  it('clicking each tab swaps content', async () => {
    const user = userEvent.setup();
    render(<ExportModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('export-tab-content-csv')).toBeInTheDocument();
    await user.click(screen.getByTestId('export-tab-parquet'));
    expect(screen.getByTestId('export-tab-content-parquet')).toBeInTheDocument();
    await user.click(screen.getByTestId('export-tab-arrow'));
    expect(screen.getByTestId('export-tab-content-arrow')).toBeInTheDocument();
  });

  it('CSV tab renders quality policy radios and they are selectable', async () => {
    const user = userEvent.setup();
    render(<ExportModal isOpen onClose={() => {}} />);
    const keepAll = screen.getByTestId('quality-keep-all') as HTMLInputElement;
    const goodCrc = screen.getByTestId('quality-good-crc-only') as HTMLInputElement;
    expect(goodCrc.checked).toBe(true);
    await user.click(keepAll);
    expect(keepAll.checked).toBe(true);
    expect(goodCrc.checked).toBe(false);
  });

  it('Generate Export button enqueues a job to integrationStore', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportModal isOpen onClose={onClose} />);
    await user.click(screen.getByTestId('generate-export'));
    const jobs = useIntegrationStore.getState().exportJobs;
    expect(jobs.length).toBe(1);
    expect(jobs[0].status).toBe('queued');
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when isOpen=false', () => {
    const { container } = render(<ExportModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies the export-modal className', () => {
    render(<ExportModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog').className).toContain('export-modal');
  });
});
