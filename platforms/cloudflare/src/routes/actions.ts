/**
 * Action routes (platform re-export)
 *
 * @module routes/actions
 * @description Re-exports action handler functions from @persistence/db/handlers/actions.
 * handleSetProfilePicture is wrapped to inject the platform resizeImage function.
 */

import { resizeImage } from '../utils/image.js';

export {
  handlePostMessage,
  handleDeleteProfilePicture,
  handleSaveArt,
  handlePostColdStorage,
  handlePostNotebook,
  handleReset,
} from '@persistence/db/handlers/actions';

import { handleSetProfilePicture as _handleSetProfilePicture } from '@persistence/db/handlers/actions';

/**
 * Platform wrapper: injects resizeImage from platform utils.
 */
export async function handleSetProfilePicture(db: D1Database, body: Record<string, any>) {
  return _handleSetProfilePicture(db, body, resizeImage);
}
