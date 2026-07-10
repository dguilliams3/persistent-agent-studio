/**
 * Messaging Capability - abstract outbound messaging interfaces
 *
 * @module @persistence/services/messaging
 * @description Provider-agnostic outbound messaging contracts only.
 *
 * The public clean-room extraction intentionally ships zero concrete channel
 * adapters. Downstream consumers can implement these interfaces for their own
 * notification or chat transports.
 *
 * @example
 * import { type MessagingService } from '@persistence/services/messaging';
 *
 * const messaging: MessagingService = myAdapter;
 * await messaging.sendText(chatId, 'Hello from my adapter!');
 */

export type {
  MessagingService,
  VoiceMessagingService,
  BaseMessageOptions,
  TextMessageOptions,
  PhotoMessageOptions,
  DocumentMessageOptions,
  VoiceMessageOptions,
  MessageResult,
} from './types.js';
