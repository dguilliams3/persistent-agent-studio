# Platform vs Package

**Created:** 2026-01-27
**Status:** Vision Document

This document clarifies what belongs in the platform layer (`platforms/cloudflare`) vs packages (`packages/*`).

---

## The Key Question

> "Could this code run in a different JavaScript runtime?"

If **yes** → Package
If **no** → Platform

---

## What's Actually Cloudflare-Specific?

Very little! Here's the exhaustive list:

| Thing | Why Cloudflare | Notes |
|-------|----------------|-------|
| `env.DB` | D1 binding | Abstracted by @persistence/db |
| `env.AI` | Cloudflare AI binding | Barely used - prefer Replicate |
| `fetch()` handler | Worker entry point | Platform-specific |
| `scheduled()` handler | Cron trigger | Platform-specific |
| `env.*` secrets | How Worker gets API keys | Just env vars - portable |
| `waitUntil()` | Background processing | Cloudflare-specific API |

**Everything else is just JavaScript.** Telegram, Discord, Replicate, Anthropic, OpenAI, ElevenLabs, Brave - all just HTTP calls.

---

## What Goes in Packages

### Portable Business Logic (10 packages)

```
packages/
├── core/       # Types, constants (no runtime deps)
├── db/         # D1 operations (takes binding as param)
├── discord/    # Discord integration and webhooks
├── llm/        # LLM APIs (takes API key as param)
├── memory/     # Summarization, RAG, context
├── runtime/    # Runtime utilities and environment
├── services/   # External APIs (takes API key as param)
├── telegram/   # Telegram command handlers
├── tools/      # Tool definitions and handlers
└── voice/      # Voice/TTS functionality
```

**Pattern:** Functions take their dependencies as parameters.

```typescript
// Package code - portable
export async function sendTelegram(
  token: string,      // Passed in
  chatId: string,
  message: string
): Promise<SendResult> {
  // Just HTTP - works anywhere
}

export async function logHistory(
  db: D1Database,     // Passed in
  entry: HistoryEntry
): Promise<void> {
  // D1 operations - binding passed in
}
```

---

## What Goes in Platform

### 1. Entry Points

```typescript
// platforms/cloudflare/src/index.ts

export default {
  // HTTP request handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Route to appropriate handler
  },

  // Cron trigger handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run thinking cycle
  },
};
```

### 2. Binding Extraction

```typescript
// platforms/cloudflare/src/bindings.ts

export function getServices(env: Env) {
  return {
    db: env.DB,
    telegram: new TelegramService({ token: env.TELEGRAM_BOT_TOKEN }),
    replicate: new ReplicateService({ apiKey: env.REPLICATE_API_TOKEN }),
    llm: new LLMEngine({
      anthropicKey: env.ANTHROPIC_API_KEY,
      openaiKey: env.OPENAI_API_KEY,
    }),
  };
}
```

### 3. Request Routing

```typescript
// platforms/cloudflare/src/router.ts

export async function handleRequest(
  request: Request,
  services: Services
): Promise<Response> {
  const url = new URL(request.url);

  switch (url.pathname) {
    case '/history':
      return handleHistory(request, services);
    case '/message':
      return handleMessage(request, services);
    // ...
  }
}
```

### 4. Cloudflare-Specific APIs

```typescript
// platforms/cloudflare/src/background.ts

// Using waitUntil for fire-and-forget background work
export function scheduleBackgroundWork(
  ctx: ExecutionContext,
  work: Promise<void>
): void {
  ctx.waitUntil(work);
}
```

---

## The Wiring Pattern

Platform code **wires packages together**:

```typescript
// platforms/cloudflare/src/handlers/message.ts

import { logHistory } from '@persistence/db';
import { sendTelegram } from '@persistence/services';
import { validateAction } from '@persistence/tools';

export async function handleIncomingMessage(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json();

  // 1. Validate (package)
  const validation = validateAction(body);
  if (!validation.valid) {
    return new Response(validation.error, { status: 400 });
  }

  // 2. Log to DB (package, with binding from env)
  await logHistory(env.DB, {
    type: 'user_message',
    content: body.content,
  });

  // 3. Notify via Telegram (package, with token from env)
  await sendTelegram(
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_CHAT_ID,
    `The user said: ${body.content}`
  );

  return new Response('OK');
}
```

---

## Dependency Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Platform Layer (Cloudflare)                      │
│                                                                     │
│  • Has access to env.* (bindings, secrets)                          │
│  • Handles HTTP requests and cron triggers                          │
│  • Wires packages together with dependencies                        │
│  • Uses waitUntil() for background work                             │
│                                                                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                      passes dependencies down
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Package Layer (@persistence/*)                    │
│                                                                     │
│  • Pure functions that take dependencies as parameters              │
│  • NO access to env.* directly                                      │
│  • Could run in Node, Deno, Bun, tests, etc.                        │
│  • Testable in isolation                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns

### DON'T: Access env in packages

```typescript
// BAD - in packages/services/telegram/client.ts
export class TelegramService {
  private token = process.env.TELEGRAM_BOT_TOKEN; // NO!
}

// GOOD
export class TelegramService {
  constructor(private config: { token: string }) {}
}
```

### DON'T: Import Cloudflare types in packages

```typescript
// BAD - in packages/tools/handler.ts
import type { ExecutionContext } from '@cloudflare/workers-types'; // NO!

// GOOD - use generic types or define your own
interface ToolContext {
  db: D1Database;  // D1Database is fine - it's a type, not a runtime dep
  env: Record<string, string>;
}
```

### DON'T: Hardcode Cloudflare-specific behavior

```typescript
// BAD - in packages/db/history.ts
export async function logHistory(entry: HistoryEntry) {
  const db = getD1Binding();  // Where does this come from? NO!
}

// GOOD
export async function logHistory(db: D1Database, entry: HistoryEntry) {
  // db is passed in - could be real D1 or a mock
}
```

---

## Migration Path

When moving code from platform to packages:

1. **Identify dependencies** - What env vars does it need?
2. **Make them parameters** - Function takes them as args
3. **Extract to package** - Move the code
4. **Update platform** - Wire the dependency in
5. **Test** - Verify it still works

Example:

```typescript
// BEFORE (in platform)
async function sendDiscordNotification(message: string) {
  const webhookUrl = env.DISCORD_WEBHOOK;  // Direct env access
  await fetch(webhookUrl, { ... });
}

// AFTER (in package)
// packages/services/discord/webhook.ts
export async function sendDiscordWebhook(
  webhookUrl: string,  // Now a parameter
  message: string
) {
  await fetch(webhookUrl, { ... });
}

// AFTER (platform wiring)
// platforms/cloudflare/src/notifications.ts
import { sendDiscordWebhook } from '@persistence/services';

await sendDiscordWebhook(env.DISCORD_WEBHOOK, message);
```

---

## When to Keep Code in Platform

Some things genuinely belong in the platform:

1. **Entry points** - `fetch()`, `scheduled()` handlers
2. **Request routing** - URL → handler mapping
3. **Response formatting** - Building HTTP responses
4. **Cloudflare-specific features** - `waitUntil()`, Durable Objects, etc.
5. **Environment setup** - Extracting and validating env vars

**Rule of thumb:** If it's about "how Cloudflare works", keep it in platform. If it's about "what the app does", put it in packages.
