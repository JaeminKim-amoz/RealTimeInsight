/**
 * SpaceSheet (US-3-004) — RTL tests for the orbital theater sheet.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpaceSheet } from './SpaceSheet';

describe('sheets/SpaceSheet (US-3-004 sizing + counters)', () => {
  it('renders sheet.space-sheet root container', () => {
    const { container } = render(<SpaceSheet />);
    expect(container.querySelector('.sheet.space-sheet')).not.toBeNull();
  });

  it('mounts GlobePanel (.globe-wrap) + GpsLosPanel (.gps-panel)', () => {
    const { container } = render(<SpaceSheet />);
    expect(container.querySelector('.globe-wrap')).not.toBeNull();
    // GpsLosPanel root may use any class; assert by sheet wrapper testid instead.
    expect(screen.getByTestId('space-sheet-gpslos')).toBeInTheDocument();
  });

  it('grid container provides explicit height to children', () => {
    render(<SpaceSheet />);
    const grid = screen.getByTestId('space-sheet-grid');
    // React's CSSOM normalizes "flex: 1" to "1 1 0%" — accept either form
    expect(grid.style.flex.startsWith('1')).toBe(true);
    // height:100% allows the Canvas inside GlobePanel to mount with real size
    expect(grid.style.height).toBe('100%');
  });

  it('globe + gpslos containers each declare height:100%', () => {
    render(<SpaceSheet />);
    const globe = screen.getByTestId('space-sheet-globe');
    const gpslos = screen.getByTestId('space-sheet-gpslos');
    expect(globe.style.height).toBe('100%');
    expect(gpslos.style.height).toBe('100%');
  });

  it('telemetry strip shows sat/threat/friendly counts (18/7/2)', () => {
    render(<SpaceSheet />);
    expect(screen.getByTestId('sat-count').textContent).toBe('18');
    expect(screen.getByTestId('threat-count').textContent).toBe('7');
    expect(screen.getByTestId('friendly-count').textContent).toBe('2');
  });

  it('mounts in replay mode without throwing', () => {
    expect(() => render(<SpaceSheet mode="replay" />)).not.toThrow();
  });
});
