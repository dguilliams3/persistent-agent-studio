/**
 * Messaging Types - Message delivery capability interfaces
 *
 * @module @persistence/services/messaging/types
 * @description Provider-agnostic types for optional outbound messaging adapters.
 *
 * The public clean-room extraction intentionally ships zero concrete channel
 * adapters. These interfaces remain as an extension point for downstream users
 * who want to plug in their own transport.
 */

import type { ServiceResult, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Messaging service interface.
 *
 * All messaging providers must implement this interface.
 *
 * @example
 * const messaging: MessagingService = myAdapter;
 * const result = await messaging.sendText(chatId, 'Hello!');
 */
export interface MessagingService {
  /**
   * Send a text message.
   *
   * @param chatId - Target chat/channel identifier
   * @param text - Message text
   * @param options - Formatting and delivery options
   */
  sendText(
    chatId: string,
    text: string,
    options?: TextMessageOptions
  ): Promise<ServiceResult<MessageResult>>;

  /**
   * Send a photo.
   *
   * @param chatId - Target chat/channel identifier
   * @param photo - Photo URL or base64 data
   * @param options - Caption and delivery options
   */
  sendPhoto(
    chatId: string,
    photo: string | ArrayBuffer,
    options?: PhotoMessageOptions
  ): Promise<ServiceResult<MessageResult>>;

  /**
   * Send a document/file.
   *
   * @param chatId - Target chat/channel identifier
   * @param document - Document data
   * @param options - Filename and delivery options
   */
  sendDocument(
    chatId: string,
    document: string | ArrayBuffer,
    options?: DocumentMessageOptions
  ): Promise<ServiceResult<MessageResult>>;

  /**
   * Get provider name.
   */
  getProviderName(): string;
}

/**
 * Extended messaging service with voice support.
 */
export interface VoiceMessagingService extends MessagingService {
  /**
   * Send a voice message.
   *
   * @param chatId - Target chat/channel identifier
   * @param audio - Audio data (MP3/OGG)
   * @param options - Voice message options
   */
  sendVoice(
    chatId: string,
    audio: ArrayBuffer,
    options?: VoiceMessageOptions
  ): Promise<ServiceResult<MessageResult>>;
}

// =============================================================================
// MESSAGE OPTIONS
// =============================================================================

/**
 * Base options for all message types.
 */
export interface BaseMessageOptions extends HttpOptions {
  /** Disable notification sound */
  silent?: boolean;
  /** Reply to message ID */
  replyToMessageId?: string | number;
}

/**
 * Options for text messages.
 */
export interface TextMessageOptions extends BaseMessageOptions {
  /** Parse mode: HTML, Markdown, MarkdownV2 */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | 'plain';
  /** Disable link previews */
  disableLinkPreview?: boolean;
  /** Inline keyboard buttons (provider-specific) */
  replyMarkup?: unknown;
  /** Auto-escape HTML special characters */
  escapeHtml?: boolean;
}

/**
 * Options for photo messages.
 */
export interface PhotoMessageOptions extends BaseMessageOptions {
  /** Caption for the photo */
  caption?: string;
  /** Caption parse mode */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | 'plain';
  /** Whether to send as uncompressed document */
  sendAsDocument?: boolean;
}

/**
 * Options for document messages.
 */
export interface DocumentMessageOptions extends BaseMessageOptions {
  /** Filename to display */
  filename?: string;
  /** Caption for the document */
  caption?: string;
  /** Caption parse mode */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | 'plain';
  /** MIME type hint */
  mimeType?: string;
}

/**
 * Options for voice messages.
 */
export interface VoiceMessageOptions extends BaseMessageOptions {
  /** Duration in seconds */
  duration?: number;
  /** Caption (if supported) */
  caption?: string;
}

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result from sending a message.
 */
export interface MessageResult {
  /** Whether send was successful */
  sent: boolean;
  /** Message ID (if available) */
  messageId?: string | number;
  /** Provider name */
  provider: string;
}

