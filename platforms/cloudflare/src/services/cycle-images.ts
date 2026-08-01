/**
 * Cycle Image Assembly
 *
 * @module services/cycle-images
 * @description Assembles image content for the thinking cycle's user message.
 * Handles User's images (with R2 resolution), Claude's art (with decay),
 * VIEW_IMAGES requests, and profile picture injection.
 *
 * @upstream Called by: orchestrator buildUserContent callback
 * @downstream Calls: services/media (R2 storage), @persistence/db (state)
 */

import type { DrizzleD1 } from "@persistence/db";
import { getState } from "@persistence/db";
import { isR2Reference, extractR2Key, getMedia } from "./media/index";
import { CLAUDE_IMAGE_LIMITS } from "../constants";
import type {
  SystemPromptResult,
  UserContent,
  ImageData,
  ArtImageData,
  ViewImageData,
} from "@persistence/runtime";

// =============================================================================
// TYPES
// =============================================================================

/** R2 bucket interface (Cloudflare Workers binding) */
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

/** R2 object body from Cloudflare Workers */
interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Validated image ready for Anthropic API */
interface ValidatedImage {
  mediaType: string;
  data: string;
  time: string;
  text?: string;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * @description Build the user content array for a thinking cycle.
 * Includes the cycle prompt text and all image categories.
 *
 * @param db - Database instance
 * @param loopCount - Current loop iteration count
 * @param promptResult - Result from buildSystemPrompt containing image data
 * @param mediaBucket - R2 bucket for resolving R2 references
 * @returns User content array for the Anthropic API
 */
export async function buildUserContent(
  db: DrizzleD1,
  loopCount: number,
  promptResult: SystemPromptResult,
  mediaBucket: R2Bucket,
): Promise<UserContent[]> {
  const userMessageText = `[Cycle #${loopCount + 1}] What do you want to do?`;
  const userContent: UserContent[] = [{ type: "text", text: userMessageText }];

  // Add User's images
  await appendUserImages(userContent, promptResult.userImages, mediaBucket);

  // Add Claude's art (with visibility decay)
  await appendClaudeArt(userContent, promptResult.claudeArtImages, db);

  // Add requested VIEW_IMAGES
  appendViewImages(userContent, promptResult.pendingViewImages);

  // Add profile picture (spliced to position 1)
  await appendProfilePicture(userContent, db);

  return userContent;
}

// =============================================================================
// USER'S IMAGES
// =============================================================================

/**
 * @description Process and append User's recent images to user content.
 * Handles R2 references, base64 validation, size limits, and magic byte detection.
 */
async function appendUserImages(
  userContent: UserContent[],
  userImages: ImageData[],
  mediaBucket: R2Bucket,
): Promise<void> {
  const recentImages = userImages.slice(-3);
  if (recentImages.length === 0) return;

  const validImages: ValidatedImage[] = [];
  for (const img of recentImages) {
    const validated = await validateAndResolveImage(img, mediaBucket);
    if (validated) validImages.push(validated);
  }

  if (validImages.length === 0) return;

  userContent.push({
    type: "text",
    text: `\n\nIMAGES USER SENT (${validImages.length} recent):`,
  });
  for (const img of validImages) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    });
    userContent.push({
      type: "text",
      text: `[Image from ${img.time}${img.text ? `: "${img.text}"` : ""}]`,
    });
  }
}

/**
 * @description Validate a single image: resolve R2 refs, check size, detect format.
 * Returns null if the image should be skipped.
 */
async function validateAndResolveImage(
  img: ImageData,
  mediaBucket: R2Bucket,
): Promise<ValidatedImage | null> {
  if (!img.image || typeof img.image !== "string") {
    console.log("Skipping image: missing or invalid image data");
    return null;
  }

  let base64Data: string;

  if (isR2Reference(img.image)) {
    const resolved = await resolveR2Image(img.image, mediaBucket);
    if (!resolved) return null;
    base64Data = resolved;
  } else {
    const match = img.image.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!match) {
      console.log("Skipping image: failed to parse data URL");
      return null;
    }
    base64Data = match[1];
  }

  if (base64Data.length < 100) {
    console.log("Skipping image: base64 data too short");
    return null;
  }

  if (base64Data.length > CLAUDE_IMAGE_LIMITS.maxBase64Chars) {
    const estimatedMB = ((base64Data.length * 3) / 4 / 1024 / 1024).toFixed(1);
    console.log(
      `Skipping image: exceeds Claude 5MB limit (${estimatedMB}MB) - ${img.text || "untitled"}`,
    );
    return null;
  }

  const mediaType = detectMediaType(base64Data);
  if (!mediaType) {
    console.log(
      `Skipping image: unrecognized format (starts with: ${base64Data.substring(0, 10)}...)`,
    );
    return null;
  }

  return { mediaType, data: base64Data, time: img.time, text: img.text };
}

// =============================================================================
// R2 RESOLUTION
// =============================================================================

/**
 * @description Fetch an image from R2 and convert to base64 using chunked conversion.
 *
 * @antipattern SPREAD_LARGE_ARRAYS
 * // WRONG: btoa(String.fromCharCode(...bytes)) blows call stack for >100KB
 * // CORRECT: Process in 32KB chunks (2x safety margin under ~65K arg limit)
 */
async function resolveR2Image(
  imageRef: string,
  mediaBucket: R2Bucket,
): Promise<string | null> {
  const key = extractR2Key(imageRef);
  if (!key) {
    console.log("Skipping image: failed to extract R2 key from reference");
    return null;
  }
  const r2Result = await getMedia(mediaBucket as any, key);
  if (!r2Result.success) {
    console.log(`Skipping image: R2 fetch failed - ${r2Result.error}`);
    return null;
  }

  const bytes = new Uint8Array(r2Result.data as ArrayBuffer);
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64Data = btoa(binary);
  console.log(
    `Resolved R2 image: ${key} (${bytes.length} bytes → ${base64Data.length} base64 chars)`,
  );
  return base64Data;
}

// =============================================================================
// MAGIC BYTE DETECTION
// =============================================================================

/**
 * @description Detect image media type from base64-encoded magic bytes.
 * Returns null for unrecognized formats.
 *
 * Magic byte prefixes in base64:
 * - JPEG: /9j/ (FFD8FF)
 * - PNG: iVBOR (89504E47)
 * - GIF: R0lGOD (47494638)
 * - WebP: UklGR (52494646)
 * - BMP: Qk (424D)
 * - TIFF: SUkq or TU0A (49492A00 or 4D4D002A)
 */
export function detectMediaType(base64Data: string): string | null {
  if (base64Data.startsWith("/9j/")) return "image/jpeg";
  if (base64Data.startsWith("iVBOR")) return "image/png";
  if (base64Data.startsWith("R0lGOD")) return "image/gif";
  if (base64Data.startsWith("UklGR")) return "image/webp";
  if (base64Data.startsWith("Qk")) return "image/bmp";
  if (base64Data.startsWith("SUkq") || base64Data.startsWith("TU0A"))
    return "image/tiff";
  return null;
}

// =============================================================================
// CLAUDE'S ART (with visibility decay)
// =============================================================================

/**
 * @description Append Claude's art images with configurable visibility window.
 * Recent images shown as multimodal content; older ones decay to text placeholders.
 */
async function appendClaudeArt(
  userContent: UserContent[],
  claudeArtImages: ArtImageData[],
  db: DrizzleD1,
): Promise<void> {
  if (claudeArtImages.length === 0) return;

  const maxVisibleImages = parseInt(
    (await getState(db, "max_visible_images")) || "5",
  );
  const totalArt = claudeArtImages.length;

  const visibleArt = claudeArtImages.slice(-maxVisibleImages);
  const decayedArt = claudeArtImages.slice(
    0,
    Math.max(0, totalArt - maxVisibleImages),
  );

  // Decayed images as text placeholders
  if (decayedArt.length > 0) {
    userContent.push({
      type: "text",
      text: `\n\nMY OLDER ART (${decayedArt.length} image${decayedArt.length > 1 ? "s" : ""} I made but can no longer see clearly):`,
    });
    for (const art of decayedArt) {
      userContent.push({
        type: "text",
        text: `[image from ${art.time}: "${art.prompt}"]`,
      });
    }
  }

  // Visible images as multimodal content
  userContent.push({
    type: "text",
    text: `\n\nMY ART (${visibleArt.length} recent creation${visibleArt.length > 1 ? "s" : ""} I can see):`,
  });
  for (const art of visibleArt) {
    const parsed = parseDataUrl(art.image);
    if (parsed) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType,
          data: parsed.base64Data,
        },
      });
      userContent.push({
        type: "text",
        text: `[My art from ${art.time}: "${art.prompt}"]`,
      });
    }
  }
}

// =============================================================================
// VIEW_IMAGES
// =============================================================================

/**
 * @description Append requested VIEW_IMAGES (images Claude asked to see).
 * These auto-clear after the cycle.
 */
function appendViewImages(
  userContent: UserContent[],
  pendingViewImages: ViewImageData[],
): void {
  if (pendingViewImages.length === 0) return;

  userContent.push({
    type: "text",
    text: `\n\nREQUESTED IMAGES (${pendingViewImages.length} image${pendingViewImages.length > 1 ? "s" : ""} I asked to see):`,
  });
  for (const pv of pendingViewImages.slice(0, 5)) {
    const parsed = pv.image ? parseDataUrl(pv.image) : null;
    if (parsed) {
      const prompt =
        pv.prompt?.replace(
          /^Generated:\s*|^User's prompt:\s*/i,
          "",
        ) || "untitled";
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType,
          data: parsed.base64Data,
        },
      });
      userContent.push({
        type: "text",
        text: `[Image #${pv.image_id}: "${prompt}"]`,
      });
    }
  }
}

// =============================================================================
// PROFILE PICTURE
// =============================================================================

/**
 * @description Append profile picture to user content at position 1.
 * Anthropic API only allows text in system prompt, so the actual image
 * goes in user content (reference in system prompt via buildSystemBlocks).
 */
async function appendProfilePicture(
  userContent: UserContent[],
  db: DrizzleD1,
): Promise<void> {
  const profilePictureImage = await getState(db, "profile_picture");
  if (!profilePictureImage) return;

  const parsed = parseDataUrl(profilePictureImage);
  if (!parsed) return;

  const profilePicturePrompt = await getState(db, "profile_picture_prompt");

  // Insert at position 1 (after the initial cycle prompt text)
  userContent.splice(
    1,
    0,
    {
      type: "text",
      text: `\n\nMY PROFILE PICTURE (my chosen self-representation):`,
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType,
        data: parsed.base64Data,
      },
    },
    {
      type: "text",
      text: `[Profile: "${profilePicturePrompt || "No description"}"]`,
    },
  );
}

// =============================================================================
// DATA URL PARSING
// =============================================================================

/**
 * @description Parse a data URL into media type and base64 data.
 * Returns null if the URL doesn't match the expected format.
 */
function parseDataUrl(
  dataUrl: string,
): { mediaType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: `image/${match[1]}`, base64Data: match[2] };
}
