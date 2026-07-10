# Services Architecture

**Created:** 2026-01-29
**Status:** Design Document

This document defines the architecture for `@persistence/services` - capability-based external service integrations.

---

## Core Principle: Capability Over Provider

Services are organized by **what they do**, not **who provides them**.

```
WRONG (provider-based):          RIGHT (capability-based):
├── elevenlabs/                  ├── tts/
├── replicate/                   ├── stt/
├── telegram/                    ├── image_generation/
├── discord/                     ├── messaging/
└── brave/                       └── search/
```

**Why?**
- Consumer code says "I need TTS" not "I need ElevenLabs"
- Providers can be swapped without changing business logic
- Clear capability boundaries for testing and mocking

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONSUMER LAYER                                  │
│  packages/tools/        packages/telegram/        platforms/cloudflare/      │
│  (handlers)             (commands)                (wiring)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ uses capability interfaces
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         @persistence/services                                │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │     tts/    │  │     stt/    │  │   image_    │  │  messaging/ │        │
│  │             │  │             │  │ generation/ │  │             │        │
│  │ TTSService  │  │ STTService  │  │ImageService │  │ Messaging   │        │
│  │  interface  │  │  interface  │  │  interface  │  │  Service    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│    ┌────┴────┐      ┌────┴────┐     ┌────┼────┐      ┌────┼────┐          │
│    │elevenlabs│     │ whisper │     │repl│cf  │      │tele│disc│          │
│    │provider │      │provider │     │icate│ai │      │gram│ord │          │
│    └─────────┘      └─────────┘     └────┴────┘      └────┴────┘          │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐                                          │
│  │   search/   │  │   llm/      │  (if we add unified LLM interface)       │
│  │             │  │             │                                          │
│  │SearchGateway│  │ LLMService  │  (Gateway pattern - single entry point) │
│  │    (high-   │  │             │                                          │
│  │   level)    │  └──────┬──────┘                                          │
│  └──────┬──────┘         │                                                  │
│         │           ┌────┼────┐                                            │
│    ┌────┴────┐      │anth│open│                                            │
│    │Claude   │      │ropic│ai │                                            │
│    │Search   │      └────┴────┘                                            │
│    │Provider │                                                              │
│    └─────────┘                                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP calls with credentials
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL APIS                                      │
│  ElevenLabs    Cloudflare AI    Replicate    Telegram    Discord    Brave   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File vs Directory: When to Promote

A single `.ts` file becomes a directory when ANY of these conditions are met:

### Promotion Rules

| Condition | Example | Action |
|-----------|---------|--------|
| **Multiple providers** | tts has ElevenLabs + Google | Create `tts/` directory |
| **>200 lines** | telegram.ts grows to 250 lines | Split into `telegram/` |
| **>3 exports** | messaging exports send, sendPhoto, sendVoice, sendDocument, formatKeyboard | Create `messaging/` |
| **Needs shared types** | Provider needs its own complex types | Create `{capability}/types.ts` |
| **Has async job pattern** | Image generation needs poll/check/cancel | Create `{capability}/` with job handling |

### Start Simple, Promote When Needed

```
INITIAL (single file):           AFTER PROMOTION (directory):
├── tts.ts                       ├── tts/
├── stt.ts                       │   ├── types.ts
├── messaging.ts                 │   ├── elevenlabs.ts
└── search.ts                    │   ├── google.ts (if added later)
                                 │   └── index.ts
                                 ├── stt.ts          (still simple)
                                 ├── messaging/
                                 │   ├── types.ts
                                 │   ├── telegram.ts
                                 │   ├── discord.ts
                                 │   └── index.ts
                                 └── search.ts       (still simple)
```

---

## Capability Interface Pattern

Each capability defines an interface that all providers must implement:

```typescript
// packages/services/src/tts/types.ts

export interface TTSOptions {
  voice?: string;
  model?: string;
  stability?: number;
  speed?: number;
}

export interface TTSResult {
  audio: ArrayBuffer;
  durationMs: number;
  charCount: number;
}

export interface TTSService {
  /**
   * Convert text to speech audio
   */
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;

  /**
   * List available voices (optional)
   */
  listVoices?(): Promise<Voice[]>;
}
```

### Provider Implementation

```typescript
// packages/services/src/tts/elevenlabs.ts

import type { TTSService, TTSOptions, TTSResult } from './types';

export class ElevenLabsProvider implements TTSService {
  constructor(private apiKey: string) {}

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/...', {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          // ...
        },
      }),
    });

    const audio = await response.arrayBuffer();
    return {
      audio,
      durationMs: /* from headers or estimate */,
      charCount: text.length,
    };
  }
}
```

---

## Directory Structure

```
packages/services/
├── src/
│   ├── core/                    # Shared utilities
│   │   ├── types.ts             # ServiceResult<T>, AsyncJob, etc.
│   │   ├── http.ts              # Shared fetch wrapper with retry
│   │   └── errors.ts            # ServiceError types
│   │
│   ├── tts/                     # Text-to-Speech capability
│   │   ├── types.ts             # TTSService interface
│   │   ├── elevenlabs.ts        # ElevenLabs provider
│   │   └── index.ts             # export { ElevenLabsProvider as default }
│   │
│   ├── stt/                     # Speech-to-Text capability
│   │   ├── types.ts             # STTService interface
│   │   ├── whisper.ts           # Cloudflare AI Whisper
│   │   ├── modal.ts             # Modal prosody service
│   │   └── index.ts
│   │
│   ├── image_generation/        # Image Creation capability
│   │   ├── types.ts             # ImageService interface
│   │   ├── replicate.ts         # Replicate (FLUX, SDXL)
│   │   ├── cloudflare.ts        # Cloudflare AI
│   │   ├── pony.ts              # Local Pony Studio
│   │   └── index.ts
│   │
│   ├── messaging/               # Message Delivery capability
│   │   ├── types.ts             # MessagingService interface
│   │   ├── telegram.ts          # Telegram Bot API
│   │   ├── discord.ts           # Discord Webhooks
│   │   └── index.ts
│   │
│   ├── search/                  # Web Search capability
│   │   ├── types.ts             # SearchService interface
│   │   ├── brave.ts             # Brave Search API
│   │   └── index.ts
│   │
│   └── index.ts                 # Package barrel export
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Usage Examples

### Example 1: Messaging Service

```typescript
// In a tool handler (packages/tools/definitions/message-user/handler.ts)

import type { MessagingService } from '@persistence/services';

export async function handleMessageUser(
  db: D1Database,
  content: string,
  services: { messaging: MessagingService }  // Injected by platform
): Promise<ActionResult> {
  // Log to history (business logic)
  await logHistory(db, { type: 'message_to_user', content });

  // Return what external action is needed
  return {
    success: true,
    data: {
      content,
      needsMessaging: true,  // Platform will call services.messaging.send()
    },
  };
}

// In platform layer (platforms/cloudflare/src/index.js)

import { TelegramProvider } from '@persistence/services/messaging';

const messaging = new TelegramProvider(env.TELEGRAM_TOKEN);

if (result.data?.needsMessaging) {
  await messaging.send(chatId, result.data.content);
}
```

### Example 2: SearchGateway Facade (High-Level Entry Point)

```typescript
// SearchGateway is a high-level facade that wraps ClaudeSearchProvider
// It provides metadata tracking and a cleaner interface for search operations

import { SearchGateway } from '@persistence/services/search';

// Create gateway from API key
const search = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);

// Perform search with metadata
const result = await search.search('latest AI news 2026');

if (result.success) {
  // metadata contains: { provider, model, tool, durationMs, query }
  console.log(`Search took ${result.metadata.durationMs}ms`);
  console.log(`Result: ${result.summary}`);

  // Log with metadata
  await logHistory({
    db,
    type: 'search_result',
    content: result.summary,
    internal: `Provider: ${result.metadata.provider}, Duration: ${result.metadata.durationMs}ms`
  });
} else {
  console.error(`Search failed: ${result.error}`);
}

// For backwards compatibility with doWebSearch(), use searchSimple()
const simpleResult = await search.searchSimple('query');
```

**Key difference from ClaudeSearchProvider:**
- **SearchGateway** = High-level facade with metadata tracking (PREFERRED for new code)
- **ClaudeSearchProvider** = Low-level provider that just handles the API call

---

## Testing Strategy

### 1. Mock the Interface, Not the Provider

```typescript
// In tests
const mockTTS: TTSService = {
  synthesize: vi.fn().mockResolvedValue({
    audio: new ArrayBuffer(100),
    durationMs: 1000,
    charCount: 50,
  }),
};

// Test business logic with mock
await handleVoiceMessage(db, audio, { tts: mockTTS });
expect(mockTTS.synthesize).toHaveBeenCalledWith('Hello', expect.any(Object));
```

### 2. Provider Tests Verify HTTP Calls

```typescript
// packages/services/src/tts/__tests__/elevenlabs.test.ts

describe('ElevenLabsProvider', () => {
  it('calls correct endpoint with headers', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(100))
    );

    const provider = new ElevenLabsProvider('test-api-key');
    await provider.synthesize('Hello');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('api.elevenlabs.io'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'xi-api-key': 'test-api-key',
        }),
      })
    );
  });
});
```

---

## Migration Path

### Phase 1: Create Package Structure
- Create `packages/services/` with capability directories
- Define interfaces (types.ts for each capability)
- Implement providers as thin HTTP wrappers

### Phase 2: Wire to Platform
- Update platform layer to instantiate providers
- Inject providers into handler contexts
- Migrate handlers to use capability interfaces

### Phase 3: Complete Handler Migration
- Move remaining 46 telegram handlers to packages
- They now return flags; platform calls services
- All business logic in packages, all HTTP in services

---

## Anti-Patterns

### DON'T: Put business logic in services

```typescript
// BAD - service making business decisions
async synthesize(text: string) {
  if (text.length > 5000) {
    text = text.slice(0, 5000);  // Don't do this in service!
  }
  // ...
}

// GOOD - caller handles business logic
const truncated = text.slice(0, 5000);  // Caller decides
await tts.synthesize(truncated);
```

### DON'T: Access database from services

```typescript
// BAD - service touching database
async synthesize(text: string, db: D1Database) {
  await logHistory(db, ...);  // Don't do this!
}

// GOOD - caller handles database
await logHistory(db, { type: 'voice_sent', content: text });
await tts.synthesize(text);
```

### DON'T: Hardcode provider selection

```typescript
// BAD - hardcoded provider
const tts = new ElevenLabsProvider(apiKey);

// GOOD - configurable via factory or DI
const tts = createTTSService(config.ttsProvider, credentials);
```
