/**
 * EwSheet (US-019c) — RTL tests.
 */

import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('maplibre-gl', () => {
  class Map {
    constructor() {}
    on() {}
    once() {}
    remove() {}
    addSource() {}
    addLayer() {}
    getSource() { return null; }
    isStyleLoaded() { return true; }
    setStyle() {}
  }
  return { default: { Map }, Map };
});

import { EwSheet } from './EwSheet';

describe('sheets/EwSheet (US-019c)', () => {
  it('renders sheet ew-sheet root container', () => {
    const { container } = render(<EwSheet />);
    expect(container.querySelector('.sheet.ew-sheet')).not.toBeNull();
  });

  it('mounts Map2DPanel + WaterfallPanel', () => {
    const { container } = render(<EwSheet />);
    expect(container.querySelector('.panel-body.map')).not.toBeNull();
    expect(container.querySelector('.panel-body.waterfall')).not.toBeNull();
  });

  it('renders the "1247 UAV · Live" header text', () => {
    render(<EwSheet />);
    const header = screen.getByTestId('ew-header');
    expect(header.textContent).toContain('1247');
    expect(header.textContent).toContain('UAV');
  });

  it('renders 6 squad rows in the sidebar', () => {
    const { container } = render(<EwSheet />);
    expect(container.querySelectorAll('.ew-squad-row').length).toBe(6);
  });

  it('renders the threat list', () => {
    const { container } = render(<EwSheet />);
    expect(container.querySelectorAll('.ew-threat-row').length).toBeGreaterThan(0);
  });

  it('mounts in replay mode without throwing', () => {
    expect(() => render(<EwSheet mode="replay" />)).not.toThrow();
  });
});
