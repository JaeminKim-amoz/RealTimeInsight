/**
 * AnalyzerControlPanel (US-2-006d) — RTL tests.
 *
 * DOM-only controls: form fields, SCPI command preset list, marker readouts.
 * No canvas — all logic is wired via React state.
 */

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AnalyzerControlPanel } from './AnalyzerControlPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-analyzer',
    kind: 'analyzer-ctrl',
    title: 'Analyzer Control',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/rf/AnalyzerControlPanel (US-2-006d)', () => {
  it('renders a panel-body analyzer-ctrl root container', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.analyzer-ctrl')).not.toBeNull();
  });

  it('renders the analyzer-ctrl-grid form layout', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.analyzer-ctrl-grid')).not.toBeNull();
  });

  it('renders Center Freq, Span, Ref Level number inputs', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('input[name="centerFreqMhz"]')).not.toBeNull();
    expect(container.querySelector('input[name="spanMhz"]')).not.toBeNull();
    expect(container.querySelector('input[name="refLevelDbm"]')).not.toBeNull();
  });

  it('renders RBW, VBW selectors with 1k/10k/100k/1M options', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const rbw = container.querySelector('select[name="rbwHz"]');
    expect(rbw).not.toBeNull();
    const optionsText = rbw?.textContent ?? '';
    expect(optionsText).toContain('1k');
    expect(optionsText).toContain('10k');
    expect(optionsText).toContain('100k');
    expect(optionsText).toContain('1M');
    expect(container.querySelector('select[name="vbwHz"]')).not.toBeNull();
  });

  it('renders Sweep mode selector with continuous/single', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const sweep = container.querySelector('select[name="sweepMode"]');
    expect(sweep).not.toBeNull();
    const optsText = sweep?.textContent ?? '';
    expect(optsText.toLowerCase()).toContain('continuous');
    expect(optsText.toLowerCase()).toContain('single');
  });

  it('updates internal state when Center Freq input changes', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const input = container.querySelector(
      'input[name="centerFreqMhz"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2400' } });
    expect(input.value).toBe('2400');
  });

  it('renders 4 SCPI preset buttons (*RST, FREQ:CENT, FREQ:SPAN, RLEV)', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const buttons = container.querySelectorAll('button[data-scpi]');
    expect(buttons.length).toBe(4);
    const cmds = Array.from(buttons).map((b) => b.getAttribute('data-scpi'));
    expect(cmds).toContain('*RST');
    expect(cmds).toContain(':FREQ:CENT 1.5GHZ');
    expect(cmds).toContain(':FREQ:SPAN 500MHZ');
    expect(cmds).toContain(':DISP:WIND:TRAC:Y:RLEV -30DBM');
  });

  it('appends to SCPI log when a preset button is clicked', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const log = container.querySelector('.scpi-log');
    expect(log).not.toBeNull();
    const before = log?.children.length ?? 0;
    const rst = container.querySelector('button[data-scpi="*RST"]') as HTMLButtonElement;
    fireEvent.click(rst);
    const after = log?.children.length ?? 0;
    expect(after).toBeGreaterThan(before);
    expect(log?.textContent).toContain('*RST');
  });

  it('renders M1/M2 marker readouts (freq + amp)', () => {
    const { container } = render(
      <AnalyzerControlPanel panel={makePanel()} mode="live" />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('M1');
    expect(text).toContain('M2');
    // marker amp readouts in dBm
    expect(text).toMatch(/dBm/);
  });

  it('mounts with replay mode without throwing', () => {
    expect(() =>
      render(<AnalyzerControlPanel panel={makePanel()} mode="replay" />)
    ).not.toThrow();
  });
});
