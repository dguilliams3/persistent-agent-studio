# Search Capability

> **Single Entry Point for Web Search** — All web search operations MUST go through `SearchGateway`.

## Quick Start

```typescript
import { SearchGateway } from '@persistence/services/search';

const gateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);
const result = await gateway.search('latest AI news 2026');

if (result.success) {
  console.log(result.summary);
  console.log(result.metadata); // { provider, model, tool, durationMs, query }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CONSUMERS                                │
│  (post-processors, digest, /web-search endpoint, SEARCH action) │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SearchGateway                               │
│  • Single entry point (Facade pattern)                          │
│  • Returns results with metadata for logging                    │
│  • Handles timing measurement                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ClaudeSearchProvider                           │
│  • Low-level Anthropic API wrapper                              │
│  • Uses web_search_20250305 tool via beta header                │
│  • Extracts summary from model response                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Anthropic API                                 │
│  • anthropic-beta: web-search-2025-03-05                        │
│  • Model: claude-sonnet-5                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `gateway.ts` | **USE THIS** — SearchGateway facade, single entry point |
| `brave.ts` | ClaudeSearchProvider — low-level API wrapper |
| `types.ts` | TypeScript interfaces |
| `index.ts` | Barrel exports |
| `gateway.test.ts` | Unit tests (23 tests) |
| `gateway.integration.test.ts` | Real API integration tests |

---

## DO's and DON'Ts for LLM Coding Agents

### ✅ DO

1. **Use SearchGateway for ALL search operations**
   ```typescript
   // CORRECT
   const gateway = SearchGateway.fromCredentials(apiKey);
   const result = await gateway.search(query);
   ```

2. **Log metadata when storing search results**
   ```typescript
   await logHistory({
     db,
     type: 'search_result',
     content: result.summary,
     metadata: result.metadata  // Contains provider, model, durationMs, etc.
   });
   ```

3. **Check success before accessing summary**
   ```typescript
   if (result.success) {
     // Safe to access result.summary
   } else {
     // Handle result.error
   }
   ```

4. **Import from the barrel export**
   ```typescript
   import { SearchGateway } from '@persistence/services/search';
   // OR
   import { SearchGateway } from '@persistence/services';
   ```

### ❌ DON'T

1. **DON'T call ClaudeSearchProvider directly**
   ```typescript
   // WRONG - bypasses metadata tracking
   const provider = ClaudeSearchProvider.fromCredentials(apiKey);
   const result = await provider.search(query);
   ```

2. **DON'T create new search entry points**
   - No new `doWebSearch()` functions
   - No direct Anthropic API calls for search
   - All search MUST flow through SearchGateway

3. **DON'T modify the Anthropic API call structure without updating tests**
   - The `anthropic-beta: web-search-2025-03-05` header is required
   - The tool configuration in `brave.ts` must match Anthropic's spec

4. **DON'T forget error handling**
   ```typescript
   // WRONG - assumes success
   const summary = (await gateway.search(query)).summary;

   // CORRECT
   const result = await gateway.search(query);
   if (!result.success) {
     // Handle error
   }
   ```

5. **DON'T use searchSimple() for new code**
   ```typescript
   // Avoid - exists only for backwards compatibility
   const { result, error } = await gateway.searchSimple(query);

   // Prefer - gives you metadata
   const result = await gateway.search(query);
   ```

---

## Metadata Schema

Every search operation returns metadata for tracking:

```typescript
interface SearchMetadata {
  provider: 'anthropic';           // Always 'anthropic' currently
  model: string;                   // e.g., 'claude-sonnet-5'
  tool: string;                    // e.g., 'web_search_20250305'
  durationMs: number;              // Time taken in milliseconds
  query: string;                   // Original search query
}
```

This metadata is stored in the `history.metadata` column (JSON) for analytics and debugging.

---

## Integration Points

| Consumer | Location | How It Uses SearchGateway |
|----------|----------|---------------------------|
| SEARCH action | `platforms/.../tools/post-processors.js` | `searchPostProcessor()` |
| DIGEST action | `packages/services/src/web-agent/index.ts` | `runDigest()` |
| `/web-search` endpoint | `platforms/.../routes/search.js` | Direct API access |

---

## Testing

```bash
# Unit tests (mocked)
pnpm test --filter @persistence/services -- gateway.test.ts

# Integration tests (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-... pnpm test --filter @persistence/services -- gateway.integration.test.ts
```

---

## Why This Pattern?

1. **DRY** — One place for search logic, not scattered across codebase
2. **Metadata** — Every search is tracked with timing, model, and query info
3. **Testable** — Gateway can be mocked; provider handles API complexity
4. **Extensible** — Easy to add new providers (e.g., Brave direct) without changing consumers

---

## History

- **2026-02-03**: Created SearchGateway, consolidated from scattered `doWebSearch()` calls
- **Previous**: `doWebSearch()` in `platform-helpers.js` (now deleted)
