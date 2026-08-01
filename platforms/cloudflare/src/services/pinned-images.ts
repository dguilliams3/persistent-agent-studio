/**
 * Pinned image and gallery helpers.
 *
 * @module services/pinned-images
 * @description Encapsulates PIN_IMAGE and VIEW_IMAGES action behavior so
 *              execution paths can import a single helper instead of
 *              reimplementing slot swapping, logging, and validation.
 */
import {
  pinImage,
  unpinImage,
  swapPinnedImages,
  getPinnedImages,
  requestViewImages
} from '../db/index.js';
import { logHistory } from '../utils/index.js';

type PinDecision = {
  op?: string;
  slot?: string;
  image_id?: number | string;
  slot_a?: string;
  slot_b?: string;
  ids?: string | number[];
  internal?: string;
};

/**
 * @description Execute PIN_IMAGE operations (pin/unpin/swap/list).
 *
 * @upstream Called by: PIN_IMAGE action handler (worker/src/index.js, future tool handlers)
 * @downstream Calls: pinImage(), unpinImage(), swapPinnedImages(), getPinnedImages(), logHistory()
 *
 * @param {Object} params - Execution context
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.decision - Tool payload with slot/image details
 * @param {string} params.cycleId - Current cycle ID for history logging
 * @returns {Promise<void>}
 */
export async function executePinImageAction({ db, decision, cycleId }: { db: D1Database; decision: PinDecision; cycleId: number }) {
  const pinOp = decision.op || 'pin';

  switch (pinOp) {
    case 'pin':
      if (decision.slot && decision.image_id) {
        const slot = parseInt(decision.slot, 10);
        const imageId = parseInt(String(decision.image_id), 10);
        const result = await pinImage(db, slot, imageId);
        if (result.success) {
          await logHistory({ db, type: 'thought', content: `Pinned image #${decision.image_id} to slot ${decision.slot}`, internal: decision.internal, cycleId });
        } else {
          await logHistory({ db, type: 'thought', content: `Failed to pin image: ${result.error || 'invalid slot or image'}`, internal: decision.internal, cycleId });
        }
      }
      break;

    case 'unpin':
      if (decision.slot) {
        const slot = parseInt(decision.slot, 10);
        const result = await unpinImage(db, slot);
        await logHistory({ db, type: 'thought', content: `Cleared slot ${decision.slot}${result.removed ? '' : ' (was already empty)'}`, internal: decision.internal, cycleId });
      }
      break;

    case 'swap':
      if (decision.slot_a && decision.slot_b) {
        const slotA = parseInt(decision.slot_a, 10);
        const slotB = parseInt(decision.slot_b, 10);
        const result = await swapPinnedImages(db, slotA, slotB);
        if (result.success) {
          await logHistory({ db, type: 'thought', content: `Swapped slots ${decision.slot_a} and ${decision.slot_b}`, internal: decision.internal, cycleId });
        }
      }
      break;

    case 'list': {
      const pins = await getPinnedImages(db);
      const pinSummary = pins.length > 0
        ? pins.map(p => `[${p.slot}] #${p.image_id}`).join(', ')
        : 'all slots empty';
      await logHistory({ db, type: 'thought', content: `Image wall: ${pinSummary}`, internal: decision.internal, cycleId });
      break;
    }

    default:
      break;
  }
}

/**
 * @description Execute VIEW_IMAGES action by normalizing the id list and logging.
 *
 * @upstream Called by: VIEW_IMAGES action handler
 * @downstream Calls: requestViewImages(), logHistory()
 *
 * @param {Object} params - Execution context
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.decision - Tool payload containing ids to view
 * @param {string} params.cycleId - Current cycle ID for history logging
 * @returns {Promise<void>}
 */
export async function executeViewImagesAction({ db, decision, cycleId }: { db: D1Database; decision: PinDecision; cycleId: number }) {
  const ids = decision.ids;
  if (!ids) {
    return;
  }

  const idList = Array.isArray(ids)
    ? ids.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id))
    : String(ids).split(',').map(s => parseInt(s.trim(), 10)).filter(id => !isNaN(id));

  if (idList.length === 0) {
    return;
  }

  await requestViewImages(db, idList);
  await logHistory({ db, type: 'thought', content: `Requested to view images: ${idList.join(', ')}`, internal: decision.internal, cycleId });
}
