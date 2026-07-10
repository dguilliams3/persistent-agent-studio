/**
 * @persistence/services - Capability-based external service integrations
 *
 * @module @persistence/services
 * @description External service providers organized by capability, not vendor.
 *
 * ## Capabilities
 *
 * - **TTS (Text-to-Speech)**: ElevenLabs provider
 * - **STT (Speech-to-Text)**: Cloudflare Whisper, Modal Prosody
 * - **Image Generation**: Replicate (FLUX, SDXL), Cloudflare AI, Pony Studio
 * - **Messaging**: extension-point interfaces only (bring your own channel adapter)
 * - **Search**: Claude web_search tool
 *
 * ## Design Principles
 *
 * 1. **Capability over Provider**: Code depends on interfaces (TTSService), not implementations
 * 2. **Thin HTTP Clients**: No business logic, just API wrappers
 * 3. **Credential Injection**: Take credentials in constructor, not from env
 * 4. **Structured Results**: Return ServiceResult<T> for consistent error handling
 * 5. **No Database Access**: Services are pure HTTP clients
 *
 * @example
 * // TTS
 * import { ElevenLabsProvider, type TTSService } from '@persistence/services';
 * const tts: TTSService = new ElevenLabsProvider(apiKey);
 * const result = await tts.synthesize('Hello!');
 *
 * // Image Generation
 * import { ReplicateProvider, type ImageService } from '@persistence/services';
 * const image: ImageService = new ReplicateProvider({ apiToken, model: 'flux-schnell' });
 * const result = await image.generate('a sunset');
 *
 * // Messaging extension point
 * import { type MessagingService } from '@persistence/services';
 * const messaging: MessagingService = myAdapter;
 * await messaging.sendText(chatId, 'Hello!');
 */

// =============================================================================
// CORE UTILITIES
// =============================================================================

export {
  // Result types
  type ServiceResult,
  type ServiceError,
  type ServiceErrorCode,
  type JobStatus,
  type AsyncJob,
  type HttpOptions,
  success,
  failure,
  httpStatusToErrorCode,

  // Error classes
  ServiceException,
  NetworkException,
  AuthException,
  RateLimitException,
  InsufficientCreditException,
  ContentFilteredException,
  TimeoutException,

  // HTTP utilities
  type HttpRequest,
  httpRequest,
  httpGet,
  httpPost,
  httpPostRaw,
  parseApiError,
} from "./core/index.js";

// =============================================================================
// TTS (TEXT-TO-SPEECH)
// =============================================================================

export {
  type TTSService,
  type TTSOptions,
  type TTSResult,
  type Voice,
  type TTSModel,
  type ElevenLabsConfig,
  type ElevenLabsModelKey,
  ELEVENLABS_MODELS,
  ElevenLabsProvider,
} from "./tts/index.js";

// =============================================================================
// STT (SPEECH-TO-TEXT)
// =============================================================================

export {
  type STTService,
  type ProsodyService,
  type STTOptions,
  type STTResult,
  type ProsodyOptions,
  type ProsodyResult,
  type CloudflareAIBinding,
  type ModalProsodyConfig,
  MODAL_PROSODY_URL,
  MODAL_HEALTH_URL,
  CloudflareWhisperProvider,
  ModalProsodyProvider,
} from "./stt/index.js";

// =============================================================================
// IMAGE GENERATION
// =============================================================================

export {
  type ImageService,
  type AsyncImageService,
  type ImageOptions,
  type ImageResult,
  type ReplicateConfig,
  type ReplicateModelConfig,
  type CloudflareImageConfig,
  // Note: CloudflareAIBinding already exported from STT
  type PonyStudioConfig,
  type PonyPresets,
  REPLICATE_MODELS,
  ReplicateProvider,
  createFluxSchnellProvider,
  createFluxDevProvider,
  createSDXLProvider,
  CloudflareAIProvider,
  PonyStudioProvider,
  getPonyPresets,
} from "./image_generation/index.js";

// =============================================================================
// MESSAGING
// =============================================================================

export {
  type MessagingService,
  type VoiceMessagingService,
  type BaseMessageOptions,
  type TextMessageOptions,
  type PhotoMessageOptions,
  type DocumentMessageOptions,
  type VoiceMessageOptions,
  type MessageResult,
} from "./messaging/index.js";

// =============================================================================
// SEARCH
// =============================================================================

export {
  type SearchService,
  type SearchOptions,
  type SearchResult,
  type SearchResultItem,
  type ClaudeSearchConfig,
  type BraveSearchConfig,
  type SearchMetadata,
  type GatewaySearchResult,
  type SimpleSearchResult,
  SearchGateway, // PRIMARY ENTRY POINT
  ClaudeSearchProvider,
  BraveSearchProvider,
} from "./search/index.js";

// =============================================================================
// WEB AGENT (SCHEDULED DIGESTS)
// =============================================================================

export {
  // Legacy types (for preset-based consumers)
  type WebAgentConfig,
  type PartialWebAgentConfig,
  type TopicDigestResult,
  type WebAgentRunResult,
  type WebAgentDeps,
  type WebAgentStateKeys,
  type WebAgentPresetName,

  // Pure service types (new architecture)
  type DigestRequest,
  type DigestResult,
  type DigestDeps,
  type TopicSearchResult,

  // Constants
  MAX_TOPICS,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_BACKOFF_MS,
  WEB_AGENT_PRESETS,

  // Functions
  getWebAgentStateKeys,
  runDigest, // Pure service - no side effects
  isWebAgentDue, // Cron helper
  loadWebAgentConfig, // State helper
  loadTopicsFromState, // State helper
} from "./web-agent/index.js";

// =============================================================================
// EMBEDDING — canonical code moved to @persistence/embedding
// CloudflareEmbeddingProvider, EMBEDDING_MODEL, EMBEDDING_DIMENSION, and all
// embedding types now live in @persistence/embedding. Import from there directly.
// No re-exports here — consumers must update their import paths.
// =============================================================================

// =============================================================================
// FEEDBACK (ACTION NORMALIZATION + CYCLE FEEDBACK)
// =============================================================================

export {
  transformLegacyAction,
  normalizeAction,
  FEEDBACK_TYPES,
  addFeedback,
  getFeedbackAndClear,
  formatFeedbackForContext,
} from "./feedback/index.js";
