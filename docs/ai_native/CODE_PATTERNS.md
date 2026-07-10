# Code Patterns - Claude Existence Loop
========================================

Implementation patterns and examples for extending the system.
Optimized for AI/LLM context with copy-paste ready code.

## Table of Contents
--------------------

1. [Adding a New Action](#adding-a-new-action)
2. [Adding an API Endpoint](#adding-an-api-endpoint)
3. [Database Operations](#database-operations)
4. [Image Handling](#image-handling)
5. [Notification Patterns](#notification-patterns)
6. [Content-Based Detection Pattern](#content-based-detection-pattern)
7. [Service Integration Layers](#service-integration-layers)
8. [Provider Abstraction Patterns](#provider-abstraction-patterns)
9. [Data-Driven Action Formatters](#data-driven-action-formatters)
10. [Unified Configuration System](#unified-configuration-system)

---

## Adding a New Action
----------------------

### Step 1: Define in System Prompt

Location: `platforms/cloudflare/src/index.js` → `MY_CONTEXT` or system prompt section

```javascript
// Add to the action list in the system prompt
AVAILABLE ACTIONS:
...existing actions...
- MY_NEW_ACTION: Description of what it does
```

### Step 2: Add Action Handler

Location: `platforms/cloudflare/src/index.js` → action handling switch/if block

```javascript
// Pattern: Action handler with proper history logging
if (action === 'MY_NEW_ACTION') {
  const content = item.content || '';
  const internal = item.internal || '';

  // 1. Perform the action logic
  const result = await doSomething(content, env);

    // 2. Log to history (choose appropriate type)
    await logHistory({ db, type: 'my_action_type', content, internal });

  // 3. Optionally notify the user
  if (item.shareToUser) {
    await sendNotifications(env, `New action: ${content}`);
  }

  // 4. Return result for logging
  results.push({ action, success: true, result });
}
```

### Step 3: Add History Type (if needed)

Location: `src/ClaudeExistenceLoop.jsx` → `getHistoryIcon` and `getHistoryLabel`

```javascript
// In getHistoryIcon:
const icons = {
  ...existing,
  my_action_type: '🔮'
};

// In getHistoryLabel:
const labels = {
  ...existing,
  my_action_type: 'My Action'
};
```

---

## Adding an API Endpoint
-------------------------

### Basic GET Endpoint

```javascript
// Pattern: Simple data retrieval
if (path === '/my-endpoint' && request.method === 'GET') {
  const db = env.DB;

  // Query data
  const { results } = await db.prepare(
    'SELECT * FROM my_table ORDER BY created_at DESC LIMIT 100'
  ).all();

  return Response.json(results, { headers: corsHeaders });
}
```

### POST Endpoint with Validation

```javascript
// Pattern: Create/update with input validation
if (path === '/my-endpoint' && request.method === 'POST') {
  const { field1, field2 } = await request.json();

  // Validate required fields
  if (!field1) {
    return Response.json(
      { error: 'field1 is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const db = env.DB;
  const now = new Date().toISOString();

  try {
    await db.prepare(
      'INSERT INTO my_table (field1, field2, created_at) VALUES (?, ?, ?)'
    ).bind(field1, field2 || null, now).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (e) {
    console.error('my-endpoint failed:', e);
    return Response.json(
      { error: e.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
```

### DELETE Endpoint

```javascript
// Pattern: Delete with ID parameter
if (path.startsWith('/my-endpoint/') && request.method === 'DELETE') {
  const id = path.split('/').pop();

  if (!id || isNaN(id)) {
    return Response.json(
      { error: 'Valid ID required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const db = env.DB;
  await db.prepare('DELETE FROM my_table WHERE id = ?').bind(id).run();

  return Response.json({ success: true, deleted: id }, { headers: corsHeaders });
}
```

---

## Database Operations
----------------------

### Helper: logHistory (DRY Standardized Logging)

**📍 IMPORTANT:** Use `logHistory()` instead of direct `addHistory()` calls for all new code.

```javascript
import { logHistory } from '../utils/index.js';

/**
 * Standardized history logging with validation and error handling
 * @param {Object} params - Logging parameters
 * @param {D1Database} params.db - D1 database binding
 * @param {string} params.type - Entry type (HISTORY_TYPES enum value)
 * @param {string} params.content - Main content (visible)
 * @param {string} [params.internal] - Internal reasoning (private)
 * @param {string|number} [params.cycleId] - Cycle identifier (optional)
 * @param {boolean} [params.silent] - Suppress errors for non-critical logging
 */
await logHistory({
  db,
  type: 'thought',
  content: 'I am thinking',
  internal: 'internal reasoning',
  cycleId: 123
});

// Batch logging
await logHistory.logHistoryBatch({
  db,
  cycleId: 123,
  entries: [
    { type: 'thought', content: 'Step 1' },
    { type: 'search_query', content: 'query terms' }
  ]
});
```

**Benefits:**
- Type validation against HISTORY_TYPES enum
- Consistent error handling
- Optional silent mode for non-critical entries
- Batch logging support
- Comprehensive JSDoc documentation

### Querying with Filters

```javascript
// Pattern: Query non-summarized history entries
const { results: history } = await db.prepare(`
  SELECT * FROM history
  WHERE summarized_at IS NULL
  ORDER BY created_at DESC
  LIMIT 100
`).all();
```

### Upsert Pattern (Insert or Update)

```javascript
// Pattern: Insert or update by unique key
async function upsertByTitle(db, table, title, content) {
  const existing = await db.prepare(
    `SELECT id FROM ${table} WHERE title = ?`
  ).bind(title).first();

  const now = new Date().toISOString();

  if (existing) {
    await db.prepare(
      `UPDATE ${table} SET content = ?, updated_at = ? WHERE id = ?`
    ).bind(content, now, existing.id).run();
    return { updated: true, id: existing.id };
  } else {
    const result = await db.prepare(
      `INSERT INTO ${table} (title, content, created_at) VALUES (?, ?, ?)`
    ).bind(title, content, now).run();
    return { created: true, id: result.meta.last_row_id };
  }
}
```

---

## Image Handling
-----------------

### Compression (Server-side)

```javascript
import UPNG from 'upng-js';
import jpeg from 'jpeg-js';

/**
 * Compress PNG to JPEG with resize
 * @param {string} pngBase64 - Base64 PNG (with or without data URI prefix)
 * @param {number} maxDimension - Max width/height (default 768)
 * @param {number} quality - JPEG quality 1-100 (default 80)
 * @returns {Object} { base64, originalSizeKB, compressedSizeKB, error? }
 */
function compressPngToJpeg(pngBase64, maxDimension = 768, quality = 80) {
  try {
    // Strip data URI prefix if present
    const base64Data = pngBase64.replace(/^data:image\/\w+;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');
    const originalSizeKB = Math.round(pngBuffer.length / 1024);

    // Decode PNG
    const png = UPNG.decode(pngBuffer);
    const frames = UPNG.toRGBA8(png);
    const rgbaData = new Uint8Array(frames[0]);

    // Calculate scale
    let scale = 1;
    if (png.width > maxDimension || png.height > maxDimension) {
      scale = maxDimension / Math.max(png.width, png.height);
    }

    const outputWidth = Math.round(png.width * scale);
    const outputHeight = Math.round(png.height * scale);

    // Resize if needed (nearest neighbor)
    let outputData;
    if (scale < 1) {
      outputData = Buffer.alloc(outputWidth * outputHeight * 4);
      for (let y = 0; y < outputHeight; y++) {
        for (let x = 0; x < outputWidth; x++) {
          const srcX = Math.floor(x / scale);
          const srcY = Math.floor(y / scale);
          const srcIdx = (srcY * png.width + srcX) * 4;
          const dstIdx = (y * outputWidth + x) * 4;
          outputData[dstIdx] = rgbaData[srcIdx];
          outputData[dstIdx + 1] = rgbaData[srcIdx + 1];
          outputData[dstIdx + 2] = rgbaData[srcIdx + 2];
          outputData[dstIdx + 3] = 255;
        }
      }
    } else {
      outputData = Buffer.from(rgbaData);
    }

    // Encode as JPEG
    const jpegBuffer = jpeg.encode({
      data: outputData,
      width: outputWidth,
      height: outputHeight
    }, quality);

    const compressedBase64 = `data:image/jpeg;base64,${jpegBuffer.data.toString('base64')}`;

    return {
      base64: compressedBase64,
      originalSizeKB,
      compressedSizeKB: Math.round(jpegBuffer.data.length / 1024)
    };
  } catch (e) {
    return { base64: pngBase64, error: e.message };
  }
}
```

### Image Generation Routing

```javascript
/**
 * Generate image with automatic routing
 * - Default: Cloudflare AI (filtered)
 * - REPLICATE: prefix: Replicate API (uncensored)
 */
async function generateImage(prompt, env) {
  // Check for Replicate routing
  const replicateMatch = prompt.match(/^REPLICATE:\s*(.+)$/i);

  if (replicateMatch) {
    const actualPrompt = replicateMatch[1].trim();
    if (!env.REPLICATE_API_TOKEN) {
      return { success: false, error: 'Replicate not configured' };
    }
    return await generateImageReplicate(actualPrompt, env.REPLICATE_API_TOKEN);
  }

  // Default: Cloudflare AI
  return await generateImageCloudflare(prompt, env);
}
```

### Binary Data Conversion (ArrayBuffer → Base64)

**@antipattern SPREAD_LARGE_ARRAYS**

```javascript
// ❌ WRONG: Spreads millions of bytes as function arguments
const bytes = new Uint8Array(arrayBuffer);
const base64 = btoa(String.fromCharCode(...bytes));
// 💥 "Maximum call stack size exceeded" for files >100KB
// JavaScript spread pushes each element as a function argument
// Call stack limit is ~65K args, but 1MB = 1 million args
```

**@pattern CHUNKED_BINARY_CONVERSION**

```javascript
// ✅ CORRECT: Process in chunks to stay within call stack limits
const bytes = new Uint8Array(arrayBuffer);
let binary = '';
const chunkSize = 32768; // 32KB chunks - safe for call stack
for (let i = 0; i < bytes.length; i += chunkSize) {
  const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
  binary += String.fromCharCode.apply(null, chunk);
}
const base64 = btoa(binary);
```

**Why 32KB?** JavaScript call stack typically handles ~65K args safely. 32KB gives 2x safety margin while keeping loop iterations reasonable (~250 iterations for 8MB file).

**When this matters:**
- R2 storage retrieval (GIFs, images can be 8MB+)
- File uploads converted to base64
- Any ArrayBuffer → string conversion at scale

---

## Notification Patterns
------------------------

### Send to Both Discord and Telegram

```javascript
/**
 * Send notification to all configured channels
 */
async function sendNotifications(env, message, imageBase64 = null) {
  const promises = [];

  // Discord
  if (env.DISCORD_WEBHOOK) {
    promises.push(sendDiscord(env.DISCORD_WEBHOOK, message, imageBase64));
  }

  // Telegram
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    promises.push(sendTelegram(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      message,
      imageBase64
    ));
  }

  await Promise.allSettled(promises);
}
```

### Discord Webhook

```javascript
async function sendDiscord(webhookUrl, message, imageBase64 = null) {
  const payload = { content: message };

  if (imageBase64) {
    // Convert to file upload
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    // ... multipart form handling
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

### Telegram Message

```javascript
async function sendTelegram(botToken, chatId, message, imageBase64 = null) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  if (imageBase64) {
    // Send photo
    const imageBuffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([imageBuffer]), 'image.jpg');
    formData.append('caption', message);

    await fetch(`${baseUrl}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
  } else {
    // Send text
    await fetch(`${baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  }
}
```

---

## Frontend Patterns
--------------------

### Fetching State

```javascript
// Pattern: Polling with error handling
useEffect(() => {
  const fetchState = async () => {
    try {
      const response = await fetch(`${WORKER_URL}/state`);
      const data = await response.json();
      setHistory(data.history || []);
      setColdStorage(data.coldStorage || []);
      // ... etc
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  };

  fetchState();
  const interval = setInterval(fetchState, 5000);
  return () => clearInterval(interval);
}, []);
```

### Calling Worker API

```javascript
// Pattern: POST with JSON body
const triggerThink = async () => {
  setIsThinking(true);
  try {
    const response = await fetch(`${WORKER_URL}/think-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    // Handle success
  } catch (err) {
    console.error('Think failed:', err);
  } finally {
    setIsThinking(false);
  }
};
```

---

## Content-Based Detection Pattern
-----------------------------------

When formatting history entries for text output, detect problematic content by its **actual value** rather than entry type. This prevents failures when new types are added.

### The Problem

History entries store images as base64 in the `content` field (260K+ characters each). Type-based switch statements miss new types, causing catastrophic failures:

```javascript
// ANTIPATTERN: Type-based detection (fragile)
switch (h.type) {
  case 'art_result': return 'Art created';      // OK
  case 'user_art': return 'Art created';        // Added after bug report
  // case 'auto_art': ???                       // FORGOTTEN - causes failure!
  default: return h.content;                    // Dumps 260K base64 into prompt
}
```

When `auto_art` (or any new image type) is added, the default case dumps the entire base64 image into the output, causing:
- **API failures**: 215K tokens > 200K limit
- **Huge exports**: 260K chars per image
- **Unreadable logs**: Base64 spam

### The Solution

Check content characteristics **before** the type-specific switch:

```javascript
// CORRECT: Content-based detection first
const isBase64Image = h.content?.startsWith('data:image');
if (isBase64Image) {
  // Use internal (prompt), not content (base64 data)
  return `Art created: "${h.internal || 'unknown prompt'}"`;
}

// Then fall through to type-specific formatting for normal content
switch (h.type) {
  case 'user_message': return `User: "${h.content}"`;
  case 'thought': return `Thought: ${h.content}`;
  // ... other types
  default: return `${h.type}: ${h.content}`;  // Safe - no base64 reaches here
}
```

### When to Use This Pattern

| Context | Why |
|---------|-----|
| Summarization prompts | Token limits are strict (200K max) |
| Export/backup formatting | File sizes matter |
| Log output | Readability matters |
| Any text serialization | Base64 is never human-readable |

### Detection Methods

| Content Type | Detection | Use Instead |
|--------------|-----------|-------------|
| Base64 images | `content?.startsWith('data:image')` | `h.internal` (prompt) |
| Large JSON | `content?.startsWith('{') && content.length > 10000` | Summary or `[large object]` |
| Binary data | Non-printable characters | `[binary data]` |

### Antipatterns

| Don't Do This | Why It Fails |
|---------------|--------------|
| Add each image type to switch | Will be forgotten when new types added |
| `type.includes('art')` | Brittle, misses edge cases like `chart_data` |
| Trust naming conventions | New devs won't know them |
| Skip check "because all types handled" | New types get added constantly |

### Real-World Example

**Bug**: Summarization failing with "prompt is too long: 215055 tokens > 200000 maximum"

**Root cause**: `user_art` type (added 2026-01-09) wasn't in the switch statement. Four 260K-char base64 images hit the default case.

**Fix**: Content-based detection catches ALL image types automatically:

```javascript
// platforms/cloudflare/src/index.js - summarizeHistory()
const isBase64Image = h.content?.startsWith('data:image');
if (isBase64Image) {
  return `${idTag} [${timeStr}] Art created: "${h.internal || 'unknown prompt'}"`;
}
```

**Result**: Works for `art_result`, `user_art`, and any future image types without code changes.

### Implementation Checklist

When adding history text formatting:

- [ ] Add base64 detection BEFORE the switch statement
- [ ] Use `h.internal` for image entries (contains prompt)
- [ ] Consider other large content types (JSON, logs, etc.)
- [ ] Test with existing image entries in history
- [ ] Document the pattern for future maintainers

---

## Web Search with SearchGateway
---------------------------------

SearchGateway is the single entry point for all web search operations. It wraps the low-level ClaudeSearchProvider and adds metadata tracking for logging and debugging.

### Pattern: Using SearchGateway

```typescript
// ALWAYS use SearchGateway for web search - DO NOT call ClaudeSearchProvider directly
import { SearchGateway } from '@persistence/services/search';

async function performSearch(query: string, env: Env, db: D1Database) {
  // Create gateway from API key
  const search = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);

  // Perform search with metadata
  const result = await search.search(query);

  // result.metadata contains: { provider, model, tool, durationMs, query }
  if (result.success) {
    // Log with metadata for tracking
    await logHistory({
      db,
      type: 'search_result',
      content: result.summary,
      internal: `Provider: ${result.metadata.provider} | Duration: ${result.metadata.durationMs}ms | Model: ${result.metadata.model}`
    });
    return result.summary;
  } else {
    // Log error
    await logHistory({
      db,
      type: 'search_error',
      content: `Search failed: ${result.error}`,
      internal: `Query: "${query}"`
    });
    return null;
  }
}
```

### Backwards Compatibility with doWebSearch()

If migrating from the old `doWebSearch()` function, use `searchSimple()`:

```typescript
// OLD WAY (DEPRECATED)
const result = await doWebSearch(query, env);
if (result.error) {
  // handle error
}

// NEW WAY (PREFERRED)
const search = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);
const result = await search.searchSimple(query);
if (result.error) {
  // handle error
} else {
  // result.result contains the summary
}
```

### When to Use SearchGateway vs ClaudeSearchProvider

| Scenario | Use |
|----------|-----|
| New web search code | `SearchGateway.search()` |
| Need metadata for logging | `SearchGateway.search()` |
| Migrating from doWebSearch() | `SearchGateway.searchSimple()` |
| Low-level API access only | `ClaudeSearchProvider` (rare) |

---

## Service Integration Layers
----------------------------

Integration layers provide a unified interface for related services, enabling DRY principles and provider abstraction. Use this pattern when working with multiple providers or complex service interactions.

### Pattern: Response Normalization Integration

**Location:** `services/response-normalizer-integration.js`

**Purpose:** Provides consistent interface across all AI providers while maintaining backward compatibility.

```javascript
// Integration layer structure
import { callLLM as originalCallLLM } from './llm.js';
import { normalizeLLMResponse } from './response-normalizer.js';

// Enhanced version with normalization
export async function callLLMNormalized(opts, env) {
  const rawResponse = await originalCallLLM(opts, env);
  return normalizeLLMResponse(rawResponse, opts.provider, opts);
}

// Primary interface - returns normalized results
export async function callLLM(opts, env) {
  return await callLLMNormalized(opts, env);
}
```

**Benefits:**
- **Provider Agnostic:** Same interface works for Anthropic, OpenAI, Local, etc.
- **Consistent Errors:** All providers return normalized error format
- **Future-Proof:** Adding new providers requires no changes to calling code
- **Honest Code:** No hidden abstractions or compatibility layers

**When to Use:**
- Multiple providers with different response formats
- Need consistent error handling across services
- Want to add providers without changing calling code
- Complex service interactions requiring normalization

### Implementation Checklist

When creating an integration layer:

- [ ] Create dedicated integration file (e.g., `*-integration.js`)
- [ ] Import original functions with `as original*` naming
- [ ] Create enhanced versions with normalization
- [ ] Export normalized versions as the primary interface (no compatibility wrappers)
- [ ] Add utility functions for context creation
- [ ] Document as the **ONLY approved way** to access the service
- [ ] Code Is Context: Make the interface honest about what it returns

---

## Provider Abstraction Patterns
-------------------------------

Abstract away provider-specific logic to enable easy switching and consistent behavior.

### Pattern: Configuration-Driven Behavior

**Problem:** Provider-specific code scattered throughout the codebase.

```javascript
// ANTIPATTERN: Scattered conditionals
if (provider === 'anthropic') {
  content = response.content[0].text;
  error = response.error?.message;
} else if (provider === 'openai') {
  content = response.choices[0].message.content;
  error = response.error?.message;
}
```

**Solution:** Configuration defines behavior.

```javascript
// Configuration-driven approach
const PROVIDER_CONFIGS = {
  anthropic: {
    extractContent: (response) => response.content[0].text,
    normalizeError: (error) => ({ message: error?.message })
  },
  openai: {
    extractContent: (response) => response.choices[0].message.content,
    normalizeError: (error) => ({ message: error?.message })
  }
};

// Usage
const config = PROVIDER_CONFIGS[provider];
const content = config.extractContent(response);
const normalizedError = config.normalizeError(error);
```

### Pattern: Factory Functions for Providers

**Use Case:** Creating provider-specific instances with shared interface.

```javascript
// Factory pattern for provider instances
function createLLMClient(provider, config) {
  const baseConfig = PROVIDER_CONFIGS[provider];

  return {
    async call(prompt, options = {}) {
      const rawResponse = await callProviderAPI(provider, config, prompt, options);
      return baseConfig.extractContent(rawResponse);
    },

    async stream(prompt, onChunk) {
      // Provider-specific streaming logic
    }
  };
}

// Usage
const anthropicClient = createLLMClient('anthropic', { apiKey: '...' });
const openaiClient = createLLMClient('openai', { apiKey: '...' });

// Same interface for both
const result1 = await anthropicClient.call('Hello');
const result2 = await openaiClient.call('Hello');
```

### Pattern: Feature Detection and Graceful Degradation

**Use Case:** Handle provider differences gracefully.

```javascript
// Feature detection pattern
const PROVIDER_CAPABILITIES = {
  anthropic: { supportsStreaming: true, maxTokens: 200000 },
  openai: { supportsStreaming: true, maxTokens: 128000 },
  local: { supportsStreaming: false, maxTokens: 4096 }
};

function getOptimalProvider(taskRequirements) {
  const capableProviders = Object.entries(PROVIDER_CAPABILITIES)
    .filter(([_, caps]) =>
      caps.maxTokens >= taskRequirements.minTokens &&
      caps.supportsStreaming === taskRequirements.needsStreaming
    )
    .map(([provider]) => provider);

  // Return best available or fallback
  return capableProviders[0] || 'anthropic';
}
```

### Implementation Checklist

When implementing provider abstraction:

- [ ] Define provider capabilities in configuration object
- [ ] Create extraction/normalization functions per provider
- [ ] Implement feature detection for optional capabilities
- [ ] Provide fallback strategies for missing features
- [ ] Test with all supported providers
- [ ] Document provider-specific quirks and limitations
- [ ] Include migration path from provider-specific code

### Real-World Example: Image Generation Routing

```javascript
// Provider abstraction in action
async function generateImage(prompt, env) {
  // Feature detection based on prompt prefixes
  const provider = prompt.startsWith('REPLICATE:') ? 'replicate' :
                   prompt.startsWith('SDXL:') ? 'replicate' : 'cloudflare';

  // Abstract away provider differences
  const client = createImageClient(provider, env);
  const cleanPrompt = prompt.replace(/^[A-Z]+:\s*/, '');

  return await client.generate(cleanPrompt);
}
```

---

## Data-Driven Action Formatters
---------------------------------

Eliminate repetitive switch statements for action descriptions by using data-driven formatters.

### Pattern: Action Formatters Object

**Location:** `platforms/cloudflare/src/index.js` → Replace large switch statements

**Before (Repetitive):**
```javascript
switch (action.action) {
  case 'ART': {
    const op = action.op || 'make';
    if (op === 'make') {
      content = action.prompt ? `🎨 Creating: "${action.prompt.substring(0, 60)}..."` : content;
    } else if (op === 'share') {
      content = `🎭 Sharing image #${action.image_id}`;
    }
    break;
  }
  // 80+ more lines...
}
```

**After (Data-Driven):**
```javascript
const actionFormatters = {
  ART: ({ op, prompt, image_id }) =>
    op === 'make'
      ? `🎨 Creating: "${prompt?.substring(0, 60)}..."`
      : `🎭 Sharing image #${image_id}`,

  LEARNED: ({ op = 'add', content: actionContent, id }) => {
    switch (op) {
      case 'add': return `📚 Adding: "${actionContent?.substring(0, 50)}..."`;
      case 'update': return `✏️ Updating entry #${id}`;
      case 'cite': return `📖 Citing entry #${id}`;
      case 'promote': return `⭐ Promoting entry #${id}`;
      case 'delete': return `🗑 Removing entry #${id}`;
      case 'list': return `📋 Reviewing learned entries`;
      default: return content;
    }
  }
  // All other actions...
};

// Apply formatter
content = actionFormatters[action.action]?.(action) || content;
```

**Benefits:**
- **60% less code** - Switch statements become compact objects
- **Maintainable** - Easy to add new actions or modify formatting
- **Consistent** - All actions follow same formatting pattern
- **Type-safe** - Destructured parameters prevent typos

### When to Use This Pattern

| Context | Why |
|---------|-----|
| Action descriptions | Replace 50+ line switch statements |
| Status messages | Standardize formatting across UI/Telegram |
| Error messages | Consistent error reporting |
| Log formatting | Uniform log entry structure |

### Implementation Checklist

When converting switch to data-driven:

- [ ] Create `actionFormatters` object near the switch
- [ ] Extract each case into a function that receives destructured action
- [ ] Handle default cases with `|| content` fallback
- [ ] Test with all action variants (different ops, parameters)
- [ ] Update any code that expects specific formatting

---

## Unified Configuration System
-------------------------------

Consolidate scattered CONFIG objects into a structured, validated system with base interfaces.

### Pattern: Configuration Builders

**Location:** `platforms/cloudflare/src/config/index.js`

**Structure:**
```javascript
// Base interfaces for common patterns
export function createTokenConfig({ maxTokens, defaultTokens, minTokens });
export function createSizeConfig({ maxSize, defaultSize, minSize });
export function createThresholdConfig({ threshold, target, minValue });

// Specialized configurations built on base interfaces
export const SUMMARIZE_CONFIG = {
  entries: createSizeConfig({ maxSize: 100, minSize: 10 }),
  tokens: createTokenConfig({ maxTokens: 4000 })
};

export const BATCH_SUMMARIZE_CONFIG = {
  batch: createSizeConfig({ defaultSize: 50, maxSize: 60, minSize: 15 }),
  summaries: createSizeConfig({ maxSize: 2, minSize: 8 }),
  tokens: createTokenConfig({ maxTokens: 8000 })
};
```

### Pattern: Legacy Compatibility

**Maintain backward compatibility** while migrating to unified system:

```javascript
// platforms/cloudflare/src/constants.js
import { SUMMARIZE_CONFIG, BATCH_SUMMARIZE_CONFIG } from './config/index.js';

// Re-export for backward compatibility
export { SUMMARIZE_CONFIG } from './config/index.js';

// Legacy flattened exports (DEPRECATED - use structured configs)
export const minSummarizeCount = SUMMARIZE_CONFIG.entries.minSize;
export const maxSummarizeCount = SUMMARIZE_CONFIG.entries.maxSize;
```

### Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Validation** | None | Runtime validation with helpful errors |
| **Type Safety** | Any object | Structured interfaces |
| **Extensibility** | Manual additions | Base interfaces for new configs |
| **Maintenance** | Scattered updates | Single source of truth |
| **Testing** | Manual validation | Automated validation |

### When to Use This Pattern

| Context | Why |
|---------|-----|
| Multiple similar configs | Consolidate SUMMARIZE_CONFIG, BATCH_SUMMARIZE_CONFIG |
| Token/size limits | Standardize max/min/default patterns |
| Threshold values | Consistent threshold/target/min patterns |
| Provider settings | Abstract provider-specific configurations |

### Implementation Checklist

When creating unified configuration:

- [ ] Identify common patterns (tokens, sizes, thresholds)
- [ ] Create base builder functions with validation
- [ ] Convert existing configs to use builders
- [ ] Maintain backward compatibility with re-exports
- [ ] Add `validateConfigs()` function for startup validation
- [ ] Update imports throughout codebase
- [ ] Test all config-dependent functionality

---

## Practical Usage Guide: When to Use These Utilities

### **🔴 MUST USE: History Logging (All History Operations)**

**Use `logHistory()` for ALL history recording - NEVER use `addHistory()` directly:**

#### **Message & Communication Logging**
```javascript
// ✅ WHEN: User sends message via /message endpoint
await logHistory({ db, type: 'user_message', content: message, internal: imageData });

// ✅ WHEN: Claude sends message to user
await logHistory({ db, type: 'message_to_user', content: response, cycleId });

// ✅ WHEN: Voice message transcription
await logHistory({ db, type: 'user_message', content: text, internal: `[voice: ${duration}s]` });
```

#### **Action & Event Logging**
```javascript
// ✅ WHEN: Claude performs any action (art, search, notes, etc.)
await logHistory({ db, type: 'art_result', content: imageBase64, internal: `Generated: ${prompt}`, cycleId });

// ✅ WHEN: System operations (summarization, cleanup, etc.)
await logHistory({ db, type: 'thought', content: 'Auto-consolidated summaries', internal: 'Buffer system maintenance', cycleId });
```

#### **Search & External Operations**
```javascript
// ✅ WHEN: User searches via /search endpoint
await logHistory({ db, type: 'search_query', content: query, internal: 'Manual search injection' });

// ✅ WHEN: Search results are retrieved
await logHistory({ db, type: 'search_result', content: results, internal: `Results for: ${query}` });
```

#### **Batch Operations**
```javascript
// ✅ WHEN: Multiple related events (art generation with variations)
const entries = variations.map((img, i) =>
  ({ type: 'art_result', content: img, internal: `Variation ${i+1}: ${prompt}` })
);
await logHistory.logHistoryBatch({ db, cycleId, entries });
```

#### **Error & System Logging**
```javascript
// ✅ WHEN: Operations fail and need to be logged
await logHistory({ db, type: 'parse_error', content: `Failed: ${error.message}`, internal: rawResponse, cycleId });

// ✅ WHEN: Silent logging for non-critical events
await logHistory({ db, type: 'thought', content: 'Cache miss handled', cycleId, silent: true });
```

### **🟡 REQUIRED: Context Statistics Formatting**

**Use `formatContextStats()` for ALL context information display:**

#### **API Endpoints**
```javascript
// ✅ WHEN: /context endpoint returns context stats
export async function handleContext(db, env) {
  const result = await buildSystemPrompt(db, env);
  const stats = formatContextStats(result);
  return Response.json({ context: result.systemPrompt, stats });
}

// ✅ WHEN: /export endpoint includes stats
export async function handleExport(db, env) {
  const result = await buildSystemPrompt(db, env);
  const stats = formatContextStats(result);
  // Include stats in export response
}
```

#### **Telegram Commands**
```javascript
// ✅ WHEN: /context command shows stats
const result = await buildSystemPrompt(db, env);
const stats = formatContextStats(result);
await sendTelegram(chatId, stats, env);
```

### **🟢 RECOMMENDED: Structured Configuration Access**

**Use structured configs instead of flattened constants:**

#### **Summarization Settings**
```javascript
// ✅ WHEN: Accessing summarization limits
import { SUMMARIZE_CONFIG } from './config/index.js';

const maxEntries = SUMMARIZE_CONFIG.entries.maxSize;      // 100
const maxTokens = SUMMARIZE_CONFIG.tokens.maxTokens;      // 4000
```

#### **Batch Processing Configuration**
```javascript
// ✅ WHEN: Configuring batch operations
import { BATCH_SUMMARIZE_CONFIG } from './config/index.js';

const defaultBatch = BATCH_SUMMARIZE_CONFIG.batch.defaultSize;  // 50
const maxSummaries = BATCH_SUMMARIZE_CONFIG.summaries.maxSize;  // 2
```

#### **Token Management**
```javascript
// ✅ WHEN: Token threshold operations
import { HISTORY_TOKEN_CONFIG } from './config/index.js';

const threshold = HISTORY_TOKEN_CONFIG.tail.threshold;    // 12000
const target = HISTORY_TOKEN_CONFIG.tail.target;          // 6000
```

### **🔵 OPTIONAL: Data-Driven Action Formatters**

**Use when converting repetitive switch statements:**

#### **Action Description Generation**
```javascript
// ✅ WHEN: Converting action objects to display strings
const actionFormatters = {
  ART: ({ op, prompt, image_id }) =>
    op === 'make' ? `🎨 Creating: "${prompt?.substring(0, 60)}..."` : `🎭 Sharing image #${image_id}`,

  SEARCH: ({ query }) => query ? `🔎 "${query}"` : '🔎 Searching...',

  LEARNED: ({ op, content, id }) => {
    switch (op) {
      case 'add': return `📚 Adding: "${content?.substring(0, 50)}..."`;
      case 'update': return `✏️ Updating entry #${id}`;
      default: return `📖 Learned: ${content}`;
    }
  }
};

// Usage
const description = actionFormatters[action.action]?.(action) || 'Processing...';
```

#### **Status Message Formatting**
```javascript
// ✅ WHEN: Consistent status messages across UI
const statusFormatters = {
  running: () => '🟢 System active',
  paused: ({ reason }) => `⏸️ Paused: ${reason || 'Manual pause'}`,
  error: ({ message }) => `🔴 Error: ${message}`
};
```

### **🟡 SHOULD USE: Context Statistics Formatting**

**Use `formatContextStats()` whenever displaying context information:**

```javascript
// ✅ WHEN: /context command response
const stats = formatContextStats(buildSystemPrompt(db, env));

// ✅ WHEN: /export command response
const stats = formatContextStats(buildSystemPrompt(db, env));

// ✅ WHEN: Any endpoint returning context information
return Response.json({ stats: formatContextStats(result) });

// ✅ WHEN: Displaying context stats in UI components
const contextStats = formatContextStats(contextResult);
```

### **🟢 RECOMMENDED: Data-Driven Action Formatters**

**Use data-driven formatters instead of switch statements when:**

```javascript
// ✅ WHEN: Converting switch statements with repetitive if/else chains
const actionFormatters = {
  ART: ({ op, prompt }) => op === 'make' ? `🎨 ${prompt}` : `🎭 Sharing`,
  // ... more actions
};

// ✅ WHEN: Action descriptions follow predictable patterns
content = actionFormatters[action.action]?.(action) || content;
```

### **🔵 CONFIGURATION: Structured Configs**

**Use structured configs instead of flattened constants when:**

```javascript
// ✅ WHEN: Accessing configuration values
const maxTokens = SUMMARIZE_CONFIG.tokens.maxTokens;
const batchSize = BATCH_SUMMARIZE_CONFIG.batch.defaultSize;

// ✅ WHEN: Configuration has related sub-settings
const threshold = HISTORY_TOKEN_CONFIG.tail.threshold;
```

### Real-World Example

**Before:** Scattered config objects
```javascript
export const SUMMARIZE_CONFIG = { minSummarizeCount: 10, maxSummarizeCount: 100, summaryMaxTokens: 4000 };
export const BATCH_SUMMARIZE_CONFIG = { defaultBatchSize: 50, maxBatchSize: 60, maxSummaries: 2, batchMaxTokens: 8000 };
```

**After:** Structured, validated configurations
```javascript
export const SUMMARIZE_CONFIG = {
  entries: createSizeConfig({ maxSize: 100, minSize: 10 }),
  tokens: createTokenConfig({ maxTokens: 4000 })
};

export const BATCH_SUMMARIZE_CONFIG = {
  batch: createSizeConfig({ defaultSize: 50, maxSize: 60, minSize: 15 }),
  summaries: createSizeConfig({ maxSize: 2, minSize: 8 }),
  tokens: createTokenConfig({ maxTokens: 8000 })
};
```

**Usage:**
```javascript
// Before: SUMMARIZE_CONFIG.minSummarizeCount
// After: SUMMARIZE_CONFIG.entries.minSize

// Validation happens automatically
validateConfigs(); // Throws on invalid configs
```

**Benefits:**
- **Easy Provider Switching:** Change provider without touching calling code
- **Consistent Interface:** Same method calls regardless of provider
- **Graceful Degradation:** Fallback to simpler providers if advanced ones fail
- **Feature Detection:** Automatically use best provider for the task

---

## Code Quality Checks
----------------------

### Code Duplication Detection (jscpd)

```bash
# Run duplication check
npx jscpd . \
  --ignore "node_modules/**,dist/**,.git/**,.wrangler/**,.venv/**,__pycache__/**,*.pyc,runs/**,docs/**"
```

**When to run:** Before major refactoring, when adding features, during code reviews.

### Data Consistency Checker

```bash
# Check for undefined variables after refactoring
node scripts/check-data-consistency.cjs
```

**Detects:** References to removed variables, deleted fetch functions, inconsistent state mixing.

**Exit codes:** `0` = clean, `1` = issues found.

### Searching with Exclusions

```bash
# ripgrep with standard exclusions
rg -n --hidden \
  -g '!node_modules/**' -g '!dist/**' -g '!.git/**' \
  -g '!.wrangler/**' -g '!.venv/**' -g '!__pycache__/**' \
  "pattern"
```

### Response Normalization

All LLM calls MUST go through the integration layer:

```javascript
// ✅ ONLY WAY
import { callLLM } from './services/response-normalizer-integration.js';

// ❌ FORBIDDEN
import { callLLM } from './services/llm.js';
```

### Avoiding Monolithic Files

**Extract when:**
- index.js > 1000 lines
- Multiple related functions in one file
- Shared logic used across routes

**Structure:**
```
platforms/cloudflare/src/
├── index.js           # Router + core loop only
├── services/          # Business logic
├── routes/            # API handlers
├── db/                # Database operations
└── utils/             # Shared utilities
```
