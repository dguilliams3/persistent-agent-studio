# Architecture Manifesto

**Created:** 2026-01-29
**Status:** Living Document
**Last Updated:** 2026-01-29

This is the north star for architectural decisions. When in doubt, return here.

---

## The Vision

**A portable, testable system where business logic lives in packages and platforms are thin wiring.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WHERE WE'RE GOING                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │
│  │  Cloudflare │   │    Node     │   │    Deno     │   platforms/      │
│  │   Workers   │   │   Server    │   │   Deploy    │   (thin wiring)   │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                   │
│         │                 │                 │                           │
│         └────────────────┬┴─────────────────┘                           │
│                          │                                              │
│                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      packages/                                   │   │
│  │                                                                  │   │
│  │   @persistence/core      ← Types, constants, utilities           │   │
│  │   @persistence/db        ← Database operations                   │   │
│  │   @persistence/memory    ← Summarization, RAG, context           │   │
│  │   @persistence/services  ← External API clients (TTS, STT, etc.) │   │
│  │   @persistence/tools     ← Tool definitions and handlers         │   │
│  │   (telegram in services + platform; no @persistence/telegram pkg)  │   │
│  │   @persistence/llm       ← LLM API abstraction                   │   │
│  │   @persistence/runtime   ← Cycle guards, state machine           │   │
│  │   @persistence/voice     ← Audio processing                      │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  packages/ contains ALL business logic. Zero platform-specific code.    │
│  Any package should run on any JavaScript runtime with proper DI.       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Basin Pattern: Dependencies Flow In

Functions receive everything they need as parameters. No reaching out to globals, env, or singletons.

```typescript
// WRONG - reaches out for dependencies
async function handleMessage(content: string) {
  const db = getDatabase();           // ❌ Hidden dependency
  const token = process.env.TOKEN;    // ❌ Environment coupling
  await sendTelegram(content, token);
}

// RIGHT - dependencies flow in
async function handleMessage(
  db: D1Database,
  content: string,
  messaging: MessagingService
): Promise<MessageResult> {
  await logHistory(db, { type: 'message', content });
  return { success: true, needsMessaging: true, content };
}
```

### 2. Capabilities Over Providers

Organize code by what it DOES, not who provides it.

```
WRONG (provider-based):          RIGHT (capability-based):
├── elevenlabs/                  ├── tts/
├── replicate/                   │   ├── types.ts (interface)
├── cloudflare-ai/               │   ├── elevenlabs.ts
├── telegram/                    │   └── google.ts
└── discord/                     ├── image_generation/
                                 │   ├── types.ts
                                 │   ├── replicate.ts
                                 │   └── cloudflare.ts
                                 └── messaging/
                                     ├── types.ts
                                     ├── telegram.ts
                                     └── discord.ts
```

### 3. Platform Layer is Wiring Only

Platforms should do exactly three things:
1. **Bootstrap** - Create providers, read env/secrets
2. **Wire** - Connect packages to each other
3. **Dispatch** - Route requests to handlers

```typescript
// Platform layer (thin)
export default {
  async fetch(request: Request, env: Env) {
    // 1. Bootstrap
    const secrets = new CloudflareSecretsProvider(env);
    const db = env.DB;

    // 2. Wire
    const tts = await ElevenLabsProvider.create(secrets);
    const messaging = await TelegramProvider.create(secrets);

    // 3. Dispatch
    const result = await handleCommand(db, request, { tts, messaging });
    return new Response(JSON.stringify(result));
  }
};
```

### 4. Handlers Return Flags, Platform Acts

Handlers contain business logic but don't call external services directly. They return flags indicating what's needed.

```typescript
// Package handler (business logic)
export async function handleTts(db: D1Database, text: string): Promise<TtsResult> {
  if (text.length > 5000) {
    return { success: false, error: 'Text too long' };
  }
  await logHistory(db, { type: 'tts_request', content: text });
  return { success: true, needsTTS: true, text };
}

// Platform layer (service calls)
const result = await handleTts(db, text);
if (result.needsTTS) {
  const audio = await tts.synthesize(result.text);
  await messaging.sendVoice(chatId, audio);
}
```

### 5. Secrets Provider Abstraction

Credentials should flow through an abstraction, not be passed as raw strings.

```typescript
// Interface
interface SecretsProvider {
  get(key: string): Promise<string | undefined>;
  require(key: string): Promise<string>;
}

// Implementations
class CloudflareSecretsProvider implements SecretsProvider { ... }
class NodeEnvSecretsProvider implements SecretsProvider { ... }
class VaultSecretsProvider implements SecretsProvider { ... }

// Services receive provider, not raw credentials
const tts = await ElevenLabsProvider.create(secrets);
// Internally: const apiKey = await secrets.require('ELEVENLABS_KEY');
```

### 6. Interface First, Implementation Second

Every capability defines an interface. Providers implement it. Consumers depend on the interface.

```typescript
// Consumer depends on interface
async function processVoice(
  audio: ArrayBuffer,
  stt: STTService  // Interface, not CloudflareWhisperProvider
): Promise<string> {
  const result = await stt.transcribe(audio);
  return result.text;
}
```

### 7. Configuration as Data

Definitions (tools, commands, providers) should be data structures, not code.

```typescript
// Tool definitions are data
const REMINDER_SCHEMA: ToolSchema = {
  name: 'REMINDER',
  params: {
    op: { type: 'enum', values: ['set', 'dismiss'], required: true },
    content: { type: 'string', requiredWhen: 'op === "set"' },
    id: { type: 'number', requiredWhen: 'op === "dismiss"' }
  },
  defaults: { content: '', id: null }
};

// Derive handlers, validation, help text from data
const handler = createToolHandler(REMINDER_SCHEMA);
const validator = createValidator(REMINDER_SCHEMA);
const helpText = generateHelpText(REMINDER_SCHEMA);
```

---

## Anti-Patterns

### Don't: Put business logic in services
Services are HTTP clients. They transform API requests/responses. They don't make decisions.

### Don't: Access database from services
Services call external APIs. Database access belongs in handlers or dedicated db packages.

### Don't: Hardcode provider selection
Use configuration or dependency injection. The caller decides which provider to use.

### Don't: Let packages know about platforms
Telegram command handlers live in @persistence/services (portable) + platforms/cloudflare/src/telegram (platform-specific). No separate @persistence/telegram package.

### Don't: Skip the interface
Even with one provider, define the interface. Future you will thank present you.

---

## Service Facades (Public API)

**Facade Pattern (Gang of Four):** A simplified interface to a complex subsystem.

These classes are the **public API** of `@persistence/services`. They hide HTTP calls, error handling, retries, and credential management. Platform code should use these Facades instead of writing direct API calls.

**In Hexagonal Architecture terms:** These are **Adapters** that implement our internal **Ports** (interfaces like `MessagingService`, `TTSService`).

### All Facades (9 total)

| Capability | Facade Class | Location | Status | Replaces |
|------------|--------------|----------|--------|----------|
| **Messaging** | `TelegramProvider` | `messaging/telegram/provider.ts` | ✅ Ready | `platforms/.../services/telegram.js` |
| **Messaging** | `DiscordWebhookProvider` | `messaging/discord.ts` | ✅ Ready | Direct webhook calls |
| **TTS** | `ElevenLabsProvider` | `tts/elevenlabs/provider.ts` | ✅ Ready | Direct ElevenLabs API |
| **STT** | `CloudflareWhisperProvider` | `stt/whisper.ts` | ✅ Ready | Direct AI binding calls |
| **STT+Prosody** | `ModalProsodyProvider` | `stt/modal.ts` | ✅ Ready | Direct Modal API |
| **Images** | `ReplicateProvider` | `image_generation/replicate.ts` | ✅ Ready | Direct Replicate API |
| **Images** | `CloudflareAIProvider` | `image_generation/cloudflare.ts` | ✅ Ready | Direct AI binding calls |
| **Images** | `PonyStudioProvider` | `image_generation/pony.ts` | ✅ Ready | Direct Pony Studio API |
| **Search** | `ClaudeSearchProvider` | `search/brave.ts` | ✅ Ready | Direct Brave API |

### Usage Example

```typescript
// CORRECT: Use the Facade
import { TelegramProvider } from '@persistence/services';

const telegram = await TelegramProvider.create(secrets);
await telegram.sendText(chatId, result.message);
await telegram.sendPhoto(chatId, imageBuffer, { caption: 'Generated art' });
await telegram.sendVoice(chatId, audioBuffer);

// WRONG: Legacy platform helper (avoid for new code)
import { sendTelegram } from '../../services/telegram.js';
await sendTelegram(chatId, message, env);  // Don't do this
```

### Why Facades?

1. **Testable**: Mock the Facade, not HTTP calls
2. **Portable**: Same Facade works across platforms
3. **Consistent errors**: All return `ServiceResult<T>`
4. **Credential isolation**: Facades handle auth internally

---

## Migration Checkpoints

### Checkpoint 1: Package Extraction (DONE)
- [x] Core business logic in packages/
- [x] 8 packages with clear responsibilities
- [x] 1,782 tests covering package code

### Checkpoint 2: Services Abstraction (IN PROGRESS)
- [x] packages/services/ with capability-based structure
- [x] 5 capabilities: tts, stt, image_generation, messaging, search
- [x] 8 providers implemented
- [ ] Platform layer updated to use services

### Checkpoint 3: Handler Migration (IN PROGRESS)
- [x] 29 telegram handlers migrated to packages
- [ ] 13 complex handlers (need services/secrets abstractions)
- [ ] Platform layer reduced to wiring only

### Checkpoint 4: Secrets Abstraction (NOT STARTED)
- [ ] SecretsProvider interface in @persistence/core
- [ ] CloudflareSecretsProvider implementation
- [ ] Services updated to use provider
- [ ] Platform bootstraps provider once

### Checkpoint 5: Multi-Platform (FUTURE)
- [ ] Node.js platform implementation
- [ ] Same packages, different platform wiring
- [ ] Prove portability

---

## Architectural Signals

When you discover something that suggests refactoring, add it here with a date.

### Active Signals

| ID | Date | Source | Signal | Proposed Solution |
|----|------|--------|--------|-------------------|
| REFACTOR-001 | 2026-01-29 | handleModel blockers | LLM provider abstraction needed | packages/services/src/llm/ with provider registry |
| REFACTOR-002 | 2026-01-29 | handlePersona blocker | Persona registry needed | packages/core/src/persona/ |
| REFACTOR-003 | 2026-01-29 | handleToolsCommand | Tool registry export needed | getToolRegistry() in packages/tools |
| REFACTOR-004 | 2026-01-29 | Config handlers | Config registry pattern | createConfigHandler(ConfigDefinition) factory |
| REFACTOR-005 | 2026-01-29 | Platform-holds-credentials | Secrets provider abstraction | packages/core/src/secrets/ |
| REFACTOR-006 | 2026-01-31 | Pattern B handlers in packages | 16 handlers violate Principle 4 | Convert to Pattern A (pure handlers) |

### Resolved Signals

| ID | Date | Resolution |
|----|------|------------|
| (none yet) | | |

---

## Decision Log

Major architectural decisions and their rationale.

### 2026-01-31: Pure Handler Pattern (Pattern A) for commands
**Decision:** Command handlers MUST be pure functions: `(db, args[]) → Result`
**Rationale:** Directly implements Principle 4. Handlers return data, platform sends messages.
**Anti-pattern:** "Integrated" handlers that take `{db, token, chatId}` and send internally (Pattern B)
**Document:** `runs/RUN-20260130-1917-evaluate-new-architecture/SPEC_v2.md`

### 2026-01-29: Capability-based services structure
**Decision:** Organize services by capability (tts/, stt/) not provider (elevenlabs/, replicate/)
**Rationale:** Consumer code says "I need TTS" not "I need ElevenLabs". Providers are swappable.
**Document:** `docs/architecture/SERVICES_ARCHITECTURE.md`

### 2026-01-29: Flag-based handler pattern
**Decision:** Handlers return `{ needsTTS: true }` flags, platform calls services
**Rationale:** Keeps business logic portable, credentials in platform, services mockable
**Document:** `runs/RUN-20260129-0958-package-test-coverage/subagents/telegram-api-migrate/FINDINGS.md`

### 2026-01-26: Basin pattern for dependencies
**Decision:** All functions receive dependencies as parameters
**Rationale:** Testable, portable, explicit dependencies
**Document:** `runs/RUN-20260126-1428-architecture-formalization/DECISION-memory-package.md`

---

## Reading List

For deeper understanding of specific areas:

| Topic | Document |
|-------|----------|
| Package responsibilities | `docs/architecture/PACKAGE_STRUCTURE.md` |
| Platform vs package code | `docs/architecture/PLATFORM_VS_PACKAGE.md` |
| Services design | `docs/architecture/SERVICES_ARCHITECTURE.md` |
| Async job handling | `docs/architecture/ASYNC_JOB_PATTERN.md` |
| Tool definitions | `packages/tools/README.md` |
| Memory system | `packages/memory/README.md` |

---

*This manifesto is a living document. Update it when principles clarify or new patterns emerge.*
