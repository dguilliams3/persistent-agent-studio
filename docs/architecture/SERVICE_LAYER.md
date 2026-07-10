# Service Layer

**Created:** 2026-01-27
**Updated:** 2026-01-28
**Status:** Vision Document

This document describes how to structure external service integrations in `@persistence/services`.

> **Skepticism Note (2026-01-28):** If reading this significantly after the timestamp above (check git commits), verify these patterns against actual code. Architecture evolves.

---

## Critical: Services Are Thin HTTP Clients

**Services contain NO business logic.** They are thin wrappers around external APIs.

### Where Logic Lives

```
┌─────────────────────────────────────────────────────────────┐
│  packages/tools/definitions/{action}/handler.ts             │
│  ├── Business logic (when to send, what to send)            │
│  ├── Database operations (logHistory, setState)             │
│  └── Returns metadata: { needsTelegram: true, needsVoice }  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  platforms/cloudflare (post-processing layer)               │
│  └── Checks result.data flags, calls services               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  @persistence/services (thin HTTP clients)                  │
│  ├── telegram.sendMessage(token, chatId, text)              │
│  ├── elevenlabs.textToSpeech(apiKey, text, voice)           │
│  └── Just HTTP calls - no decisions, no DB, no state        │
└─────────────────────────────────────────────────────────────┘
```

### Example: MESSAGE_USER Flow

```typescript
// 1. Tool handler (packages/tools/definitions/message-user/handler.ts)
//    Does: logHistory(), decides what external actions are needed
//    Returns: { success: true, data: { content, needsTelegram: true, needsVoice: true } }

// 2. Platform post-processing (platforms/cloudflare)
if (result.data?.needsTelegram) {
  await telegram.sendMessage(env.TELEGRAM_TOKEN, chatId, result.data.content);
}
if (result.data?.needsVoice) {
  const audio = await elevenlabs.tts(env.ELEVENLABS_KEY, result.data.content);
  await telegram.sendVoice(env.TELEGRAM_TOKEN, chatId, audio);
}

// 3. Services (packages/services/telegram/messages.ts)
//    Just: fetch('https://api.telegram.org/bot{token}/sendMessage', { body })
//    No DB, no logging, no business logic
```

### Why This Separation?

1. **Tool handlers are testable** - Mock the services, test the business logic
2. **Services are reusable** - Any tool can use telegram.sendMessage()
3. **Platform is thin** - Just wiring, no decisions
4. **Clear ownership** - "Where does X happen?" has one answer

---

## Principles

### 1. Secrets as Parameters

Services do NOT access environment variables directly. API keys are passed in:

```typescript
// GOOD
const telegram = new TelegramService(apiToken);
await telegram.sendMessage(chatId, text);

// BAD - don't do this
const telegram = new TelegramService(); // reads from process.env internally
```

**Why:** Makes services testable, portable, and explicit about dependencies.

### 2. No Cross-Cutting Concerns

Services don't know about:
- **Database** (that's `@persistence/db`)
- **Logging to history** (caller's job)
- **Other services** (Telegram doesn't know about Replicate)

Services ONLY know how to talk to their external API.

### 3. Structured Results

Services return typed results, not raw API responses:

```typescript
// GOOD
interface SendMessageResult {
  messageId: number;
  chatId: string;
  timestamp: Date;
}

// BAD - exposing raw API
interface SendMessageResult {
  ok: boolean;
  result: {
    message_id: number;
    chat: { id: number; type: string; ... };
    // ... tons of Telegram internals
  };
}
```

---

## Directory Structure for a Service

Each service gets its own directory:

```
packages/services/src/{service-name}/
├── index.ts        # Clean exports
├── types.ts        # Service-specific types
├── client.ts       # Main service class (if stateful)
├── {operation}.ts  # Individual operations
└── utils.ts        # Service-specific helpers (optional)
```

### Example: Telegram

```
packages/services/src/telegram/
├── index.ts
│   └── export { TelegramService } from './client';
│       export { sendMessage, sendPhoto, ... } from './messages';
│       export type { TelegramConfig, SendResult, ... } from './types';
│
├── types.ts
│   └── interface TelegramConfig { token: string; }
│       interface SendResult { messageId: number; chatId: string; }
│       interface PhotoResult extends SendResult { fileId: string; }
│
├── client.ts
│   └── class TelegramService {
│         constructor(config: TelegramConfig) {}
│         sendMessage(chatId, text, options?) {}
│         sendPhoto(chatId, photo, options?) {}
│       }
│
├── messages.ts
│   └── Standalone functions if you prefer functional style:
│       async function sendMessage(token, chatId, text) {}
│       async function sendPhoto(token, chatId, photo) {}
│
├── media.ts
│   └── sendAudio(), sendDocument(), sendVideo()
│
└── formatting.ts
    └── chunkMessage(), escapeMarkdown(), buildInlineKeyboard()
```

---

## Implementing a New Service

### Step 1: Create Types

```typescript
// packages/services/src/myservice/types.ts

export interface MyServiceConfig {
  apiKey: string;
  baseUrl?: string;  // Optional override for testing
}

export interface MyServiceInput {
  // What the service needs to do its job
}

export interface MyServiceResult {
  // What the service returns on success
}

export interface MyServiceError {
  code: string;
  message: string;
  retryable: boolean;
}
```

### Step 2: Implement Client

```typescript
// packages/services/src/myservice/client.ts

import type { MyServiceConfig, MyServiceInput, MyServiceResult } from './types';
import { ServiceResult } from '../core/types';

export class MyServiceClient {
  private baseUrl: string;

  constructor(private config: MyServiceConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.myservice.com';
  }

  async doThing(input: MyServiceInput): Promise<ServiceResult<MyServiceResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/endpoint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: {
            code: error.code ?? 'UNKNOWN',
            message: error.message ?? response.statusText,
            retryable: response.status >= 500,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: this.mapResponse(data),
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: (err as Error).message,
          retryable: true,
        },
      };
    }
  }

  private mapResponse(raw: unknown): MyServiceResult {
    // Transform raw API response to our clean type
  }
}
```

### Step 3: Export from Index

```typescript
// packages/services/src/myservice/index.ts

export { MyServiceClient } from './client';
export type {
  MyServiceConfig,
  MyServiceInput,
  MyServiceResult,
  MyServiceError,
} from './types';
```

### Step 4: Add to Package Barrel

```typescript
// packages/services/src/index.ts

export * from './telegram';
export * from './discord';
export * from './replicate';
export * from './myservice';  // Add new service
```

---

## For Async Services

If your service has async jobs (like Replicate), implement `AsyncJobService`:

```typescript
// packages/services/src/myservice/client.ts

import type { AsyncJobService, AsyncJob } from '../core/async-job';

export class MyServiceClient implements AsyncJobService<MyInput, MyOutput> {
  async startJob(input: MyInput): Promise<{ jobId: string }> {
    // Start async operation, return job ID
  }

  async checkJob(jobId: string): Promise<AsyncJob<MyOutput>> {
    // Poll job status
  }

  async cancelJob(jobId: string): Promise<void> {
    // Optional: cancel running job
  }
}
```

See [ASYNC_JOB_PATTERN.md](./ASYNC_JOB_PATTERN.md) for full details.

---

## Common Patterns

### Retry Logic

Use the shared retry utility from core:

```typescript
import { withRetry } from '../core/http';

const result = await withRetry(
  () => this.doThing(input),
  { maxAttempts: 3, delayMs: 1000, backoff: 'exponential' }
);
```

### Rate Limiting

If the service has rate limits, track them:

```typescript
export class RateLimitedService {
  private lastRequest = 0;
  private minInterval = 100; // ms between requests

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }
    this.lastRequest = Date.now();
  }

  async doThing(input: Input): Promise<Result> {
    await this.throttle();
    // ... make request
  }
}
```

### Pagination

Return an async iterator for paginated results:

```typescript
async *listItems(query: string): AsyncGenerator<Item> {
  let cursor: string | undefined;

  do {
    const response = await this.fetch('/items', { query, cursor });
    for (const item of response.items) {
      yield item;
    }
    cursor = response.nextCursor;
  } while (cursor);
}

// Usage
for await (const item of service.listItems('query')) {
  console.log(item);
}
```

---

## Testing Services

Services should be easy to test because they take dependencies as parameters:

```typescript
// In tests
import { TelegramService } from '@persistence/services';

// Mock fetch or use a fake token
const service = new TelegramService({ token: 'test-token' });

// Or inject a custom base URL for a mock server
const service = new TelegramService({
  token: 'test',
  baseUrl: 'http://localhost:3000/mock-telegram',
});
```

---

## Service Checklist

When adding a new service:

- [ ] Create `packages/services/src/{name}/` directory
- [ ] Define types in `types.ts`
- [ ] Implement client in `client.ts`
- [ ] Export from `index.ts`
- [ ] Add to package barrel (`src/index.ts`)
- [ ] If async, implement `AsyncJobService` interface
- [ ] Add tests
- [ ] Update this document's service list
