/**
 * Personality Snapshot Validation Functions
 *
 * @module @persistence/memory/snapshot/validation
 * @description Format validation for personality snapshots.
 *
 * Validates that snapshots conform to the expected structure and version,
 * providing detailed error messages for invalid snapshots.
 *
 * @upstream Used by: personality.js import/validate handlers
 * @downstream Uses: snapshot/constants (SNAPSHOT_VERSION, REQUIRED_MEMORY_TYPES)
 */

import { SNAPSHOT_VERSION, REQUIRED_MEMORY_TYPES } from './constants';
import type { PersonalitySnapshot, ValidationResult } from './types';

/**
 * Validates a snapshot matches the expected format version.
 *
 * Checks for:
 * - Required top-level fields (meta, state, memories)
 * - Required meta fields (version, exportedAt)
 * - Correct version number
 * - Memory arrays are present and are arrays
 *
 * @param snapshot - The snapshot to validate
 * @returns Validation result with valid flag and error list
 *
 * @example
 * const { valid, errors } = validateSnapshotFormat(snapshot);
 * if (!valid) {
 *   console.error('Invalid snapshot:', errors);
 * }
 */
export function validateSnapshotFormat(
  snapshot: PersonalitySnapshot | Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];

  // Check required top-level fields
  if (!snapshot.meta) {
    errors.push('Missing required field: meta');
  }
  if (!snapshot.state) {
    errors.push('Missing required field: state');
  }
  if (!snapshot.memories) {
    errors.push('Missing required field: memories');
  }

  // Check meta fields
  const meta = snapshot.meta as PersonalitySnapshot['meta'] | undefined;
  if (meta) {
    if (!meta.version) {
      errors.push('Missing meta.version');
    }
    if (!meta.exportedAt) {
      errors.push('Missing meta.exportedAt');
    }
    if (meta.version && meta.version !== SNAPSHOT_VERSION) {
      errors.push(
        `Unsupported version: ${meta.version} (expected ${SNAPSHOT_VERSION})`
      );
    }
  }

  // Check memories structure
  const memories = snapshot.memories as PersonalitySnapshot['memories'] | undefined;
  if (memories) {
    for (const type of REQUIRED_MEMORY_TYPES) {
      const value = memories[type as keyof typeof memories];
      if (!Array.isArray(value)) {
        errors.push(`memories.${type} must be an array`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
