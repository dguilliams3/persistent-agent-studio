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

### Package Responsibilities (10 packages, as shipped)

```
@persistence/core       → Shared types, constants (no deps)
@persistence/db         → D1 database operations (Drizzle-free raw D1)
@persistence/embedding  → Embedding providers (Workers AI)
@persistence/llm        → LLM API calls (Anthropic, OpenAI-compatible)
@persistence/media      → Media asset handling
@persistence/memory     → Summarization, RAG, SIM, context building
@persistence/runtime    → Thinking-cycle orchestrator, guards, cache TTL policy
@persistence/services   → External-service contracts (messaging interface — no
                          concrete channel adapter ships; TTS, image gen)
@persistence/tools      → Tool definitions, validation, handlers
@persistence/ui         → Shared UI primitives
```

### The Golden Rules

1. **Packages take dependencies as parameters** - No direct env access
2. **Services don't know about each other** - A channel adapter doesn't know about DB
3. **Platform wires packages together** - Extracts env, passes to packages
4. **Async jobs use the fire-and-forget pattern** - Don't block cycles

### Dependency Flow

```
platforms/cloudflare
        │
        ├── @persistence/tools
        ├── @persistence/memory
        ├── @persistence/runtime
        │         │
        ├─────────┼── @persistence/db
        ├─────────┼── @persistence/llm
        ├─────────┼── @persistence/embedding
        ├─────────┼── @persistence/services
        ├─────────┼── @persistence/media
        │         │
        └─────────┴── @persistence/core
```

## Related Documentation

- `docs/ai_native/` - How to work in this codebase (conventions, patterns)
- `docs/README.md` - Map of all documentation
- `packages/ARCHITECTURE.md` - Package-level architecture notes
