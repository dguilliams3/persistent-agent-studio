/**
 * Core Types — Re-export Bridge
 *
 * This file exists solely to maintain backward compatibility with existing
 * imports from './types'. All type definitions now live in './types/' (one per file).
 *
 * New code should import from './types/' or '@persistence/core'.
 *
 * @deprecated Import from './types/' directory instead.
 */
export type { PersonaConfig } from './types/index';
export type { MeterConfig } from './types/index';
