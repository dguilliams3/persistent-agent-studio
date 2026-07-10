/**
 * Shared type definitions for the persistence web frontend.
 *
 * These types represent API response shapes — the data the web frontend
 * receives from the backend. They are intentionally separate from the
 * @persistence/* package types, which represent database schema rows.
 *
 * API response types (e.g., HistoryEntry here) are typically subsets of
 * their package equivalents, with optional fields and different nullability.
 *
 * @module types
 *
 * @antipattern Do NOT duplicate types that already exist in @persistence/*
 *   packages IF the shapes are identical. If the API response shape differs
 *   from the DB schema shape, keep the API type here.
 *
 * Types that STAY here: API response shapes, web-only UI state types,
 *   Zustand utility types, navigation types.
 *
 * Types to import from packages when shapes align:
 *   - @persistence/db: HistoryEntry (when API response matches DB row)
 *   - @persistence/media: GalleryImage (when refactored)
 */

// =============================================================================
// API / DATA TYPES — Backend response shapes
// =============================================================================

/** History entry from /history endpoint */
export interface HistoryEntry {
  id: number;
  type: string;
  content: string;
  internal?: string | null;
  created_at: string;
  meter_snapshot?: string | null;
  excluded?: boolean;
  table?: string;
}

/** Cold storage entry from /cold-storage endpoint */
export interface ColdStorageEntry {
  id: number;
  type: string;
  content: string;
  internal?: string | null;
  created_at: string;
  table?: string;
}

/** Notebook entry from /notebook endpoint */
export interface NotebookEntry {
  id: number;
  content: string;
  created_at: string;
}

/** Summary entry from /summaries endpoint */
export interface SummaryEntry {
  id: number;
  summary: string;
  message_count: number;
  created_at: string;
  tier?: number;
  position?: number;
  archived?: boolean;
  pinned?: boolean;
}

/** Reminder entry from /reminders endpoint */
export interface ReminderEntry {
  id: number;
  content: string;
  created_at: string;
}

/** Observation entry from /observations endpoint */
export interface ObservationEntry {
  id: number;
  content: string;
  created_at: string;
}

/** Learned entry from /learned endpoint */
export interface LearnedEntry {
  id: number;
  content: string;
  created_at: string;
}

/** Question entry from /questions endpoint */
export interface QuestionEntry {
  id: number;
  content: string;
  created_at: string;
}

/** Gallery image object (mapped from API response) */
export interface GalleryImage {
  id: number;
  type: string;
  content: string;
  internal?: string | null;
  created_at: string;
  blurred?: boolean;
  vaulted?: boolean;
  _lastUpdated?: number;
}

/** Memory branch from /branches endpoint */
export interface Branch {
  name: string;
  description?: string;
  created_at?: string;
}

/** Synthetic memory from /memory/synthetic endpoint */
export interface SyntheticMemory {
  id: number;
  type?: string;
  memory_type?: string;
  content: string;
  internal?: string | null;
  branch?: string;
  created_at?: string;
}

/**
 * Persona from /personas endpoint.
 * Intentionally local — API response shape differs from @persistence/db PersonaRecord
 * (includes isActive from the API, omits DB-only fields like slug, system_prompt_template).
 */
export interface Persona {
  id: number;
  name: string;
  isActive?: boolean;
  created_at?: string;
}

/** Loop state from /state endpoint */
export interface LoopState {
  isRunning: boolean;
  loopCount: number;
  lastWakeTime?: string | null;
  lastMessageToUser?: string | null;
  cycleIntervalSeconds: number;
  currentStatus?: string | null;
  currentStatusEmoji?: string | null;
  currentStatusMood?: string | null;
  summarizeThreshold: number;
  autoSummarize: boolean;
  activeHistoryCount: number;
  selectedModel?: string;
}

/** History pagination state */
export interface HistoryPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Cycle stats from /cycles endpoint */
export interface CycleStats {
  cycles?: CycleEntry[];
  stats?: {
    cacheHitRate?: number;
    avgCostCents?: number;
  };
}

/** Individual cycle entry */
export interface CycleEntry {
  id?: number;
  model?: string;
  estimated_cost_cents?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
}

/** Context data from /context endpoint */
export interface ContextData {
  characterCount?: number;
  stats?: {
    estimatedInputTokens?: number;
    tokenBreakdown?: Record<string, number>;
  };
}

/** Meters state (being-states values + histories) */
export interface MetersState {
  values: Record<string, number>;
  histories: Record<string, number[]>;
}

/** User status from /user-status endpoint */
export interface UserStatus {
  status: string;
  updated?: string;
  setBy?: string;
}

/** Sleep status from /sleep-status endpoint */
export interface SleepStatus {
  sleeping: boolean;
  sleepUntil: string | null;
}

/** Profile picture from /profile-picture endpoint */
export interface ProfilePicture {
  hasProfilePicture: boolean;
  base64?: string;
  prompt?: string;
  updatedAt?: string;
}

/** Batch history entry */
export interface BatchHistoryEntry {
  batch_id?: string;
  status: string;
  duration_seconds?: number | null;
  created_at?: string;
}

/** TTS credits from /tts-credits endpoint */
export interface TTSCredits {
  used: number;
  limit: number;
  remaining: number;
  resetUnix: number;
  tier: string;
}

/** Voice history entry */
export interface VoiceHistoryEntry {
  id: number;
  text?: string;
  model?: string;
  created_at?: string;
  duration_seconds?: number;
}

/** Voice transcription entry */
export interface VoiceTranscription {
  id: number;
  original_text?: string;
  corrected_text?: string;
  emotion?: string;
  corrected_emotion?: string;
  created_at?: string;
}

/** Glossary entry for STT corrections */
export interface GlossaryEntry {
  id: number;
  wrong_form: string;
  correct_form: string;
  category: string;
}

/** Tool registry entry */
export interface ToolRegistryEntry {
  name: string;
  description?: string;
  category?: string;
  [key: string]: unknown;
}

/** SIM basin metrics from /sim/basin endpoint */
export interface SIMBasinMetrics {
  global?: Record<string, unknown>;
  [key: string]: unknown;
}

/** SIM trajectory point */
export interface SIMTrajectoryPoint {
  x?: number;
  y?: number;
  z?: number;
  type?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Pricing config from /pricing endpoint */
export interface PricingConfig {
  models?: Record<string, { input: number; output: number }>;
  cache?: Record<string, { read: number; write: number }>;
  batchDiscount?: number;
}

/** Prompt templates from /prompts endpoint */
export interface PromptTemplates {
  summarize_system?: string;
  summarize_instructions?: string;
  meta_system?: string;
  meta_instructions?: string;
  [key: string]: string | undefined;
}

/** RAG config from /rag-config endpoint */
export interface RAGConfig {
  enabled?: boolean;
  topK?: number;
  halflife?: number;
  minSimilarity?: number;
  mmrLambda?: number;
  weights?: {
    similarity: number;
    recency: number;
    importance: number;
  };
}

/** Export options for personality export */
export interface ExportOptions {
  includeHistory: boolean;
  historyLimit: number;
  includeAllHistory: boolean;
  includeSummaries: boolean;
  includeBranches: boolean;
  includeMedia: boolean;
  includeGallery: boolean;
}

/** Import preview data */
export interface ImportPreview {
  tables?: Record<string, number>;
  mode?: string;
  [key: string]: unknown;
}

/** Realtime voice session data */
export interface RealtimeSession {
  sessionId?: string;
  provider?: string;
  model?: string;
  [key: string]: unknown;
}

/** Generated image from /imagine endpoint */
export interface GeneratedImage {
  base64?: string;
  image?: string;
  prompt?: string;
  [key: string]: unknown;
}

/** Synthetic image for editor */
export interface SyntheticImage {
  base64: string;
  name: string;
}

// =============================================================================
// API CLIENT TYPES
// =============================================================================

/** API error with HTTP status */
export interface ApiErrorData {
  message: string;
  status: number;
  data: unknown;
}

// =============================================================================
// STORE SLICE TYPES
// =============================================================================

/** Zustand set function type */
export type ZustandSet = (
  partial: Record<string, unknown> | ((state: Record<string, unknown>) => Record<string, unknown>)
) => void;

/** Zustand get function type */
export type ZustandGet = () => Record<string, unknown>;

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/** View definition for navigation rail */
export interface ViewDefinition {
  id: string;
  label: string;
  icon: string;
}

/** Active view type union */
export type ActiveView =
  | 'chat'
  | 'memory'
  | 'media'
  | 'editor'
  | 'voice'
  | 'settings'
  | 'sim';

// =============================================================================
// WEB-ONLY UI STATE TYPES
// =============================================================================

/** Lightbox state */
export interface LightboxState {
  isOpen: boolean;
  images: LightboxImage[];
  currentIndex: number;
}

/** Image in lightbox */
export interface LightboxImage {
  src: string;
  prompt: string;
  time?: string;
  type?: string;
}

/** Log entry in system log */
export interface LogEntry {
  msg: string;
  time: number;
}

/** Model option for selector */
export interface ModelOption {
  id: string;
  label: string;
}

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================
// These aliases support existing code that uses the old names.
// New code should use ViewDefinition and ActiveView.

/** @deprecated Use ViewDefinition instead */
export type TabDefinition = ViewDefinition;

/** @deprecated Use ActiveView instead */
export type ActiveTab = ActiveView | 'voice' | 'monitor';
