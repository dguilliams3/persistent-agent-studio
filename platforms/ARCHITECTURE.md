# platforms/ - Runtime Wrappers

**Status:** MIGRATION IN PROGRESS (as of 2026-01-27)

---

## The Goal

Platforms should be **thin wrappers** that:
1. Receive requests (HTTP, webhooks, cron)
2. Import logic from `packages/`
3. Execute side effects (DB, APIs)
4. Return responses

## The Reality (Current State)

```
platforms/cloudflare/src/
├── index.js          # ~5800 lines - THE MONOLITH (migration target)
├── routes/           # ~80 route handlers (already modular)
├── telegram/         # Command routing (partially migrated)
├── db/               # Some re-export from packages, some original
├── services/         # External API clients (Telegram, Discord, LLM)
└── utils/            # Cloudflare-specific helpers
```

**The honest truth:** `index.js` is still a god file. The "thin wrapper" goal is aspirational. We're migrating piece by piece.

---

## What's Actually Migrated

| Component | Status | Notes |
|-----------|--------|-------|
| `/help` command | Migrated | Uses `buildMainHelpMenu()` from package |
| Help registry | Migrated | 742 lines → 152 lines |
| Command definitions | Migrated | Now in @persistence/services/src/messaging/telegram (no @persistence/telegram package) |
| History logging | Migrated | Uses `@persistence/db` |
| Tool schemas | Available | `@persistence/tools` exists, not wired |
| Think cycle | NOT migrated | Still in index.js (~900 lines) |
| Context builder | NOT migrated | Still in index.js (~1000 lines) |
| Route handlers | Already modular | routes/registry.js handles 80+ routes |

---

## Import Patterns (What Actually Works)

### Wrangler Workaround (REQUIRED)

Wrangler's esbuild doesn't resolve pnpm workspace aliases:

```javascript
// WON'T WORK - no such package (old fiction)
import { buildMainHelpMenu } from 'OLD_FICTION_PACKAGE';

// WORKS - actual location
import { buildMainHelpMenu } from '@persistence/services/src/messaging/telegram/commands/help/menu';
// or relative from platform
import { buildMainHelpMenu } from '../../../../packages/services/src/messaging/telegram/commands/help/menu.ts';

// Note the .ts extension - wrangler bundles TypeScript directly
```

### Re-export Pattern (For Cleaner Imports)

Some db/ files re-export from packages:

```javascript
// platforms/cloudflare/src/db/cycles.js
export * from '../../../../packages/db/src/cycles.js';
```

This lets other platform code import from `./db/cycles.js` without the long path.

---

## Side Effects Live Here

These belong in platforms/, not packages/:

| Service | File | Purpose |
|---------|------|---------|
| Telegram API | `services/telegram.js` | sendTelegram(), sendPhoto() |
| Discord | `@persistence/services` | DiscordWebhookProvider (via package) |
| LLM calls | `services/llm.js` | callLLM() with Anthropic/OpenAI |
| Image gen | `services/media/images.js` | generateImage() |
| TTS | `services/tts.js` | textToSpeech() |
| Web search | `@persistence/services` | ClaudeSearchProvider (via package) |

---

## Cloudflare Bindings

Only available here, never in packages/:

```javascript
// env object from Cloudflare
env.DB              // D1Database - SQLite
env.AI              // Workers AI - image gen, embeddings
env.MEDIA_BUCKET    // R2 Bucket - media storage
env.ANTHROPIC_API_KEY
env.TELEGRAM_BOT_TOKEN
// etc.
```

---

## The Basin Pattern

Introduced for `/help` command (2026-01-27):

```
Package (the basin):           Platform (drains toward basin):
=====================          ===============================
buildMainHelpMenu(commands)    handleHelp(ctx) {
  → returns formatted string     const text = buildMainHelpMenu(ALL_COMMANDS);
  → no side effects              await sendTelegram(chatId, text, env);
  → pure function              }
```

**Key insight:** Package functions take credentials as PARAMETERS, never read from env.

---

## Migration Strategy: Strangler Fig

We're NOT rewriting from scratch. Instead:

1. Extract logic to packages (definitions, pure functions)
2. Platform imports from packages
3. Delete duplicated code from platform
4. Repeat until index.js is thin

**Current progress:** ~10% migrated. The big pieces (think cycle, context builder) are still in index.js.

---

## File Organization

```
platforms/cloudflare/
├── src/
│   ├── index.js              # Entry point + THE MONOLITH
│   ├── constants.js          # Cloudflare-specific constants
│   ├── config/               # Runtime configuration
│   ├── routes/               # HTTP route handlers (modular)
│   │   └── registry.js       # Route → handler mapping
│   ├── telegram/             # Bot webhook handling
│   │   ├── index.js          # routeCommand()
│   │   ├── registry.js       # Command → handler mapping
│   │   └── commands/         # Individual handlers
│   ├── db/                   # Database operations
│   │   ├── index.js          # Re-exports + originals
│   │   └── *.js              # Table-specific queries
│   ├── services/             # External API clients
│   │   ├── index.js          # Barrel export
│   │   └── *.js              # Per-service clients
│   └── utils/                # Helpers
├── wrangler.toml             # Cloudflare config
└── package.json
```

---

## Questions to Ask

1. **Is it a pure function?** → Extract to `packages/`
2. **Does it call external APIs?** → Keep in `services/`
3. **Is it already in a package?** → Import it, delete the duplicate
4. **Is it the think cycle / context builder?** → Leave in index.js for now
