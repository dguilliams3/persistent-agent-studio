/**
 * Message Input Component
 *
 * @module components/ui/MessageInput
 * @description Chat input bar per SPEC_v1 design:
 * - Left: `+` button (opens attachment tray that pushes UP)
 * - Center: Text input field
 * - Right: Send `↑` button
 *
 * Attachment tray pushes the input bar up — does NOT float over chat.
 * Tray items: Image, File, Voice. Tapping + again or tapping outside closes tray.
 *
 * @antipattern Do NOT add a think button to this bar — think trigger is inline in chat.
 * @antipattern Do NOT use raw hex colors — use design tokens.
 * @antipattern Do NOT fetch data — accept callbacks via props.
 * @antipattern Do NOT float the tray over content — it pushes up.
 *
 * @upstream Called by: ChatView
 * @downstream Calls: onSend callback, onImageSelect callback
 */

import type React from 'react';
import { useCallback, useRef, useEffect, useState } from 'react';
import { Icon } from './Icon';

/** CSS for attachment tray animation, plus-rotation, tray-item hover, + reduced-motion. */
const TRAY_STYLES = `
.attachment-tray {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height var(--duration-fast) ease-out, opacity var(--duration-fast) ease-out;
}
.attachment-tray[data-open="true"] {
  max-height: 80px;
  opacity: 1;
}
.plus-btn-transition {
  transition: transform var(--duration-fast) ease-out, color var(--duration-fast) ease-out;
}
.tray-item-btn {
  transition: background-color var(--duration-fast) ease-out;
}
.tray-item-btn:hover {
  background-color: var(--surface-raised);
}
@media (prefers-reduced-motion: reduce) {
  .attachment-tray,
  .plus-btn-transition,
  .tray-item-btn {
    transition: none !important;
  }
}
`;

/** Attachment tray item configuration. */
interface TrayItem {
  key: string;
  label: string;
  icon: string;
  accept?: string;
}

const TRAY_ITEMS: TrayItem[] = [
  { key: 'image', label: 'Image', icon: 'Image', accept: 'image/*,video/mp4,video/webm,video/quicktime' },
  { key: 'file', label: 'File', icon: 'File', accept: '*/*' },
  { key: 'voice', label: 'Voice', icon: 'Mic' },
];

export interface MessageInputProps {
  /** Current text input value */
  value: string;
  /** Text change handler */
  onChange: (value: string) => void;
  /** Send message handler */
  onSend: () => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Disable input and buttons */
  disabled?: boolean;
  /** Image preview URL (shown below input when attachment queued) */
  imagePreview?: string | null;
  /** Legacy image select handler for file input */
  onImageSelect?: (event: { target: { files: FileList | File[] } }) => void;
  /** Clear queued image attachment */
  onClearImage?: () => void;
  /** Whether a video is currently being converted */
  isConvertingVideo?: boolean;
}

/**
 * Chat input bar: [+] [text field] [↑]
 *
 * The `+` button opens the attachment tray that pushes up from below.
 * Tapping + again or tapping outside closes the tray.
 */
export function MessageInput({
  value,
  onChange,
  onSend,
  placeholder = 'Say something...',
  disabled = false,
  imagePreview,
  onImageSelect,
  onClearImage,
  isConvertingVideo = false,
}: MessageInputProps) {
  const textInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSend();
      }
    },
    [onSend],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file && onImageSelect) {
            onImageSelect({ target: { files: [file] } });
          }
          return;
        }
      }
    },
    [onImageSelect],
  );

  /** Toggle attachment tray. */
  const handleAttachmentTap = useCallback(() => {
    setTrayOpen((prev) => !prev);
  }, []);

  /** Handle tray item tap — open file picker or voice recorder. */
  const handleTrayItemTap = useCallback(
    (item: TrayItem) => {
      if (item.key === 'voice') {
        /* Voice recording — placeholder for future implementation */
         
        console.log('Voice recording not yet implemented');
        setTrayOpen(false);
        return;
      }
      if (fileInputRef.current && item.accept) {
        fileInputRef.current.accept = item.accept;
        fileInputRef.current.click();
      }
      setTrayOpen(false);
    },
    [],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0 && onImageSelect) {
        onImageSelect({ target: { files } });
      }
      event.target.value = '';
    },
    [onImageSelect],
  );

  /** Close tray when clicking outside. */
  useEffect(() => {
    if (!trayOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [trayOpen]);

  useEffect(() => {
    textInputRef.current?.focus();
  }, []);

  const canSend = !disabled && (value.trim().length > 0 || !!imagePreview);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <style>{TRAY_STYLES}</style>

      {/* Image preview strip (when attachment queued) */}
      {imagePreview && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <img
            src={imagePreview}
            alt="Attachment preview"
            style={{
              maxHeight: '80px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          />
          {onClearImage && (
            <button
              onClick={onClearImage}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '4px',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Remove attachment"
            >
              <Icon name="X" size={18} />
            </button>
          )}
        </div>
      )}

      {/* Video conversion indicator */}
      {isConvertingVideo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm)',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
          }}
        >
          <Icon name="Loader" size={16} />
          <span>Converting video to GIF...</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Main input row: [+] [input] [↑] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs)',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* + attachment button (left) */}
        <button
          onClick={handleAttachmentTap}
          disabled={disabled}
          className="plus-btn-transition"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            border: 'none',
            background: 'none',
            cursor: disabled ? 'default' : 'pointer',
            color: trayOpen ? 'var(--text-primary)' : 'var(--accent)',
            fontSize: '1.25rem',
            fontWeight: 300,
            opacity: disabled ? 0.5 : 1,
            transform: trayOpen ? 'rotate(45deg)' : 'none',
          }}
          aria-label={trayOpen ? 'Close attachment tray' : 'Open attachment tray'}
          aria-expanded={trayOpen}
        >
          +
        </button>

        {/* Text input (center) */}
        <input
          ref={textInputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            padding: 'var(--spacing-sm) var(--spacing-xs)',
            lineHeight: '1.5',
            /* Prevents zoom on iOS when focused */
            maxHeight: '100px',
          }}
        />

        {/* Send ↑ button (right) */}
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: canSend ? 'var(--accent)' : 'var(--surface-raised)',
            color: canSend ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'default',
            fontSize: '1.125rem',
            fontWeight: 600,
            transition: 'background-color var(--duration-normal) ease-out, color var(--duration-normal) ease-out',
          }}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>

      {/* Attachment tray — renders AFTER input row so it pushes the bar up */}
      <div
        className="attachment-tray"
        data-open={trayOpen ? 'true' : 'false'}
      >
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {TRAY_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleTrayItemTap(item)}
              className="tray-item-btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                minWidth: '56px',
                minHeight: '44px',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label={`Attach ${item.label.toLowerCase()}`}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MessageInput;
