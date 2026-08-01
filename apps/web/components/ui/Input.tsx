/**
 * @module Input
 * @description Styled text input with label and error state.
 *
 * PRESENTATIONAL — pure form element, no domain logic.
 *
 * Uses the .input CSS class from index.css for base styling.
 * Error state adds a danger border and displays an error message.
 *
 * @upstream Called by: Forms, settings panels, editors
 * @downstream Calls: None — leaf presentational component
 * @pattern UI Primitive — stateless, variant-driven, no domain logic
 */

import type { InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm text-content-secondary mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          input
          ${error ? 'border-danger' : ''}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
