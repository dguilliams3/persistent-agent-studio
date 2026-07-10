# @services

Unified services layer for the Claude Existence Loop. This package contains **implementations** - command handlers, business logic, and service abstractions - for various messaging platforms and integrations.

## What This Package Does

Services are the **implementation layer** that sits between:
- **Persistence** (`@persistence/*` packages): Type definitions, schemas, pure utilities
- **Platform** (`platforms/cloudflare/src/`, etc.): Credential injection, routing, HTTP layer

Services contain:
- Command handlers (business logic implementations)
- Stateful service abstractions (TelegramProvider, DiscordProvider)
- Format-specific utilities
- Result types for handlers

## Capability Domains

The package exports **6 capability domains** organized by function, not vendor:

| Domain | Path | Purpose |
|--------|------|---------|
| **Core** | `src/core/` | ServiceResult pattern, error classes, HTTP utilities |
| **TTS** | `src/tts/` | Text-to-speech (ElevenLabsProvider) |
| **STT** | `src/stt/` | Speech-to-text (CloudflareWhisperProvider, ModalProsodyProvider) |
| **Image Generation** | `src/image_generation/` | Image gen (ReplicateProvider, CloudflareAIProvider, PonyStudioProvider) |
| **Messaging** | `src/messaging/` | Telegram handlers, Discord webhooks |
| **Search** | `src/search/` | Web search (ClaudeSearchProvider, BraveSearchProvider) |

### Subpath Imports

```typescript
import { ServiceResult, success, failure } from '@persistence/services/core';
import { ElevenLabsProvider, ELEVENLABS_MODELS } from '@persistence/services/tts';
import { CloudflareWhisperProvider, ModalProsodyProvider } from '@persistence/services/stt';
import { ReplicateProvider, CloudflareAIProvider } from '@persistence/services/image_generation';
import { TelegramProvider, handleCommand } from '@persistence/services/messaging/telegram';
import { ClaudeSearchProvider } from '@persistence/services/search';
```

### Design Principles (from index.ts docblock)

1. **Capability over Provider** - Organize by what you can do (TTS, search), not vendor (ElevenLabs, Brave)
2. **Thin HTTP Clients** - Providers are minimal wrappers around HTTP APIs
3. **Credential Injection** - No secrets stored; credentials passed at call time
4. **Structured Results** - All functions return `ServiceResult<T>` for consistent error handling
5. **No Database Access** - Services are stateless; DB ops happen in caller

## Architecture

```
packages/services/src/
├── core/                          # Shared utilities and patterns
│   ├── types.ts                   # ServiceResult, ServiceError, JobStatus
│   ├── errors.ts                  # Exception classes (Network, Auth, RateLimit)
│   └── http.ts                    # httpRequest, httpGet, httpPost utilities
├── tts/                           # Text-to-speech capability
│   ├── types.ts                   # TTSService, TTSOptions, TTSResult
│   └── elevenlabs.ts              # ElevenLabsProvider
├── stt/                           # Speech-to-text capability
│   ├── types.ts                   # STTService, ProsodyService
│   ├── whisper.ts                 # CloudflareWhisperProvider
│   └── prosody.ts                 # ModalProsodyProvider
├── image_generation/              # Image generation capability
│   ├── types.ts                   # ImageService, AsyncImageService
│   ├── replicate.ts               # ReplicateProvider (FLUX, SDXL)
│   ├── cloudflare.ts              # CloudflareAIProvider
│   └── pony.ts                    # PonyStudioProvider
├── search/                        # Web search capability
│   ├── types.ts                   # SearchService, SearchOptions
│   └── providers.ts               # ClaudeSearchProvider, BraveSearchProvider
├── messaging/                     # Messaging integrations
│   ├── telegram/                  # Telegram bot service
│   │   ├── README.md
│   │   ├── provider.ts            # TelegramProvider - send messages
│   │   ├── router.ts              # Command dispatch
│   │   ├── types.ts               # CommandContext, CommandResult types
│   │   ├── format.ts              # Telegram-specific formatting
│   │   ├── keyboards.ts           # Inline keyboard builders
│   │   └── commands/              # Command handlers (63 files, 24 categories)
│   │       ├── batch/
│   │       ├── config/
│   │       ├── context_data/
│   │       ├── gallery/
│   │       ├── glossary/
│   │       ├── help/
│   │       ├── history/
│   │       ├── llm-config/
│   │       ├── loop/
│   │       ├── model/
│   │       ├── operations/
│   │       ├── persona/
│   │       ├── status/
│   │       ├── summarize/
│   │       ├── tools/
│   │       └── voice/
│   │
│   └── discord.ts                 # Discord notification service
```

## Key Packages

### Telegram Service

**Path:** `src/messaging/telegram/`
**Purpose:** Complete Telegram bot integration
**Import:** `import { ... } from '@services/messaging/telegram'`

Key exports:
- `TelegramProvider` - Service for sending Telegram messages
- `handleCommand()` - Route and execute command handlers
- Command handlers - 40+ implemented commands (handleStatus, handleNotes, etc.)
- Types - CommandContext, CommandResult, specialized result types
- Utilities - Message formatting, keyboard builders

**Documentation:** See [packages/services/src/messaging/telegram/README.md](src/messaging/telegram/README.md)

#### Handler Categories

| Category | Purpose | Example Handlers |
|----------|---------|------------------|
| **batch** | Batch API job management | handleBatch (view/cancel pending jobs) |
| **config** | Configuration commands | handleModel, handleInterval, handleBatch, handlePersona, handleRAG |
| **context_data** | Memory system commands | handleNotes, handleCold, handleSummaries, handleObservations, handleLearned, handleQuestions, handleReminders |
| **data-export** | Data export | handleExport (export history/data) |
| **gallery** | Image gallery | handleGallery, handleImagine |
| **glossary** | Term definitions | handleGlossary |
| **help** | Help menu | handleHelp, buildMainHelpMenu |
| **history** | History access | handleHistory, handleLast, handleSearch |
| **llm-config** | LLM settings | LLM model and provider configuration |
| **loop** | Loop control | handleThink, handlePause, handleResume, handleCancel |
| **model** | Model selection | handleModel (switch LLM model) |
| **operations** | Long-running ops | handleThink (trigger cycle), handleSummarize |
| **persona** | Persona config | handlePersona |
| **status** | Status display | handleStatus, handleDebug, handleMeter |
| **summarize** | Summarization | handleSummarize, handleMetasummarize |
| **tools** | Tools/generation | handleTools (image generation) |
| **voice** | Voice processing | handleVoice (transcribe, TTS, call) |

### Discord Service

**Path:** `src/messaging/discord.ts`
**Purpose:** Discord notification webhook integration

## Design Patterns

### 1. Service Pattern (Handler Architecture)

Handlers are **stateless functions** that return result objects. The platform router **automatically sends messages** when a `CommandResult` has a `message` field (Basin Pattern):

```typescript
// Handler - pure logic + formatting
export async function handleStatus(ctx: CommandContext): Promise<CommandResult> {
  const state = await getState(ctx.db);
  return {
    success: true,
    message: formatStatusDisplay(state),  // Automatically sent by router
    replyMarkup: statusKeyboard(state),
  };
}

// Platform router (routeCommand) - handles sending automatically:
// 1. Calls handler
// 2. If result.message exists, sends it via sendTelegram()
// 3. Returns { ok: true }
```

**Note:** As of 2026-01-30, the platform router automatically sends `result.message` if present. Handlers no longer need to call `sendTelegram()` directly for simple text responses.

### 2. Result Type Pattern

All handlers return `CommandResult` or a specialized variant:

```typescript
interface CommandResult {
  success: boolean;
  message?: string;              // Main response (HTML)
  photo?: string;                // Photo URL or base64
  document?: { data, filename };
  voice?: ArrayBuffer;
  error?: string;
  replyMarkup?: InlineKeyboardMarkup;
}

// Specialized variants for async operations
interface ThinkResult extends CommandResult {
  needsThinkingCycle: true;
  force: boolean;
}

interface TTSResult extends CommandResult {
  needsTTS: true;
  text: string;
  model: string;
}
```

### 3. Provider Pattern

Service providers (TelegramProvider, DiscordProvider) are **stateless wrappers** around external APIs:

```typescript
const provider = new TelegramProvider(botToken);
await provider.sendText(chatId, 'Hello!');
await provider.sendPhoto(chatId, imageUrl, 'caption');
await provider.sendVoice(chatId, audioBase64);
```

## Usage Examples

### Routing a Telegram Command

```typescript
import {
  TelegramProvider,
  handleCommand,
  type CommandContext
} from '@services/messaging/telegram';

// Platform layer (e.g., platforms/cloudflare/src/telegram/router.ts)
const provider = new TelegramProvider(env.TELEGRAM_BOT_TOKEN);

const ctx: CommandContext = {
  db,
  chatId: message.chat.id,
  args: commandArgs,
  token: env.TELEGRAM_BOT_TOKEN,
};

const result = await handleCommand(commandName, ctx);

// Send result based on type
if (result.message) {
  await provider.sendText(ctx.chatId, result.message);
}
if (result.photo) {
  await provider.sendPhoto(ctx.chatId, result.photo);
}
if ('needsThinkingCycle' in result) {
  await triggerThinkCycle(ctx);  // Async continuation
}
```

### Adding a New Command Handler

1. **Create handler file** in appropriate category:
   ```typescript
   // src/messaging/telegram/commands/config/new-feature.ts
   export async function handleNewFeature(ctx: CommandContext): Promise<CommandResult> {
     const data = await getData(ctx.db);
     return {
       success: true,
       message: formatData(data),
     };
   }
   ```

2. **Export from index.ts**:
   ```typescript
   // src/messaging/telegram/commands/config/index.ts
   export { handleNewFeature } from './new-feature';
   ```

3. **Register in router** (platform layer):
   ```typescript
   case 'newfeature':
     return await handleNewFeature(ctx);
   ```

4. **Document in help** (if user-facing command)

## Backward Compatibility

This package contains migrated code from older structures. For compatibility:

- Old imports from `@persistence/telegram` still work (re-exported)
- New code should use `@services/messaging/telegram`
- Handler signatures return `CommandResult` (not raw strings)

## Related Documentation

- **Package Reference:** See individual service READMEs
  - Telegram: [src/messaging/telegram/README.md](src/messaging/telegram/README.md)
- **Architecture:** [docs/architecture/SERVICES_ARCHITECTURE.md](../../docs/architecture/SERVICES_ARCHITECTURE.md)
- **Platform Integration:** [docs/architecture/PLATFORM_VS_PACKAGE.md](../../docs/architecture/PLATFORM_VS_PACKAGE.md)
- **Docstring Standards:** [docs/ai_native/DOCSTRING_CONVENTIONS.md](../../docs/ai_native/DOCSTRING_CONVENTIONS.md)

## Contributing

When adding new services:

1. Create a new directory under `src/` with clear responsibility
2. Follow the handler/provider pattern established by Telegram
3. Export types and handlers via `index.ts`
4. Create a README.md explaining the service
5. Use `CommandResult` or similar result types
6. Keep handlers stateless and testable
