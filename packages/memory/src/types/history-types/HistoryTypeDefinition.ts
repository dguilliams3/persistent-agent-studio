/**
 * Shared interface for history type definitions.
 *
 * Each history type is a self-contained file exporting a single
 * HistoryTypeDefinition. No central map — adding a type = adding a file.
 */

export type HistoryCategory = 'internal' | 'communication' | 'creative' | 'memory' | 'search' | 'system' | 'error' | 'knowledge';

export interface HistoryTypeDefinition {
  key: string;
  icon: string;
  label: string;
  category: HistoryCategory;
}
