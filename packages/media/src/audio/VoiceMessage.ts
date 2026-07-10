import type { AudioMedia } from './AudioMedia';

/**
 * A voice message received from a user — audio with optional transcription.
 *
 * Canonical voice message type. All clients import this from @persistence/media.
 * Platform-specific extensions extend this in their packages.
 *
 * @downstream packages/services/src/messaging/telegram — telegram voice handler reads transcription field
 * @downstream apps/web — voice message playback and transcription display components
 * @upstream packages/media/src/audio/AudioMedia — VoiceMessage extends AudioMedia
 * @pattern domain-ownership — canonical type lives here; platforms extend, never redefine
 * @antipattern DO NOT define voice message types in platform packages — extend this one.
 *   The base VoiceMessage lives here; platform packages add platform-specific fields.
 * @tested_by packages/media/__tests__/audio.test.ts
 */
export interface VoiceMessage extends AudioMedia {
  /** Transcription result */
  transcription?: string;
  /** Whether transcription has been verified/corrected */
  transcriptionVerified?: boolean;
}
