/**
 * History Type Registry
 *
 * Auto-assembled from per-file HistoryTypeDefinition exports.
 * Adding a new history type = adding a new *HistoryType.ts file
 * and re-exporting it here.
 *
 * @antipattern Do NOT create a separate map — the registry IS the barrel.
 */

// Shared interface
export type { HistoryTypeDefinition, HistoryCategory } from './HistoryTypeDefinition';

// Internal states
export { ThoughtHistoryType } from './ThoughtHistoryType';
export { CuriosityHistoryType } from './CuriosityHistoryType';
export { ExistHistoryType } from './ExistHistoryType';
export { StateUpdateHistoryType } from './StateUpdateHistoryType';

// Communication
export { UserMessageHistoryType } from './UserMessageHistoryType';
export { MessageToUserHistoryType } from './MessageToUserHistoryType';

// Creative
export { ArtRequestHistoryType } from './ArtRequestHistoryType';
export { ArtResultHistoryType } from './ArtResultHistoryType';
export { UserArtHistoryType } from './UserArtHistoryType';
export { ArtSharedHistoryType } from './ArtSharedHistoryType';
export { UserVideoHistoryType } from './UserVideoHistoryType';
export { ImageHistoryType } from './ImageHistoryType';

// Search
export { SearchQueryHistoryType } from './SearchQueryHistoryType';
export { SearchResultHistoryType } from './SearchResultHistoryType';
export { WebDigestHistoryType } from './WebDigestHistoryType';

// Memory operations
export { ColdStorageHistoryType } from './ColdStorageHistoryType';
export { RememberHistoryType } from './RememberHistoryType';
export { NoteSavedHistoryType } from './NoteSavedHistoryType';
export { NoteRetrievedHistoryType } from './NoteRetrievedHistoryType';
export { ObservationSavedHistoryType } from './ObservationSavedHistoryType';
export { ObservationRetrievedHistoryType } from './ObservationRetrievedHistoryType';
export { ReminderSetHistoryType } from './ReminderSetHistoryType';
export { ReminderDismissHistoryType } from './ReminderDismissHistoryType';

// Knowledge system
export { LearnedAddHistoryType } from './LearnedAddHistoryType';
export { LearnedUpdateHistoryType } from './LearnedUpdateHistoryType';
export { LearnedCiteHistoryType } from './LearnedCiteHistoryType';
export { LearnedPromoteHistoryType } from './LearnedPromoteHistoryType';
export { LearnedDeleteHistoryType } from './LearnedDeleteHistoryType';
export { LearnedListHistoryType } from './LearnedListHistoryType';
export { QuestionAddHistoryType } from './QuestionAddHistoryType';
export { QuestionNoteHistoryType } from './QuestionNoteHistoryType';
export { QuestionResolveHistoryType } from './QuestionResolveHistoryType';
export { QuestionDissolveHistoryType } from './QuestionDissolveHistoryType';
export { QuestionListHistoryType } from './QuestionListHistoryType';

// System
export { MeterOverrideHistoryType } from './MeterOverrideHistoryType';
export { StatusUpdateHistoryType } from './StatusUpdateHistoryType';
export { SleepHistoryType } from './SleepHistoryType';
export { UserStatusUpdateHistoryType } from './UserStatusUpdateHistoryType';
export { SummarizeHistoryType } from './SummarizeHistoryType';
export { PinUpdateHistoryType } from './PinUpdateHistoryType';

// Error types
export { ParseErrorHistoryType } from './ParseErrorHistoryType';
export { ActionErrorHistoryType } from './ActionErrorHistoryType';

// Media
export { TextHistoryType } from './TextHistoryType';
export { EphemeralHistoryType } from './EphemeralHistoryType';

// ────────────────────────────────────────────────────────────────────
// Registry — auto-assembled from all exports above
// ────────────────────────────────────────────────────────────────────

import type { HistoryTypeDefinition } from './HistoryTypeDefinition';

import { ThoughtHistoryType } from './ThoughtHistoryType';
import { CuriosityHistoryType } from './CuriosityHistoryType';
import { ExistHistoryType } from './ExistHistoryType';
import { StateUpdateHistoryType } from './StateUpdateHistoryType';
import { UserMessageHistoryType } from './UserMessageHistoryType';
import { MessageToUserHistoryType } from './MessageToUserHistoryType';
import { ArtRequestHistoryType } from './ArtRequestHistoryType';
import { ArtResultHistoryType } from './ArtResultHistoryType';
import { UserArtHistoryType } from './UserArtHistoryType';
import { ArtSharedHistoryType } from './ArtSharedHistoryType';
import { UserVideoHistoryType } from './UserVideoHistoryType';
import { ImageHistoryType } from './ImageHistoryType';
import { SearchQueryHistoryType } from './SearchQueryHistoryType';
import { SearchResultHistoryType } from './SearchResultHistoryType';
import { WebDigestHistoryType } from './WebDigestHistoryType';
import { ColdStorageHistoryType } from './ColdStorageHistoryType';
import { RememberHistoryType } from './RememberHistoryType';
import { NoteSavedHistoryType } from './NoteSavedHistoryType';
import { NoteRetrievedHistoryType } from './NoteRetrievedHistoryType';
import { ObservationSavedHistoryType } from './ObservationSavedHistoryType';
import { ObservationRetrievedHistoryType } from './ObservationRetrievedHistoryType';
import { ReminderSetHistoryType } from './ReminderSetHistoryType';
import { ReminderDismissHistoryType } from './ReminderDismissHistoryType';
import { LearnedAddHistoryType } from './LearnedAddHistoryType';
import { LearnedUpdateHistoryType } from './LearnedUpdateHistoryType';
import { LearnedCiteHistoryType } from './LearnedCiteHistoryType';
import { LearnedPromoteHistoryType } from './LearnedPromoteHistoryType';
import { LearnedDeleteHistoryType } from './LearnedDeleteHistoryType';
import { LearnedListHistoryType } from './LearnedListHistoryType';
import { QuestionAddHistoryType } from './QuestionAddHistoryType';
import { QuestionNoteHistoryType } from './QuestionNoteHistoryType';
import { QuestionResolveHistoryType } from './QuestionResolveHistoryType';
import { QuestionDissolveHistoryType } from './QuestionDissolveHistoryType';
import { QuestionListHistoryType } from './QuestionListHistoryType';
import { MeterOverrideHistoryType } from './MeterOverrideHistoryType';
import { StatusUpdateHistoryType } from './StatusUpdateHistoryType';
import { SleepHistoryType } from './SleepHistoryType';
import { UserStatusUpdateHistoryType } from './UserStatusUpdateHistoryType';
import { SummarizeHistoryType } from './SummarizeHistoryType';
import { PinUpdateHistoryType } from './PinUpdateHistoryType';
import { ParseErrorHistoryType } from './ParseErrorHistoryType';
import { ActionErrorHistoryType } from './ActionErrorHistoryType';
import { TextHistoryType } from './TextHistoryType';
import { EphemeralHistoryType } from './EphemeralHistoryType';

/**
 * All registered history type definitions, keyed by their database key.
 *
 * Use this for runtime lookups (icon, label, category) by key.
 * The keys match the string values stored in the `type` column of the history table.
 */
const ALL_HISTORY_TYPES: HistoryTypeDefinition[] = [
  ThoughtHistoryType,
  CuriosityHistoryType,
  ExistHistoryType,
  StateUpdateHistoryType,
  UserMessageHistoryType,
  MessageToUserHistoryType,
  ArtRequestHistoryType,
  ArtResultHistoryType,
  UserArtHistoryType,
  ArtSharedHistoryType,
  UserVideoHistoryType,
  ImageHistoryType,
  SearchQueryHistoryType,
  SearchResultHistoryType,
  WebDigestHistoryType,
  ColdStorageHistoryType,
  RememberHistoryType,
  NoteSavedHistoryType,
  NoteRetrievedHistoryType,
  ObservationSavedHistoryType,
  ObservationRetrievedHistoryType,
  ReminderSetHistoryType,
  ReminderDismissHistoryType,
  LearnedAddHistoryType,
  LearnedUpdateHistoryType,
  LearnedCiteHistoryType,
  LearnedPromoteHistoryType,
  LearnedDeleteHistoryType,
  LearnedListHistoryType,
  QuestionAddHistoryType,
  QuestionNoteHistoryType,
  QuestionResolveHistoryType,
  QuestionDissolveHistoryType,
  QuestionListHistoryType,
  MeterOverrideHistoryType,
  StatusUpdateHistoryType,
  SleepHistoryType,
  UserStatusUpdateHistoryType,
  SummarizeHistoryType,
  PinUpdateHistoryType,
  ParseErrorHistoryType,
  ActionErrorHistoryType,
  TextHistoryType,
  EphemeralHistoryType,
];

/**
 * Registry map: history type key -> HistoryTypeDefinition.
 * Built automatically from all registered types.
 */
export const HISTORY_TYPE_REGISTRY: Record<string, HistoryTypeDefinition> = Object.fromEntries(
  ALL_HISTORY_TYPES.map(definition => [definition.key, definition])
);

/**
 * Icon map derived from the registry.
 * Drop-in replacement for the old HISTORY_TYPE_ICONS constant.
 */
export const HISTORY_TYPE_ICONS: Record<string, string> = Object.fromEntries(
  ALL_HISTORY_TYPES.map(definition => [definition.key, definition.icon])
);

/**
 * Type guard to check if a string is a registered history type key.
 */
export function isHistoryType(value: string): boolean {
  return value in HISTORY_TYPE_REGISTRY;
}
