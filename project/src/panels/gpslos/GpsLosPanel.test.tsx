/**
 * GpsLosPanel (US-018d / US-3-003) — RTL tests for FULL implementation.
 */

import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { GpsLosPanel } from './GpsLosPanel';
import { computeDop, mockGpsConstellation } from './skyplot';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-gpslos',
    kind: 'gpslos',
    title: 'GPS LOS Test',
    layoutNodeId: 'ln-gp',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/gpslos/GpsLosPanel (US-3-003 FULL fidelity)', () => {
  it('renders panel-body gpslos / gps-panel root with skyplot + side', () => {
    const { container } = render(<GpsLosPanel panel={makePanel()} />);
    expect(container.querySelector('.panel-body.gpslos')).not.toBeNull();
    expect(screen.getByTestId('gps-skyplot')).toBeInTheDocument();
    expect(screen.getByTestId('gps-side')).toBeInTheDocument();
  });

  it('renders 21 satellite dots (8 GPS + 4 GLO + 5 GAL + 4 BDS)', () => {
    const { container } = render(<GpsLosPanel panel={makePanel()} />);
    const dots = container.querySelectorAll('[data-sat-prn]');
    expect(dots.length).toBe(21);
  });

  it('renders DOP grid with 5 cells (PDOP/HDOP/VDOP/TDOP/GDOP)', () => {
    render(<GpsLosPanel panel={makePanel()} />);
    expect(screen.getByTestId('dop-cell-pdop')).toBeInTheDocument();
    expect(screen.getByTestId('dop-cell-hdop')).toBeInTheDocument();
    expect(screen.getByTestId('dop-cell-vdop')).toBeInTheDocument();
    expect(screen.getByTestId('dop-cell-tdop')).toBeInTheDocument();
    expect(screen.getByTestId('dop-cell-gdop')).toBeInTheDocument();
  });

  it('renders SNR bars with 12 rows', () => {
    const { container } = render(<GpsLosPanel panel={makePanel()} />);
    const bars = container.querySelectorAll('.snr-row');
    expect(bars.length).toBe(12);
  });

  it('renders PDOP forecast SVG with two paths and a 2.0 limit line', () => {
    render(<GpsLosPanel panel={makePanel()} />);
    const fc = screen.getByTestId('gps-pdop-forecast');
    const svg = fc.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('path').length).toBe(2);
    expect(svg?.querySelector('line')).not.toBeNull();
  });

  it('gps-counts shows USED/VIS/MASKED triplet', () => {
    render(<GpsLosPanel panel={makePanel()} />);
    const counts = screen.getByTestId('gps-counts');
    expect(counts.textContent).toContain('USED');
    expect(counts.textContent).toContain('VIS');
    expect(counts.textContent).toContain('MASKED');
    // Visible-count should equal total mock sat count (21)
    expect(screen.getByTestId('gps-vis-count').textContent).toBe('21');
  });

  it('clicking a sat dot reveals tooltip with PRN + el/az/SNR', () => {
    const { container } = render(<GpsLosPanel panel={makePanel()} />);
    expect(screen.queryByTestId('sat-tooltip')).toBeNull();
    const sat = container.querySelector('[data-sat-prn="G02"]') as SVGGElement;
    expect(sat).not.toBeNull();
    fireEvent.click(sat);
    const tip = screen.getByTestId('sat-tooltip');
    expect(tip.textContent).toContain('G02');
    expect(tip.textContent).toMatch(/EL/i);
    expect(tip.textContent).toMatch(/AZ/i);
    expect(tip.textContent).toMatch(/SNR/i);
  });

  it('renders compass labels N/E/S/W', () => {
    const { container } = render(<GpsLosPanel panel={makePanel()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('N');
    expect(text).toContain('E');
    expect(text).toContain('S');
    expect(text).toContain('W');
  });

  it('mounts in replay mode without throwing', () => {
    expect(() => render(<GpsLosPanel panel={makePanel()} mode="replay" />)).not.toThrow();
  });
});

describe('panels/gpslos/skyplot helpers (US-3-003)', () => {
  it('mockGpsConstellation(0) returns exactly 21 satellites', () => {
    const sats = mockGpsConstellation(0);
    expect(sats.length).toBe(21);
  });

  it('mockGpsConstellation includes all 4 systems', () => {
    const sats = mockGpsConstellation(0);
    const systems = new Set(sats.map((s) => s.system));
    expect(systems.has('GPS')).toBe(true);
    expect(systems.has('GLO')).toBe(true);
    expect(systems.has('GAL')).toBe(true);
    expect(systems.has('BDS')).toBe(true);
  });

  it('computeDop with 4 used sats returns finite values', () => {
    const dop = computeDop(4);
    expect(Number.isFinite(dop.pdop)).toBe(true);
    expect(dop.pdop).toBeLessThan(99);
    expect(dop.hdop).toBeGreaterThan(0);
    expect(dop.gdop).toBeGreaterThan(dop.pdop);
  });

  it('computeDop with <4 used sats returns 99 sentinel for PDOP', () => {
    const dop = computeDop(2);
    expect(dop.pdop).toBe(99);
  });
});
