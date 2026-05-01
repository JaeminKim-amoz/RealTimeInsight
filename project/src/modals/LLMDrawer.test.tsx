/**
 * LLMDrawer (US-2-004b) — RTL tests for FULL implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LLMDrawer } from './LLMDrawer';
import { useSelectionStore } from '../store/selectionStore';

describe('modals/LLMDrawer (US-2-004b FULL)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders close button and 4 suggested prompts', () => {
    render(<LLMDrawer isOpen onClose={() => {}} />);
    expect(screen.getByTestId('llm-close')).toBeInTheDocument();
    expect(screen.getByTestId('llm-prompt-Why this anomaly?')).toBeInTheDocument();
    expect(screen.getByTestId('llm-prompt-Show related channels')).toBeInTheDocument();
    expect(screen.getByTestId('llm-prompt-Compare to last run')).toBeInTheDocument();
    expect(screen.getByTestId('llm-prompt-Explain CRC burst')).toBeInTheDocument();
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LLMDrawer isOpen onClose={onClose} />);
    await user.click(screen.getByTestId('llm-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('drawer-right side anchored class is applied', () => {
    render(<LLMDrawer isOpen onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/llm-drawer/);
    expect(dialog.className).toMatch(/drawer-right/);
  });

  it('typing query and clicking send adds an assistant turn with tool trace', async () => {
    const user = userEvent.setup();
    render(<LLMDrawer isOpen onClose={() => {}} />);
    const input = screen.getByTestId('llm-input');
    await user.type(input, 'Why this anomaly?');
    await user.click(screen.getByTestId('llm-send'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-assistant-turn-0')).toBeInTheDocument();
    });
    // Tool trace summary visible.
    expect(screen.getByTestId('llm-tooltrace-toggle-0')).toBeInTheDocument();
  });

  it('clicking tool-trace toggle expands the trace panel', async () => {
    const user = userEvent.setup();
    render(<LLMDrawer isOpen onClose={() => {}} />);
    await user.type(screen.getByTestId('llm-input'), 'Why this anomaly?');
    await user.click(screen.getByTestId('llm-send'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-tooltrace-toggle-0')).toBeInTheDocument();
    });
    // Initially collapsed
    expect(screen.queryByTestId('llm-tooltrace-panel-0')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('llm-tooltrace-toggle-0'));
    expect(screen.getByTestId('llm-tooltrace-panel-0')).toBeInTheDocument();
  });

  it('citation gate shows warning when answer is missing required evidence', async () => {
    const user = userEvent.setup();
    // Activate the anomaly so requiredEvidenceIds is non-empty.
    useSelectionStore.getState().selectAnomaly('anom-001');
    render(<LLMDrawer isOpen onClose={() => {}} />);
    // 'Show related channels' returns empty cited list while anomaly active → gate fails.
    await user.type(screen.getByTestId('llm-input'), 'Show related channels');
    await user.click(screen.getByTestId('llm-send'));
    await waitFor(() => {
      expect(screen.getByTestId('llm-assistant-turn-0')).toBeInTheDocument();
    });
    const turn = screen.getByTestId('llm-assistant-turn-0');
    expect(turn.className).toMatch(/llm-citation-fail/);
    expect(screen.getByTestId('llm-citation-warning-0')).toBeInTheDocument();
  });

  it('clicking a suggested prompt seeds the input', async () => {
    const user = userEvent.setup();
    render(<LLMDrawer isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('llm-prompt-Why this anomaly?'));
    const input = screen.getByTestId('llm-input') as HTMLTextAreaElement;
    expect(input.value).toBe('Why this anomaly?');
  });

  it('Why this anomaly? button uses selectedAnomalyId to seed query', async () => {
    const user = userEvent.setup();
    useSelectionStore.getState().selectAnomaly('anom-001');
    render(<LLMDrawer isOpen onClose={() => {}} />);
    await user.click(screen.getByTestId('llm-quick-why'));
    const input = screen.getByTestId('llm-input') as HTMLTextAreaElement;
    expect(input.value).toMatch(/anom-001/);
  });
});
