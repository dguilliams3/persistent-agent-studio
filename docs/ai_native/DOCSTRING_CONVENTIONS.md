# Docstring Conventions
========================

Standards for documenting code in the Claude Existence Loop project.
Optimized for AI/LLM context with copy-paste ready templates.

**Last Updated:** 2026-01-12

---

## Quick Reference
------------------

| Tag | Required? | Purpose |
|-----|-----------|---------|
| `@description` | ✅ Yes | One-line summary + optional detail paragraph |
| `@upstream Called by:` | ✅ Yes | What functions/modules call this |
| `@downstream Calls:` | ✅ Yes | What this function depends on |
| `@param {Type}` | ✅ Yes | Parameter with type annotation |
| `@returns {Type}` | ✅ Yes | Return value with type |
| `@tests` | ✅ Yes* | Test files covering this function (*when tests exist) |
| `@example` | Optional | Usage example (strongly encouraged) |
| `@note` | Optional | Important caveats or gotchas |
| `@antipattern` | Optional | Document common mistakes with WHY they fail |

---

## Module-Level Docstrings
--------------------------

Every file should start with a module docstring explaining:
1. What the module does
2. Key concepts/tables it works with
3. How it fits in the system (`@upstream`/`@downstream`)

### Template

```javascript
/**
 * [Brief description of module purpose]
 *
 * @module [path/name]
 * @description [Longer explanation of what this module does]
 *
 * [Key concepts, tables, or domain knowledge needed to understand this code]
 *
 * @upstream Called by:
 *   - [caller1.js] - [why it calls this module]
 *   - [caller2.js] - [why it calls this module]
 * @downstream Calls:
 *   - [dependency1] - [what we use it for]
 *   - D1 database queries
 */
```

### Example: Database Module Pattern

**Note:** This is an illustrative example showing how to document a database module. The actual branch management code is in `platforms/cloudflare/src/index.js`.

```javascript
/**
 * Memory branch management database functions
 *
 * @module db/branches
 * @description Database operations for the memory branching system.
 *
 * The branching system enables NON-DESTRUCTIVE memory manipulation:
 * - Canonical history remains immutable (the "main" branch)
 * - Other branches can exclude, edit, or reorder memories
 * - Synthetic memories can be inserted that don't exist in canonical history
 *
 * Key tables:
 * - `memory_branches`: Named configurations (main, experimental-v1, etc.)
 * - `memory_overrides`: Per-branch exclusions/edits/reorderings
 * - `synthetic_memories`: New memories that only exist in a branch
 *
 * Only ONE branch can be active at a time (is_active = 1).
 * The 'main' branch shows unmodified canonical history.
 *
 * @upstream Called by:
 *   - routes/branches.js - API endpoints for branch management
 *   - buildSystemPrompt() - to assemble context respecting active branch
 * @downstream Calls:
 *   - D1 database queries
 */
```

---

## Function-Level Docstrings
----------------------------

Every exported function needs comprehensive documentation.

### Template

```javascript
/**
 * @description [One-line description of what it does]
 *
 * [Detailed explanation if needed - when to use, edge cases, etc.]
 *
 * @upstream Called by: [function names that call this]
 * @downstream Calls: [functions this relies on]
 *
 * @param {Type} name - Description
 * @returns {Type} Description
 *
 * @example
 * const result = myFunction('input');
 * // Returns: { success: true }
 *
 * @note [Important caveat if any]
 */
```

### Example: Database Function Pattern

**Note:** This is an illustrative example showing how to document a database function.

```javascript
/**
 * @description Get the currently active branch
 *
 * There is always exactly one active branch (defaults to 'main').
 * The active branch determines how context is assembled for Claude.
 *
 * @upstream Called by: assembleContext(), routes/branches.js
 * @downstream Calls: D1 query
 *
 * @param {D1Database} db - Database instance
 * @returns {Promise<Object|null>} Active branch object or null
 */
export async function getActiveBranch(db) {
  return await db.prepare(`
    SELECT id, name, description, parent_branch, is_active, created_at, updated_at
    FROM memory_branches
    WHERE is_active = 1
    LIMIT 1
  `).first();
}
```

### Real Example with @example: utils/time.js

```javascript
/**
 * @description Converts a date to Eastern timezone
 *
 * This is useful for consistent timestamp display regardless of where
 * the Cloudflare Worker is executing (edge locations worldwide).
 *
 * @param {Date} [date=new Date()] - The date to convert, defaults to current date/time
 * @returns {Date} A new Date object representing the time in Eastern timezone
 * @example
 * const easternNow = toEastern();
 * const easternSpecific = toEastern(new Date('2025-01-15T12:00:00Z'));
 */
export function toEastern(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}
```

---

## Barrel File Documentation
----------------------------

Barrel files (`index.js` that re-export from other modules) need **verbose section comments** explaining WHAT each module IS, not just listing exports.

### Real Example: db/index.js

```javascript
/**
 * Database operations barrel file
 *
 * @module db
 * @description Centralized exports for all D1 database operations.
 *
 * Re-exports all database functions from individual modules for convenient importing:
 *   import { getState, setState, getHistory, addHistory } from './db/index.js';
 *
 * Or import from specific modules for clarity:
 *   import { getState, setState } from './db/state.js';
 *
 * @upstream Called by:
 *   - index.js (main worker) - imports all database functions
 *   - All HTTP route handlers
 */

// =============================================================================
// STATE TABLE
// =============================================================================
// The `state` table is a simple key-value store for runtime configuration.
// It persists settings like loop_count, is_running, cycle_interval_seconds,
// user_status, batch_enabled, etc. Think of it as the "control panel" that
// survives worker restarts and lets the UI/Telegram toggle behaviors.
//
// @upstream: getState/setState called by cron trigger, UI routes, Telegram commands
// @downstream: Direct D1 queries only
// =============================================================================
export { getState, setState } from './state.js';

// =============================================================================
// HISTORY TABLE
// =============================================================================
// The `history` table is the chronological conversation timeline - every thought,
// message, search, art generation, etc. gets recorded here. This is Claude's
// "stream of consciousness" and forms the core context for each thinking cycle.
// ...
// =============================================================================
export {
  getHistory,
  addHistory,
  // ...
} from './history.js';
```

**Key principle:** Someone reading just the barrel file should understand WHAT each module does without opening it.

---

## @tests Tag and Test Synchronization
--------------------------------------

The `@tests` tag creates **bidirectional traceability** between source code and tests. This ensures tests stay synchronized as code evolves.

### Why This Matters

When you change a function:
1. The `@tests` tag tells you WHICH tests to check
2. You can validate if behavior changes require test updates
3. Prevents silent breakage where tests pass but don't cover new behavior

### Source Code: @tests Tag

Add `@tests` to every function that has test coverage:

```javascript
/**
 * @description Execute an API call with automatic state management
 *
 * @upstream Called by: Component event handlers
 * @downstream Calls: The provided apiCall function
 *
 * @tests src/hooks/__tests__/useApi.test.js
 *   - "execute - successful request" (loading states, data setting)
 *   - "execute - failed request" (error capture, null return)
 *
 * @param {Function} apiCall - Async function that makes the API request
 * @returns {Promise<any|null>} Response data on success, null on error
 */
```

### Test Files: @covers Tag

Conversely, test files should document which source functions they cover:

```javascript
/**
 * @module tests/hooks/useApi
 * @description Unit tests for useApi and useApiMutation hooks
 *
 * @covers src/hooks/useApi.js
 *   - useApi() - execute, loading, error, data, clearError, reset
 *   - useApiMutation() - mutate with callbacks
 *
 * When useApi.js changes, validate these test groups:
 * - "execute - successful request" - loading state transitions, data persistence
 * - "execute - failed request" - error capture, null return behavior
 * - "clearError" / "reset" - state clearing behavior
 */
```

### Workflow: Updating Tests When Code Changes

When you modify a function with a `@tests` tag:

1. **Read the @tests tag** to identify relevant test file(s)
2. **Review the listed test groups** to understand what's covered
3. **Determine if changes affect tested behavior:**
   - New parameters? → Add parameter validation tests
   - Changed return type? → Update return value assertions
   - New error cases? → Add error handling tests
   - Removed functionality? → Remove or update obsolete tests
4. **Run the specific tests** to verify they still pass:
   ```bash
   npm test -- --grep "useApi"
   ```
5. **Update test docstring @covers** if new behavior added

### Real Example: Adding a Feature to useApi

If you add a `retry` option to `useApi.execute()`:

```javascript
// BEFORE: Original function
const execute = useCallback(async (apiCall) => { ... });

// AFTER: With retry option
const execute = useCallback(async (apiCall, { retry = 0 } = {}) => { ... });
```

The `@tests` tag guides you:

1. Check `src/hooks/__tests__/useApi.test.js`
2. Find "execute - successful request" and "execute - failed request" groups
3. Add new tests for retry behavior:
   ```javascript
   describe('execute - with retry', () => {
     it('should retry failed requests up to retry count', ...);
     it('should not retry on success', ...);
   });
   ```
4. Update the `@tests` tag in source:
   ```javascript
   * @tests src/hooks/__tests__/useApi.test.js
   *   - "execute - successful request"
   *   - "execute - failed request"
   *   - "execute - with retry" (NEW)
   ```

### Format Guidelines

**In source files (`@tests`):**
```javascript
* @tests path/to/test/file.test.js
*   - "describe block name" (what aspects it tests)
*   - "another describe block" (other aspects)
```

**In test files (`@covers`):**
```javascript
* @covers path/to/source/file.js
*   - functionName() - specific behaviors tested
*   - anotherFunction() - its behaviors
```

---

## @antipattern Documentation
-----------------------------

Use `@antipattern` to document **real failure modes** you've encountered. Always include:
1. The WRONG code
2. WHY it fails
3. The CORRECT approach

### When to Use

- D1/SQLite gotchas (null vs undefined, LIKE pattern limits)
- API timeout issues (Telegram webhooks)
- Memory/performance traps (spread operator on large arrays)
- Logic errors that look correct but aren't

### Real Example: utils/image.js

```javascript
/**
 * @description Converts a Uint8Array to base64 string
 *
 * @param {Uint8Array} bytes - The byte array to convert
 * @returns {string} Base64 encoded string
 *
 * @example
 * const buffer = await response.arrayBuffer();
 * const base64 = bytesToBase64(new Uint8Array(buffer));
 *
 * @antipattern
 * // WRONG - spread operator causes stack overflow on large arrays (>~100KB)
 * const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
 * // This fails because Function.prototype.apply has argument limit
 */
```

### Real Example: db/state.js

```javascript
/**
 * @description Set a value in state table
 *
 * @param {D1Database} db - D1 database binding
 * @param {string} key - State key
 * @param {any} value - Value to store (will be JSON stringified)
 *
 * @example
 * await setState(db, 'is_running', true);
 * await setState(db, 'sleep_until', null); // Clear sleep timer
 *
 * @note D1 accepts null but NOT undefined - this function coalesces undefined to null
 * @antipattern Don't pass undefined directly - always use ?? null pattern
 */
```

### Real Example: db/history.js

```javascript
/**
 * @description Add entry to unified history timeline
 *
 * @example
 * // User sends a message
 * await addHistory(db, 'user_message', 'Hello Claude!', null, cycleId);
 *
 * // Claude makes art (AI-originated)
 * await addHistory(db, 'art_result', imageBase64, 'Generated: a mountain landscape');
 *
 * @antipattern
 * // WRONG: Using art_result for the user's /image command
 * await addHistory(db, 'art_result', img, prompt); // Makes Claude think IT made this art
 */
```

### Real Example: index.js (Telegram timeouts)

```javascript
/**
 * @description Handles incoming Telegram webhook updates
 *
 * @antipattern TELEGRAM_WEBHOOK_TIMEOUT (applies to all long-running commands)
 * Telegram webhooks timeout after ~60 seconds. If handler doesn't return in time,
 * Telegram RETRIES the webhook, causing duplicate command executions.
 *
 * Solution: Use ctx.waitUntil() for long operations, return 200 immediately.
 */
```

---

## Common Mistakes
------------------

### BAD: Vague @upstream/@downstream

```javascript
// WRONG
@upstream Called by: various places
@downstream Calls: database

// CORRECT
@upstream Called by: routes/branches.js handleGetBranches, assembleContext()
@downstream Calls: D1 query (SELECT from memory_branches)
```

### BAD: Missing Type Annotations

```javascript
// WRONG
@param db - The database
@returns The result

// CORRECT
@param {D1Database} db - Database instance
@returns {Promise<Array<Object>>} Array of branch objects
```

### BAD: @antipattern Without Explanation

```javascript
// WRONG
@antipattern Don't do X

// CORRECT
@antipattern
// WRONG: [actual bad code]
badCode(); // [WHY this fails - be specific]
// CORRECT: [the fix]
```

---

## Checklist
------------

When reviewing docstrings:

- [ ] Every function has `@description` with one-line summary
- [ ] `@upstream Called by:` lists actual callers (function names, not vague descriptions)
- [ ] `@downstream Calls:` lists functions/APIs called (or "D1 query" for direct DB access)
- [ ] `@param` and `@returns` are present with types: `@param {Type} name - Description`
- [ ] `@tests` lists test file(s) and describe blocks covering this function (when tests exist)
- [ ] Barrel files (index.js) have verbose block comments explaining WHAT each module IS
- [ ] `@example` included for non-obvious functions (see `utils/time.js` for good examples)
- [ ] `@note` for important caveats (e.g., D1 null coalescing warning)
- [ ] `@antipattern` for documented gotchas - describe the wrong approach AND why it fails

When modifying tested code:

- [ ] Check `@tests` tag to identify which tests cover this function
- [ ] Review listed test groups to understand current coverage
- [ ] Determine if changes require test updates (new params, changed returns, new errors)
- [ ] Run affected tests: `npm test -- --grep "functionName"`
- [ ] Update `@tests` tag if new test groups added

---

## Exemplar Files
-----------------

Reference these files for well-documented code:

| File | What It Demonstrates |
|------|---------------------|
| `platforms/cloudflare/src/db/index.js` | Verbose barrel file section comments |
| `platforms/cloudflare/src/utils/time.js` | @example usage on every function |
| `platforms/cloudflare/src/utils/index.js` | formatContextStats() - shared utility function |
| `platforms/cloudflare/src/utils/history-logger.js` | logHistory() - standardized logging interface |
| `platforms/cloudflare/src/utils/image.js` | @antipattern with real failure mode |
| `platforms/cloudflare/src/index.js` | Main worker - comprehensive function docs |
| `apps/web/hooks/useApi.js` | @tests tag with test file reference |
| `apps/web/api/client.js` | @tests tag with describe block list |
| `apps/web/hooks/__tests__/useApi.test.js` | @covers tag with source reference |

**Note:** Database operations like history and state are primarily in `platforms/cloudflare/src/index.js` rather than separate db/* files.

