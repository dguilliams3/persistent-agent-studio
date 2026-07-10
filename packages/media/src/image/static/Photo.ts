import type { StaticImage } from './StaticImage';

/**
 * A photograph — a static image captured by a camera or device.
 *
 * Canonical photo type. All clients import this from @persistence/media.
 * Platform-specific extensions (e.g., TelegramPhoto) extend this in their packages.
 *
 * @downstream packages/services/src/messaging/telegram — TelegramPhoto extends Photo with fileId/chatId
 * @downstream apps/web — photo gallery and user-upload components
 * @upstream packages/media/src/image/static/StaticImage — Photo extends StaticImage
 * @pattern domain-ownership — canonical type lives here; platforms extend, never redefine
 * @antipattern DO NOT define photo types in platform packages — extend this one.
 *   The base Photo lives here; platform packages add platform-specific fields.
 * @tested_by packages/media/__tests__/image.test.ts
 */
export interface Photo extends StaticImage {
  /** Photo-specific: camera/device origin */
  captureDevice?: string;
}
