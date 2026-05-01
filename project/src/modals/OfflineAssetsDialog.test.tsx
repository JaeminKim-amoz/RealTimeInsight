/**
 * OfflineAssetsDialog (US-020c) — RTL tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineAssetsDialog } from './OfflineAssetsDialog';
import { useIntegrationStore } from '../store/integrationStore';

describe('modals/OfflineAssetsDialog (US-020c)', () => {
  beforeEach(() => {
    useIntegrationStore.getState().reset();
  });

  it('renders 3 asset sections (map / terrain / llm)', () => {
    render(<OfflineAssetsDialog isOpen onClose={() => {}} />);
    expect(screen.getByTestId('asset-section-map-tile-packs')).toBeInTheDocument();
    expect(screen.getByTestId('asset-section-terrain-packs')).toBeInTheDocument();
    expect(screen.getByTestId('asset-section-llm-models')).toBeInTheDocument();
  });

  it('mode badge reflects store state (default offline-preferred)', () => {
    render(<OfflineAssetsDialog isOpen onClose={() => {}} />);
    expect(screen.getByTestId('offline-mode-badge').textContent).toBe('offline-preferred');
  });

  it('mode badge updates when store mode changes to airgapped', () => {
    useIntegrationStore.getState().setOfflineAssets({ mode: 'airgapped' });
    render(<OfflineAssetsDialog isOpen onClose={() => {}} />);
    expect(screen.getByTestId('offline-mode-badge').textContent).toBe('airgapped');
  });

  it('renders pack rows when store has assets', () => {
    useIntegrationStore.getState().setOfflineAssets({
      mapTilePacks: [
        { id: 'm1', label: 'Korea-S', sizeMb: 120.5, available: true },
        { id: 'm2', label: 'East Asia', sizeMb: 480.0, available: false },
      ],
    });
    const { container } = render(<OfflineAssetsDialog isOpen onClose={() => {}} />);
    const rows = container.querySelectorAll('.asset-row');
    expect(rows.length).toBe(2);
  });

  it('returns null when isOpen=false', () => {
    const { container } = render(<OfflineAssetsDialog isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
