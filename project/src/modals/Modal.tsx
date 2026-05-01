/**
 * Base Modal wrapper (US-020) — overlay + dialog scaffold shared by all modals.
 *
 * Visual fidelity: matches public/app/styles.css `modal-overlay` + `modal-dialog`
 * classes from the prototype. ESC + overlay click both invoke onClose. Dialog
 * click does not propagate to the overlay.
 */

import { useEffect, type ReactNode, type MouseEvent } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Modal({ isOpen, onClose, children, className, ariaLabel }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="modal-overlay">
      <div
        className={`modal-dialog ${className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={stop}
      >
        {children}
      </div>
    </div>
  );
}
