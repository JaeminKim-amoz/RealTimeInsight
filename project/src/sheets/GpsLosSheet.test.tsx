/**
 * GpsLosSheet (US-019d) — RTL tests.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GpsLosSheet } from './GpsLosSheet';

describe('sheets/GpsLosSheet (US-019d)', () => {
  it('renders sheet gpslos-sheet root container', () => {
    const { container } = render(<GpsLosSheet />);
    expect(container.querySelector('.sheet.gpslos-sheet')).not.toBeNull();
  });

  it('mounts GpsLosPanel', () => {
    const { container } = render(<GpsLosSheet />);
    expect(container.querySelector('.panel-body.gpslos')).not.toBeNull();
  });

  it('renders the PDOP forecast section', () => {
    render(<GpsLosSheet />);
    expect(screen.getByTestId('pdop-forecast')).toBeInTheDocument();
  });

  it('renders the satellite list with multiple rows', () => {
    const { container } = render(<GpsLosSheet />);
    const rows = container.querySelectorAll('.gpslos-sat-list .sat-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('renders RTCM status + almanac age', () => {
    render(<GpsLosSheet />);
    expect(screen.getByTestId('rtcm-status')).toBeInTheDocument();
    expect(screen.getByTestId('almanac-age')).toBeInTheDocument();
  });

  it('renders the current PDOP readout', () => {
    render(<GpsLosSheet />);
    expect(screen.getByTestId('pdop-current').textContent).toMatch(/\d+\.\d+/);
  });
});
