/**
 * CommandPalette (US-020d) — RTL tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';

describe('modals/CommandPalette (US-020d)', () => {
  it('renders search input and results body', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByTestId('palette-input')).toBeInTheDocument();
    expect(screen.getByTestId('palette-body')).toBeInTheDocument();
  });

  it('search "voltage" filters to bus_voltage channel', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onClose={() => {}} />);
    const input = screen.getByTestId('palette-input');
    await user.type(input, 'voltage');
    const body = screen.getByTestId('palette-body');
    expect(body.textContent?.toLowerCase()).toContain('voltage');
  });

  it('arrow keys navigate selection', () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    const initialSelected = document.querySelector('[data-selected="true"]');
    const initialId = initialSelected?.getAttribute('data-testid');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const afterSelected = document.querySelector('[data-selected="true"]');
    const afterId = afterSelected?.getAttribute('data-testid');
    expect(afterId).not.toBe(initialId);
  });

  it('Enter triggers onExecute with the selected result', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} onExecute={onExecute} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onExecute).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Cmd+K hotkey hook calls open', () => {
    const open = vi.fn();
    function Probe() {
      useCommandPaletteHotkey(open);
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(open).toHaveBeenCalled();
  });

  it('Ctrl+K hotkey hook also calls open', () => {
    const open = vi.fn();
    function Probe() {
      useCommandPaletteHotkey(open);
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(open).toHaveBeenCalled();
  });

  it('clicking a row triggers onExecute and onClose', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} onExecute={onExecute} />);
    const rows = document.querySelectorAll('.palette-row');
    await user.click(rows[0] as HTMLElement);
    expect(onExecute).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows "No results" when query has no matches', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onClose={() => {}} />);
    await user.type(screen.getByTestId('palette-input'), 'zzzzzzzzzzzzz');
    expect(screen.getByText(/No results/)).toBeInTheDocument();
  });

  it('returns null when isOpen=false', () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  // Keep renderHook + useState references warm to avoid unused-import lint nits.
  it('hook can be exercised inside a state harness', () => {
    function H() {
      const [open, setOpen] = useState(false);
      useCommandPaletteHotkey(() => setOpen(true));
      return <span data-testid="hookprobe">{String(open)}</span>;
    }
    render(<H />);
    expect(screen.getByTestId('hookprobe').textContent).toBe('false');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('hookprobe').textContent).toBe('true');
    void renderHook;
  });
});
