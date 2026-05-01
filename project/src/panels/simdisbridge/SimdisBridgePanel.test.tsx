/**
 * SimdisBridgePanel (US-018b) — RTL tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SimdisBridgePanel } from './SimdisBridgePanel';
import { useIntegrationStore } from '../../store/integrationStore';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-simdis',
    kind: 'simdisbridge',
    title: 'SimDIS Test',
    layoutNodeId: 'ln-sd',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/simdisbridge/SimdisBridgePanel (US-018b)', () => {
  beforeEach(() => {
    useIntegrationStore.getState().reset();
  });

  it('renders a panel-body simdis root container', () => {
    const { container } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(container.querySelector('.panel-body.simdis')).not.toBeNull();
  });

  it('shows DISCONNECTED status by default', () => {
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-state').textContent).toContain('DISCONNECTED');
  });

  it('shows mode "DISCONNECTED" by default', () => {
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-mode').textContent).toContain('DISCONNECTED');
  });

  it('updates the DOM when simdis mode is changed to network-bridge', () => {
    useIntegrationStore.getState().setSimdisState({ mode: 'network-bridge' });
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-mode').textContent).toContain('NETWORK-BRIDGE');
    expect(getByTestId('bridge-state').textContent).toContain('CONNECTED');
  });

  it('clicking "Connect" toggles mode from disconnected → file-replay', () => {
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    const btn = getByTestId('connect-toggle');
    expect(btn.textContent).toBe('Connect');
    fireEvent.click(btn);
    expect(useIntegrationStore.getState().simdis.mode).toBe('file-replay');
    expect(getByTestId('bridge-state').textContent).toContain('CONNECTED');
  });

  it('clicking "Disconnect" while connected sets mode → disconnected', () => {
    useIntegrationStore.getState().setSimdisState({ mode: 'file-replay' });
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    const btn = getByTestId('connect-toggle');
    expect(btn.textContent).toBe('Disconnect');
    fireEvent.click(btn);
    expect(useIntegrationStore.getState().simdis.mode).toBe('disconnected');
  });

  it('renders "Push Cursor to SimDIS" button (no-op handler in slice 1)', () => {
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    const btn = getByTestId('push-cursor');
    expect(btn).not.toBeNull();
    // Click should not throw
    expect(() => fireEvent.click(btn)).not.toThrow();
  });

  it('shows scenarioId when set in store', () => {
    useIntegrationStore.getState().setSimdisState({ scenarioId: 'lab-kadena-01.asi' });
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-scenario').textContent).toContain('lab-kadena-01');
  });

  it('shows "—" placeholder when scenarioId is missing', () => {
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-scenario').textContent).toContain('—');
  });

  it('shows selectedEntityId when set in store', () => {
    useIntegrationStore.getState().setSimdisState({ selectedEntityId: 'TGT-07' });
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-entity').textContent).toContain('TGT-07');
  });

  it('shows sync state in plain text', () => {
    useIntegrationStore.getState().setSimdisState({ syncEnabled: true });
    const { getByTestId } = render(<SimdisBridgePanel panel={makePanel()} />);
    expect(getByTestId('bridge-sync').textContent).toContain('enabled');
  });
});
