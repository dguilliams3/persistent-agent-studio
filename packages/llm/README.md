# @persistence/llm

Multi-provider LLM abstraction supporting Anthropic, OpenAI, and local models with unified response handling.

## Overview

The `@persistence/llm` package provides a strongly-typed request engine for executing LLM queries across multiple providers. Instead of using string-based lookups at runtime, all provider and model resolution happens at the configuration boundary, making the engine itself statically type-safe.

**Key Principle:** The engine receives fully-resolved typed objects, not strings. This eliminates runtime lookup overhead and makes provider/model configuration explicit and auditable.

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Providers | ✅ Complete | Anthropic, OpenAI, local models via `@persistence/core/providers` |
| Token Counting | ✅ Complete | Delegated to provider methods |
| Sync Requests | ✅ Complete | Full implementation with timeout handling |
| Batch Mode | ✅ Complete | `submitBatch()`, `checkBatchStatus()`, `fetchBatchResults()` |
| Response Cleanup | ✅ Complete | Auto-applied via `cleanResponseContent()` from `@persistence/core` |
| Config Management | ✅ Complete | `getModelConfig()`, `setModelConfig()`, summarization model config |
| Local Models | ✅ Complete | `callLocalModel()`, `getLocalModelConfig()` |
| Streaming | 🔄 TODO | Pending implementation |

**Platform Integration:** `platforms/cloudflare/src/services/batch-processor.js` uses `RequestEngine` methods for batch processing.

## Key Exports

### Types

```typescript
// Request/response types
export type {
  LLMRequest,        // Strongly-typed request with provider/model objects
  LLMResponse,       // Response with metadata and cost
  EngineEnvironment, // API key container interface
  // Batch types
  BatchJob,          // Submitted batch with batchId, status, expiresAt
  BatchStatus,       // Status check result with resultsUrl, requestCounts
  BatchResult,       // Individual result with response or error
};

// Re-exported from @persistence/core/providers
export type {
  Message,
  SystemBlock,
  ProviderDefinition,
  ModelDefinition,
  ModelCapabilities,
  ModelPricing,
  ParsedResponse,
  TokenCount,
  ReasoningEffort,
};
```

### Classes

```typescript
export class RequestEngine {
  constructor(env: EngineEnvironment, batchConfig?: BatchPollingConfig);

  // Sync execution
  async execute(request: LLMRequest): Promise<LLMResponse>;

  // Batch API (async - results come later)
  async submitBatch(request: LLMRequest, customId: string): Promise<BatchJob>;
  async checkBatchStatus(batchId: string, provider: ProviderDefinition): Promise<BatchStatus>;
  async fetchBatchResults(resultsUrl: string, provider: ProviderDefinition, model: ModelDefinition): Promise<BatchResult[]>;
}

export type BatchPollingConfig = {
  maxWaitMs?: number;      // Default: 300000 (5 min)
  pollIntervalMs?: number; // Default: 5000 (5 sec)
};
```

### Provider Registry

```typescript
export {
  PROVIDERS,              // Provider definitions map
  anthropic,              // Anthropic provider
  openai,                 // OpenAI provider
  resolveProvider,        // String → ProviderDefinition
  resolveModel,           // String → ModelDefinition
  resolveModelById,       // API ID → ModelDefinition
  resolveProviderModel,   // Resolve both at once
};
```

### Configuration Management

```typescript
export {
  // Model configuration (stored in D1 state table)
  getModelConfig,         // Get provider/model from DB
  setModelConfig,         // Set provider/model in DB
  clearModelConfig,       // Clear to use defaults
  getDefaultProvider,     // Get default provider definition

  // Summarization-specific config
  getSummarizationModel,  // Get summarization provider/model
  setSummarizationModel,  // Set summarization provider/model
};
```

### Local Model Support

```typescript
export {
  callLocalModel,         // Call local model (Ollama/LM Studio)
  getLocalModelConfig,    // Get local model endpoint/model
  setLocalModelConfig,    // Set local model config
  callWithLocalFallback,  // Call with automatic local model fallback
};
```

### Unified LLM Interface (Callable Pattern)

The newer `createLLM()` factory provides a fully-typed interface with compile-time safety for provider-specific parameters.

```typescript
export { createLLM, createCallableModel, createCallableProvider } from './callable';
export type { LLM, CallableModel, CallableProvider, AnthropicProvider, OpenAIProvider } from './types';
export type { AnthropicCallParams, OpenAICallParams, CallResult, BatchHandle } from './types';
```

**Usage:**

```typescript
import { createLLM } from '@persistence/llm';

const llm = await createLLM(secrets);

// Provider-specific params enforced at compile time
const result = await llm.anthropic.opus.sync({
  system: 'You are Clio',
  messages: [{ role: 'user', content: 'Think deeply' }],
  maxTokens: 8192,
  thinking: { budgetTokens: 4096 }  // Only valid for Anthropic
});

// Batch submission and checking
const handle = await llm.anthropic.sonnet.batch({ customId: 'cycle-42', ... });
const status = await llm.anthropic.checkBatch(handle.batchId);
```

### Batch State Management (D1 Database)

Functions for tracking batch submissions in D1 database. Distinct from `engine/` which handles Anthropic API interaction.

```typescript
export {
  BATCH_WINDOW, BATCH_HARD_TIMEOUT_SECONDS,
  getBatchTimeout, setBatchTimeout, getBatchHardTimeout, setBatchHardTimeout,
  storePendingBatch, getPendingBatches, listPendingBatches, updatePendingBatch,
  isInBatchWindow, isUserRecentlyActive, cancelBatch,
} from './batches';
```

## Usage Examples

### Basic Request

```typescript
import { RequestEngine, anthropic } from '@persistence/llm';
import type { LLMRequest } from '@persistence/llm';

const engine = new RequestEngine({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

const request: LLMRequest = {
  provider: anthropic,
  model: anthropic.models['sonnet'],
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  maxTokens: 1024,
  mode: 'sync',
};

const response = await engine.execute(request);
console.log(response.content);           // Generated text
console.log(response.usage.input);       // Input tokens
console.log(response.cost);              // Cost in USD
console.log(response.metadata.latencyMs); // Latency
```

### With Reasoning (Claude)

```typescript
const request: LLMRequest = {
  provider: anthropic,
  model: anthropic.models['opus'],
  system: 'Think step-by-step about the problem.',
  messages: [
    { role: 'user', content: 'Solve this puzzle...' }
  ],
  maxTokens: 16000,
  mode: 'sync',
  reasoning: 'enabled', // or 'full' for maximum reasoning
};

const response = await engine.execute(request);
```

### Switching Providers

```typescript
import { openai } from '@persistence/llm';

const engineOpenAI = new RequestEngine({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
});

const request: LLMRequest = {
  provider: openai,
  model: openai.models['gpt-4o'],
  // ... rest of config
};

const response = await engineOpenAI.execute(request);
```

### Resolution at Boundary (Config Loading)

```typescript
import { resolveProviderModel } from '@persistence/llm';

// At application boundary (config file loading):
const providerName = config.llm.provider;    // String from config
const modelName = config.llm.model;          // String from config

// Resolve once and pass typed objects to engine
const { provider, model } = resolveProviderModel(providerName, modelName);

// Now engine works with typed objects, no lookups
const request: LLMRequest = {
  provider,
  model,
  system: 'You are an assistant.',
  messages: [],
  maxTokens: 1024,
  mode: 'sync',
};

const response = await engine.execute(request);
```

## Module Structure

```
packages/llm/
├── src/
│   ├── index.ts                 # Main entry point, re-exports
│   ├── config.ts                # Model configuration management (150 lines)
│   ├── local.ts                 # Local model support (120 lines)
│   └── engine/
│       ├── index.ts             # Engine exports
│       ├── types.ts             # LLMRequest, LLMResponse, EngineEnvironment
│       └── engine.ts            # RequestEngine class (430 lines)
│           ├── execute()        # Route to sync or batch
│           ├── executeSync()    # HTTP request + cleanResponseContent()
│           ├── submitBatch()    # Submit batch request
│           ├── checkBatchStatus()  # Poll batch status
│           ├── fetchBatchResults() # Fetch with retry + cleanResponseContent()
│           └── calculateCost()  # Cost from pricing + usage
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

### Key Files

| File | Purpose |
|------|---------|
| `engine.ts` | Core request execution engine |
| `types.ts` | Type definitions for requests and responses |
| `index.ts` | Public API and migration status tracker |

## Type Safety Flow

```
String Configuration
    ↓ (at boundary)
resolveProviderModel()
    ↓
{ provider: ProviderDefinition, model: ModelDefinition }
    ↓ (typed objects)
RequestEngine.execute(LLMRequest)
    ↓
LLMResponse (with metadata and cost)
```

## Dependencies

- **@persistence/core** (workspace dependency)
  - Provides `ProviderDefinition`, `ModelDefinition`, provider implementations
  - Source of truth for all provider/model configurations
  - Re-exported here for convenience

## Design Principles

1. **Type Safety First:** Provider and model resolution happens at config boundaries, not at execution time
2. **Provider Abstraction:** Provider definitions handle their own API formatting and parsing
3. **Cost Tracking:** All responses include actual cost based on token usage and model pricing
4. **Timeout Handling:** All requests have configurable timeouts to prevent hangs
5. **Error Boundaries:** API errors are caught and normalized before returning

## Completed Work

### Batch Mode ✅
Implemented 2026-01-27. Full batch API support:
- `submitBatch()` - Submit async batch to Anthropic `/v1/messages/batches`
- `checkBatchStatus()` - Poll batch status
- `fetchBatchResults()` - Fetch JSONL results with exponential backoff retry
- 50% cost discount auto-applied via `CACHE_PRICING.batchDiscount`
- Configurable polling via `BatchPollingConfig`
- Configurable retry with callbacks via `BatchRetryConfig`

### Retry Configuration

```typescript
import { RequestEngine, anthropic } from '@persistence/llm';

const engine = new RequestEngine(env, {
  polling: {
    maxWaitMs: 300000,      // 5 min default
    pollIntervalMs: 5000,   // 5 sec default
  },
  retry: {
    maxRetries: 3,          // default
    baseDelayMs: 1000,      // 1 sec default
    maxDelayMs: 8000,       // 8 sec cap
    // Platform can wire notifications
    onRetry: async (attempt, max, error, delayMs) => {
      console.log(`Retry ${attempt}/${max}: ${error}, waiting ${delayMs}ms`);
    },
    onAllFailed: async (max, error) => {
      console.error(`All ${max} retries failed: ${error}`);
    },
  },
});
```

## Completed Work

### Response Cleanup ✅
Implemented 2026-01-30. Provider-agnostic response cleaning:
- `cleanResponseContent()` from `@persistence/core` applied automatically
- Unwraps markdown code blocks (```json ... ```)
- Normalizes excessive whitespace (3+ newlines → 2)
- Applied in both `executeSync()` and `fetchBatchResults()`

### Config Migration ✅
Implemented 2026-01-30. Model configuration functions migrated from platform:
- `getModelConfig()`, `setModelConfig()`, `clearModelConfig()`
- `getSummarizationModel()`, `setSummarizationModel()`
- `getDefaultProvider()` for provider resolution

### Local Model Support ✅
Implemented 2026-01-30. Local model functions migrated from platform:
- `callLocalModel()` - Execute requests against Ollama/LM Studio
- `getLocalModelConfig()`, `setLocalModelConfig()`, `clearLocalModelConfig()`
- `isLocalModelConfigured()` - Check availability

## Pending Work

### Streaming (TODO)
- Implement streaming response support
- Server-sent events (SSE) handling
- Partial content assembly

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│   Application Code                      │
│   (with string config)                  │
└────────────┬────────────────────────────┘
             │
             ├─ resolveProviderModel(name, name)
             │                       ↓
┌────────────▼────────────────────────────┐
│   Configuration Boundary                │
│   (string → typed resolution)           │
└────────────┬────────────────────────────┘
             │
             ├─ LLMRequest (typed objects)
             │                       ↓
┌────────────▼────────────────────────────┐
│   RequestEngine                         │
│   ├─ execute(LLMRequest) ✅             │
│   │   └─ provider.parseResponse()       │
│   │   └─ cleanResponseContent() ✅      │
│   ├─ submitBatch() ✅                   │
│   ├─ checkBatchStatus() ✅              │
│   └─ fetchBatchResults() ✅             │
│       └─ cleanResponseContent() ✅      │
└────────────┬────────────────────────────┘
             │
             ├─ HTTP/API calls
             │                       ↓
┌────────────▼────────────────────────────┐
│   External LLM APIs                     │
│   ├─ api.anthropic.com                  │
│   ├─ api.openai.com                     │
│   └─ Local Models (Ollama/LM Studio)    │
└─────────────────────────────────────────┘
```

## Integration with Other Packages

- **@persistence/core:** Type and provider definitions
- **@persistence/runtime:** Uses RequestEngine for agent loop execution
- **@persistence/memory:** May use engine for summarization requests

## Building

```bash
# Type check
pnpm typecheck

# Build TypeScript
pnpm build

# Clean build artifacts
pnpm clean
```
