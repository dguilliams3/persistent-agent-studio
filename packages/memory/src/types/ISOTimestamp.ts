/**
 * ISO 8601 timestamp string.
 *
 * Storage: Always UTC (e.g., "2026-01-27T19:52:00.000Z")
 * Display: Convert to Eastern for user-facing output
 *
 * @example "2026-01-27T19:52:00.000Z"
 */
import type { Brand } from './Brand';

export type ISOTimestamp = Brand<string, 'ISOTimestamp'>;
