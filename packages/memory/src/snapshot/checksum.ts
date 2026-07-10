/**
 * Personality Snapshot Checksum Functions
 *
 * @module @persistence/memory/snapshot/checksum
 * @description SHA-256 checksum calculation and verification for snapshots.
 *
 * Uses the Web Crypto API (crypto.subtle) for cryptographic operations,
 * which is available in both browsers and Cloudflare Workers.
 *
 * @upstream Used by: personality.js export/import handlers
 * @downstream Uses: crypto.subtle (Web Crypto API)
 */

import type { PersonalitySnapshot } from './types';

/**
 * Calculates SHA-256 checksum of snapshot content (excluding meta).
 *
 * The meta field is excluded from the hash so that metadata changes
 * (like timestamps) don't invalidate the checksum of the actual content.
 *
 * @param snapshot - The snapshot object (meta field will be excluded)
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * const hash = await calculateChecksum(snapshot);
 * // => "a1b2c3d4e5..."
 */
export async function calculateChecksum(
  snapshot: PersonalitySnapshot | Record<string, unknown>
): Promise<string> {
  // Destructure to exclude meta from the hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { meta, ...content } = snapshot;

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the checksum of an imported snapshot.
 *
 * Compares the checksum stored in meta.checksum against a freshly
 * calculated checksum of the snapshot content. If no checksum is
 * present, returns true (allows imports without integrity verification).
 *
 * @param snapshot - The snapshot to verify
 * @returns True if checksum matches or no checksum present
 *
 * @example
 * if (!await verifyChecksum(snapshot)) {
 *   throw new Error('Snapshot may have been modified or corrupted');
 * }
 */
export async function verifyChecksum(
  snapshot: PersonalitySnapshot | Record<string, unknown>
): Promise<boolean> {
  const meta = snapshot.meta as PersonalitySnapshot['meta'] | undefined;
  if (!meta?.checksum) {
    return true; // No checksum to verify
  }

  const calculated = await calculateChecksum(snapshot);
  // Remove the "sha256:" prefix if present
  const expected = meta.checksum.replace('sha256:', '');

  return calculated === expected;
}
