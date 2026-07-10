/**
 * @module Modal
 * @description Overlay + content container with close handler.
 *
 * PRESENTATIONAL — renders modal chrome, no domain logic.
 *
 * Renders a backdrop overlay and centered content panel.
 * Closes on backdrop click and Escape key.
 *
 * @upstream Called by: Confirmation dialogs, detail views, forms
 * @downstream Calls: Icon (X) for close button
 * @pattern UI Primitive — handles keyboard (Escape) and backdrop click, no domain logic
 */

import { useEffect, useCallback, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={`
          relative card-elevated p-6 max-w-lg w-full mx-4
          animate-fade-in
          ${className}
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-content-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-content-muted hover:text-content-primary transition-colors duration-fast"
              aria-label="Close"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
        )}

        {/* No title — just show close button in top-right */}
        {!title && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-content-muted hover:text-content-primary transition-colors duration-fast"
            aria-label="Close"
          >
            <Icon name="X" size={20} />
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
