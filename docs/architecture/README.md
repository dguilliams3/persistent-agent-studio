# Architecture Documentation

This directory contains vision documents that guide the system's architecture. These are not task-specific - they describe how things **should** be structured.

**Start here:** [`../ARCHITECTURE_MANIFESTO.md`](../ARCHITECTURE_MANIFESTO.md) - The north star for all architectural decisions.

## Documents

| Document | Purpose |
|----------|---------|
| [PACKAGE_STRUCTURE.md](./PACKAGE_STRUCTURE.md) | What packages exist and what goes in each |
| [ASYNC_JOB_PATTERN.md](./ASYNC_JOB_PATTERN.md) | How to handle async operations that span cycles |
| [SERVICE_LAYER.md](./SERVICE_LAYER.md) | How to add and structure external service integrations |
| [PLATFORM_VS_PACKAGE.md](./PLATFORM_VS_PACKAGE.md) | What's Cloudflare-specific vs portable |

## Quick Reference

### Package Responsibilities (10 packages)

```
@persistence/core      → Shared types, constants (no deps)
@persistence/db        → D1 database operations
@persistence/discord   → Discord integration and webhooks
@persistence/llm       → LLM API calls (Anthropic, OpenAI)
@persistence/memory    → Summarization, RAG, context building
@persistence/runtime   → Runtime utilities and environment
@persistence/services  → External APIs (Telegram, Discord, Replicate, etc.)
(telegram in services + platform) → no separate @persistence/telegram package
@persistence/tools     → Tool definitions, validation, handlers
@persistence/voice     → Voice/TTS functionality
```

### The Golden Rules

1. **Packages take dependencies as parameters** - No direct env access
2. **Services don't know about each other** - Telegram doesn't know about DB
3. **Platform wires packages together** - Extracts env, passes to packages
4. **Async jobs use the fire-and-forget pattern** - Don't block cycles

### Dependency Flow

```
platforms/cloudflare
        │
        ├── @persistence/tools
        (telegram logic in services/src/messaging/telegram + platform/cloudflare/src/telegram)
        ├── @persistence/memory
        ├── @persistence/voice
        │         │
        ├─────────┼── @persistence/db
        ├─────────┼── @persistence/llm
        ├─────────┼── @persistence/services
        ├─────────┼── @persistence/discord
        ├─────────┼── @persistence/runtime
        │         │
        └─────────┴── @persistence/core
```

## Related Documentation

- `docs/ai_native/` - How to work in this codebase (conventions, patterns)
- `CLAUDE.md` - Quick reference for AI agents
- `runs/` - Task-specific implementation logs
