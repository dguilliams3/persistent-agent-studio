# @persistence/core

Shared constants, types, and provider definitions for the Persistent Claude monorepo. This is the platform-agnostic foundation that all other packages depend on.

## What This Package Does

`@persistence/core` is the single source of truth for:
- **Constants** - Magic strings, API limits, cache settings, model pricing
- **Types** - Persona, Tool, Action interfaces used across the system
- **Configuration** - Token, size, and threshold configs for summarization, RAG, and buffer management
- **LLM Providers** - Strongly-typed definitions for Anthropic, OpenAI with pricing, capabilities, model quirks

Every decision to use constants or types should resolve back to this package. No hardcoding "stringly-typed" values at call sites.

## Status

**Complete:**
- Core constants (pricing, cache TTLs, API limits)
- Type system (Persona, Tool, Action, History types)
- Configuration builders with validation
- Anthropic provider (3 models: Haiku, Sonnet, Opus)
- OpenAI provider (3 models: GPT-4o, GPT-4o-mini, GPT-5.2)
- Provider resolution utilities (including `resolveModelById()`)
- Response cleanup utilities (`cleanResponseContent()`)
- Secrets provider abstraction

**Pending:**
- None - this is a stable foundation package

## Key Exports

### Constants

```typescript
import { ACTION_TYPES, HISTORY_TYPES, CACHE_TTL, MODEL_PRICING } from '@persistence/core';

// Action identifiers (18 consolidated actions)
ACTION_TYPES.MESSAGE_USER       // Send message to user
ACTION_TYPES.THINK             // Private thought
ACTION_TYPES.COLD_STORAGE      // Permanent memory
ACTION_TYPES.LEARNED           // Self-knowledge tracking
ACTION_TYPES.QUESTION          // Hold open questions
// ... see ACTION_TYPES object for all 18

// History entry types (11 types)
HISTORY_TYPES.thought          // Private thought
HISTORY_TYPES.message_to_user   // Outgoing message
HISTORY_TYPES.user_message      // Incoming message
// ... see HISTORY_TYPES object for all

// Cache configuration
CACHE_TTL.SHORT                // 300s (5 min)
CACHE_TTL.LONG                 // 3600s (1 hour)
CACHE_SAFETY_MARGIN            // 0.9 (90% of TTL)
CACHE_THRESHOLD_SECONDS        // 3240s (54 min)

// Model pricing ($/MTok)
MODEL_PRICING.opus             // { inputPerMillion: 5.0, outputPerMillion: 25.0 }
MODEL_PRICING['gpt-5.1']       // { inputPerMillion: 2.0, outputPerMillion: 8.0 }

// Additional constants (often needed)
HISTORY_ICONS                  // { thought: '💭', message_to_user: '📤', ... }
ACTION_CATEGORIES              // { communication: [...], memory: [...], ... }
SHORT_TTL_THRESHOLD            // 270s (4.5 min)
DEFAULT_MAX_OUTPUT_TOKENS      // 4000 tokens
MAX_REMINDERS                  // 5 max active reminders
MIN_SUMMARY_LENGTH             // 50 chars minimum

// API limits
CLAUDE_IMAGE_LIMITS.maxImageBytes      // 5MB
IMAGE_COMPRESSION.jpegQuality          // 80
TELEGRAM_MAX_LENGTH                    // 4000 chars
DEFAULT_CYCLE_INTERVAL                 // 600s (10 min)
```

### Types

```typescript
import {
  Persona,
  ToolDefinition,
  ActionContext,
  ActionResult,
  HistoryType
} from '@persistence/core';

interface Persona {
  id: string;
  name: string;
  slug: string;
  systemPrompt?: string;
  provider?: 'anthropic' | 'openai' | 'local';
  model?: string;
  voice?: { model?: string; stability?: number };
}

interface ToolDefinition {
  type: string;
  description: string;
  category: 'communication' | 'internal' | 'memory' | 'external' | 'creative' | 'control' | 'self';
  schema: Record<string, unknown>;
  examples?: string[];
}

interface ActionContext {
  db: unknown;
  env: Record<string, unknown>;
  persona: Persona;
  cycleId?: number;
}

interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

type HistoryType = 'thought' | 'message_to_user' | 'user_message' | /* ... 8 more */;
```

### Configuration

```typescript
import {
  createTokenConfig,
  createSizeConfig,
  SUMMARIZE_CONFIG,
  RAG_CONFIG,
  SUMMARY_BUFFER_CONFIG
} from '@persistence/core';

// Create configurations with validation
const config = createTokenConfig({ maxTokens: 4000, minTokens: 100 });

// Pre-built configurations
SUMMARIZE_CONFIG.entries.maxSize           // 100 entries max
SUMMARIZE_CONFIG.tokens.maxTokens          // 4000 tokens max

RAG_CONFIG.retrieval.defaultSize           // 10 results
RAG_CONFIG.scoring.minScore                // 0.7 relevance

SUMMARY_BUFFER_CONFIG.contextSize          // 10 summaries in direct prompt
SUMMARY_BUFFER_CONFIG.tailTokenThreshold   // 8000 tokens
```

### Providers

```typescript
import {
  PROVIDERS,
  anthropic,
  openai,
  resolveProviderModel,
  resolveModelById
} from '@persistence/core/providers';

// Type-safe access to provider definitions
const opus = PROVIDERS.anthropic.models.opus;
console.log(opus.pricing.input);           // 5.0 ($/MTok)
console.log(opus.capabilities.vision);     // true

const gpt = PROVIDERS.openai.models['gpt-4o'];
console.log(gpt.contextWindow);            // 128000 tokens

// Runtime resolution from strings (from database)
const { provider, model } = resolveProviderModel('anthropic/opus');
const cost = model.pricing.input;

// Resolve model by API ID (e.g., from stored config)
const model = resolveModelById(anthropic, 'claude-sonnet-4-5-20250514');
// Returns ModelDefinition or undefined

// Available models:
// Anthropic: haiku, sonnet, opus
// OpenAI: gpt-4o, gpt-4o-mini, gpt-5.2
```

### Model Registry Functions

```typescript
import {
  getAvailableModels,
  getModelByAlias,
  validateModelAlias,
  getProviderModels,
  getModelDefinition
} from '@persistence/core';

// List all available models for UI/selection
const all = getAvailableModels();  // ModelInfo[] with displayName, alias, provider

// Lookup by alias (haiku, sonnet, opus, gpt-4o, etc.)
const opus = getModelByAlias('opus');  // ModelInfo or undefined

// Validate alias before using
if (validateModelAlias('haiku')) {
  // Alias is valid
}

// Get models for specific provider
const anthropicModels = getProviderModels('anthropic');  // ModelInfo[]

// Get full ModelDefinition by alias
const definition = getModelDefinition('sonnet');  // ModelDefinition with pricing, capabilities
```

### Secrets Provider

```typescript
import {
  SecretsProvider,
  CloudflareSecretsProvider,
  NodeEnvSecretsProvider,
  SecretNotFoundError
} from '@persistence/core';

// Cloudflare Workers - reads from env bindings
const cfSecrets = new CloudflareSecretsProvider(env);
const apiKey = await cfSecrets.get('ANTHROPIC_API_KEY');

// Node.js / Testing - reads from process.env
const nodeSecrets = new NodeEnvSecretsProvider();
const testKey = await nodeSecrets.get('TEST_API_KEY');

// Handle missing secrets
try {
  const key = await secrets.get('MISSING_KEY');
} catch (e) {
  if (e instanceof SecretNotFoundError) {
    console.log(`Secret ${e.secretName} not found`);
  }
}
```

### Utilities

```typescript
import { cleanResponseContent } from '@persistence/core';

// Provider-agnostic response cleanup
// Automatically applied by @persistence/llm RequestEngine

// Unwraps markdown code blocks
cleanResponseContent('```json\n{"action":"THINK"}\n```');
// Returns: '{"action":"THINK"}'

// Normalizes excessive whitespace (3+ newlines → 2)
cleanResponseContent('Line 1\n\n\n\nLine 2');
// Returns: 'Line 1\n\nLine 2'

// Trims leading/trailing whitespace
cleanResponseContent('  content  ');
// Returns: 'content'
```

## Usage Examples

### Resolving Provider/Model at System Boundaries

```typescript
// In worker entry point or config loader
import { resolveProviderModel } from '@persistence/core/providers';

const providerRef = state.summarize_provider;  // e.g., 'anthropic/sonnet'
const { provider, model } = resolveProviderModel(providerRef);

// Now pass typed objects, not strings
const headers = provider.getHeaders(apiKey);
const body = provider.formatRequest({
  model,
  system: systemPrompt,
  messages: conversation,
  maxTokens: 4000,
});
```

### Using Constants in Decision Logic

```typescript
import { CACHE_TTL, CACHE_SAFETY_MARGIN, ACTION_TYPES } from '@persistence/core';

// Cache expiry calculation
const expiresAt = Date.now() + (CACHE_TTL.LONG * CACHE_SAFETY_MARGIN * 1000);

// Action categorization
if (ACTION_TYPES.THINK === actionType) {
  // Handle internal action
}
```

### Accessing Model Metadata

```typescript
import { PROVIDERS } from '@persistence/core/providers';

// Get all available models
const models = PROVIDERS.anthropic.models;

// Check capabilities
if (models.opus.capabilities.vision) {
  // Can process images
}

// Pricing-based routing
if (models['gpt-4o-mini'].pricing.input < models.opus.pricing.input) {
  // Use cheaper model
}
```

### Building Configurations

```typescript
import { createTokenConfig, createSizeConfig, createThresholdConfig } from '@persistence/core';

// Application-specific config
const responseConfig = createTokenConfig({
  maxTokens: 8000,
  defaultTokens: 4000,
  minTokens: 100,
});

const bufferConfig = createSizeConfig({
  maxSize: 100,
  defaultSize: 50,
});

const rollThreshold = createThresholdConfig({
  threshold: 12000,   // Roll when exceeded
  target: 6000,       // Target after roll
  minValue: 3,        // Minimum entries
});
```

## Module Structure

```
packages/core/src/
├── index.ts              # Main entry point, re-exports all
├── constants.ts          # All magic strings, limits, pricing (253 lines)
├── types.ts              # Core TypeScript interfaces (106 lines)
├── config.ts             # Configuration builders + pre-built configs (287 lines)
├── providers/
│   ├── index.ts          # Provider registry and re-exports
│   ├── types.ts          # Provider/Model/Message type definitions (250 lines)
│   ├── anthropic.ts      # Anthropic provider definition (173 lines)
│   ├── openai.ts         # OpenAI provider definition (189 lines)
│   ├── resolve.ts        # String-to-typed resolution functions (150 lines)
│   └── registry.ts       # Model listing/query functions (getAvailableModels, etc.)
├── secrets/
│   ├── index.ts          # Secrets provider abstraction
│   ├── types.ts          # SecretsProvider interface
│   ├── cloudflare.ts     # Cloudflare env binding implementation
│   └── node-env.ts       # Node.js process.env implementation
└── utils/
    ├── index.ts          # Utils barrel export
    └── response-cleanup.ts  # cleanResponseContent() (50 lines)
```

### constants.ts

Shared across the monorepo. Contains:
- **MODEL_PRICING** - Rates per model (Anthropic, OpenAI, local)
- **CACHE_PRICING** - Cache hit/write modifiers
- **CACHE_TTL** - 5-min and 1-hour options
- **API_LIMITS** - Image sizes, message lengths, token counts
- **HISTORY_TYPES** - History entry enums + icons
- **ACTION_TYPES** - Action identifier enums + categories

### types.ts

Core interfaces for the system:
- **Persona** - AI entity config (model, voice, tools, meters)
- **ToolDefinition** - Action definition with schema
- **ActionContext** - DB, env, persona at execution time
- **ActionResult** - Success/error result wrapper
- **HistoryType** - Tagged union of history entry types

### config.ts

Configuration management:
- **createTokenConfig/createSizeConfig/createThresholdConfig** - Builders with validation
- **SUMMARIZE_CONFIG** - History compression settings
- **RAG_CONFIG** - Semantic search tuning
- **SUMMARY_BUFFER_CONFIG** - Tier system thresholds
- **HISTORY_TOKEN_CONFIG** - Context window management
- Other specialized configs (batch, quick follow-up, retry)

### providers/types.ts

Type system for provider abstraction:
- **ModelDefinition** - API ID, pricing, context window, capabilities, quirks
- **ProviderDefinition** - API endpoint, models, formatRequest, parseResponse
- **FormatRequestOptions/ParsedResponse** - Normalized request/response format
- **Message/ContentBlock** - Multimodal message structure

### providers/anthropic.ts

Anthropic implementation:
- **Models**: Haiku (4.5), Sonnet (4.5), Opus (4.5)
- **Features**: Prompt caching, vision, streaming
- **Pricing**: Includes cache read/write costs ($/MTok)
- **Token counting**: Uses free Anthropic API (precise)

### providers/openai.ts

OpenAI implementation:
- **Models**: GPT-4o, GPT-4o-mini, GPT-5.2
- **Features**: Vision, extended reasoning (GPT-5.2), streaming
- **Quirks**: GPT-5.2 reasoning overhead workaround (2000 token overhead)
- **Token counting**: Character-based estimation (~4 chars/token)

### providers/resolve.ts

Runtime resolution from strings:
- **resolveProvider(name)** - Get ProviderDefinition by name
- **resolveModel(provider, name)** - Get ModelDefinition by short key
- **resolveModelById(provider, id)** - Get ModelDefinition by API ID (e.g., 'claude-sonnet-4-5-20250514')
- **resolveProviderModel(ref)** - Parse "provider/model" string
- **isValidProviderModel(ref)** - Validate without throwing
- **getAllProviderModels()** - List all combinations

### utils/response-cleanup.ts

Provider-agnostic response content cleanup:
- **cleanResponseContent(content)** - Unwrap code blocks, normalize whitespace, trim

Used automatically by `@persistence/llm` RequestEngine for all LLM responses.

## Consumers

This package is a direct dependency of:
- **@persistence/memory** - Uses configs, types
- **@persistence/llm** - Uses providers, cleanResponseContent
- **@persistence/services** - Uses SecretsProvider, types
- **@persistence/tools** - Uses types for action definitions
- **@persistence/db** - Uses core types
- **platforms/cloudflare** - Uses providers, constants, types

## Related Documentation

- **Provider Models**: See `PROVIDERS.{anthropic|openai}.models` for complete list
- **Cache System**: See `docs/ai_native/CONTEXT_ASSEMBLY.md` for how cache constants are used
- **Actions Reference**: See `docs/ai_native/ACTIONS_REFERENCE.md` for ACTION_TYPES details
- **Configuration**: See individual package READMEs for how configs are applied

## Building & Types

```bash
# Build TypeScript
npm run build        # Outputs to dist/

# Type checking
npm run typecheck   # No emit, just verify

# Clean
npm run clean       # Remove dist/

# Install (dependency of this)
npm install typescript@^5.7.0
```

## Export Paths

```typescript
// Main entry point
import { ACTION_TYPES, Persona, createTokenConfig } from '@persistence/core';

// Provider subexport
import { PROVIDERS, resolveProviderModel } from '@persistence/core/providers';
```

## Design Notes

1. **Single Source of Truth** - All constants live here, not scattered across platforms
2. **Strong Typing** - Provider resolution converts "stringly-typed" DB values to typed objects once
3. **No Circular Dependencies** - This package has no internal dependencies, only TypeScript
4. **Extensible** - New providers can be added to the registry without breaking existing code
5. **Validated Configs** - Configuration builders enforce constraints at creation time

## Anti-Patterns to Avoid

- Importing constants from `platforms/cloudflare/src/constants.js` - use this package instead
- Hardcoding model IDs like `'claude-opus-4-5-20250514'` - use `PROVIDERS.anthropic.models.opus.id`
- Storing "provider/model" strings everywhere - resolve once at boundaries, pass typed objects
- Duplicating cache TTL calculations - use exported `CACHE_THRESHOLD_SECONDS` constant
