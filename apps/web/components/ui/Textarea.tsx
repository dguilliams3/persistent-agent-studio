/**
 * @module Textarea
 * @description Styled multiline text input with label and error state.
 *
 * PRESENTATIONAL — pure form element, no domain logic.
 *
 * Uses the .input CSS class from index.css for base styling.
 * Same pattern as Input but for multiline content.
 *
 * @upstream Called by: Forms, editors, content input areas
 * @downstream Calls: None — leaf presentational component
 */

import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string;
  error?: string;
  className?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm text-content-secondary mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          input resize-y min-h-[80px]
          ${error ? 'border-danger focus:border-danger focus:shadow-none' : ''}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
