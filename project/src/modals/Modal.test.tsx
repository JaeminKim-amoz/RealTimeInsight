/**
 * Modal base wrapper (US-020) — RTL tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('modals/Modal (US-020 base)', () => {
  it('renders children when isOpen=true', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <p>hello</p>
      </Modal>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('returns null when isOpen=false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>hello</p>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose on overlay click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose}>
        <p>x</p>
      </Modal>
    );
    await user.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on ESC key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        <p>x</p>
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not propagate dialog click to overlay', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose}>
        <button type="button">inner</button>
      </Modal>
    );
    await user.click(screen.getByText('inner'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies role=dialog and aria-modal=true', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <p>x</p>
      </Modal>
    );
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
  });

  it('applies className and ariaLabel', () => {
    render(
      <Modal isOpen onClose={() => {}} className="export-modal" ariaLabel="Export">
        <p>x</p>
      </Modal>
    );
    const dlg = screen.getByRole('dialog');
    expect(dlg.className).toContain('export-modal');
    expect(dlg).toHaveAttribute('aria-label', 'Export');
  });
});
