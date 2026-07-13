/**
 * Message metadata helpers.
 *
 * @module packages/ui/renderers/messageMetadata
 * @description Pure parsers for optional message metadata blobs. These helpers
 * keep ChatBubble from duplicating defensive JSON handling when the backend
 * sends `metadata` as either an object, a JSON string, or null.
 *
 * @upstream Called by: ChatBubble
 * @downstream Calls: none
 */

export interface MessageSenderMetadata {
  from?: string;
}

/**
 * Extracts the sender label from message metadata.
 *
 * Accepts object, JSON string, or nullish metadata and returns a trimmed
 * sender label when present. Invalid JSON or non-object metadata returns null.
 */
export function parseMessageSenderMetadata(
  metadata: unknown,
): MessageSenderMetadata | null {
  if (!metadata) return null;

  const parsed =
    typeof metadata === 'string'
      ? safeParseMetadata(metadata)
      : typeof metadata === 'object'
        ? metadata
        : null;

  if (!parsed || Array.isArray(parsed)) return null;

  const from = (parsed as Record<string, unknown>).from;
  if (typeof from !== 'string') return null;

  const trimmed = from.trim();
  return trimmed ? { from: trimmed } : null;
}

function safeParseMetadata(rawMetadata: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawMetadata) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
