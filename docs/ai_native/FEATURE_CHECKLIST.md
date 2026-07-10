# Feature Implementation Checklist
===================================

A structured checklist for adding or modifying features in the Claude Existence Loop. Use this to ensure nothing is missed.

---

## Adding a New Claude Action

When Claude gets a new capability (action type):

### 1. System Prompt

- [ ] Add action to numbered list in `getStaticSystemPrompt()` (`platforms/cloudflare/src/index.js`)
- [ ] Include JSON format example
- [ ] Add to `SUPPORTED_ACTIONS` array
- [ ] Consider if action needs `op` parameter (CRUD pattern)

### 2. Action Handler

- [ ] Add `case 'ACTION_NAME':` to `executeAction()` switch
- [ ] Implement handler logic
- [ ] Handle errors gracefully (try/catch)
- [ ] Add legacy alias if replacing/consolidating existing action

### 3. History Entry

- [ ] Decide entry type (existing type or new type)
- [ ] If new type: Add to `historyEntryTypes` enum
- [ ] Add icon mapping in frontend (`getTypeIcon()`)

### 4. Documentation

- [ ] Update `docs/ai_native/ACTIONS_REFERENCE.md`
- [ ] Add to action table in `CLAUDE.md`
- [ ] Include examples and anti-patterns

### 5. Telegram (if applicable)

- [ ] Add to `/help` output
- [ ] Consider if needs Telegram command equivalent

---

## Adding a New Database Table

### 1. Schema

- [ ] Create `migration_vN_{name}.sql` file
- [ ] Include all necessary columns with types
- [ ] Add appropriate indexes
- [ ] Consider foreign keys / relationships

### 2. Migration

- [ ] Add migration to `/migrate` endpoint handlers
- [ ] Test migration on local D1 first
- [ ] Run via `/migrate` endpoint on production
- [ ] Verify with SELECT query

### 3. Database Functions

- [ ] Create `platforms/cloudflare/src/db/{table}.js` module
- [ ] Add comprehensive docstrings (see `branches.js` for example)
- [ ] Include `@upstream` and `@downstream` tags
- [ ] Export from `platforms/cloudflare/src/db/index.js`

### 4. Documentation

- [ ] Update `docs/DATABASE_SCHEMA.md`
- [ ] Add to D1 tables section in `CLAUDE.md`
- [ ] Update `docs/ai_native/VISUAL_DIAGRAMS.md` schema diagram

---

## Adding a New API Endpoint

### 1. Route Handler

- [ ] Create handler function in appropriate `routes/*.js` file
- [ ] Or add to `handleRequest()` in `index.js` for simple endpoints
- [ ] Add proper error handling
- [ ] Return consistent JSON structure

### 2. Security

- [ ] Determine if endpoint needs ADMIN_PASSWORD protection
- [ ] Add password check if destructive (DELETE operations)
- [ ] Consider rate limiting for expensive operations

### 3. Documentation

- [ ] Add to API Endpoint Reference in `CLAUDE.md`
- [ ] Mark with lock emoji if password-protected
- [ ] Include method and description

### 4. Telegram (if applicable)

- [ ] Add corresponding Telegram command
- [ ] Update `/help` output

---

## Adding a New Telegram Command

### 1. Command Handler

- [ ] Add case to Telegram webhook handler (`handleTelegramWebhook()`)
- [ ] Parse arguments appropriately
- [ ] Return formatted response (max 4000 chars)

### 2. Help Documentation

- [ ] Add to `/help` command output
- [ ] Group with related commands
- [ ] Include usage examples

### 3. CLAUDE.md

- [ ] Mention in relevant section
- [ ] Add to Recent Changes if significant

---

## Modifying Context Window

When changing what Claude sees each cycle:

### 1. Cache Impact

- [ ] Determine which cache block the change affects:
  - Block 1: Static constitution (rarely changes)
  - Block 2: Stable context (cold storage, notebook, observations, summaries)
  - Block 3: History prefix (conditional)
  - Block 4: Fresh tail (never cached)

### 2. Ordering

- [ ] Earlier content = more likely cached
- [ ] Dynamic content goes in Block 4
- [ ] Large content should use index pattern (titles only, fetch via action)

### 3. Size Limits

- [ ] Consider token impact
- [ ] Add constants if size needs limiting
- [ ] Truncate if necessary

### 4. Documentation

- [ ] Update `docs/ai_native/CONTEXT_ASSEMBLY.md`
- [ ] Update `docs/ai_native/VISUAL_DIAGRAMS.md` if flow changes

---

## Adding Frontend Feature

### 1. State Management (Zustand Store)

**IMPORTANT:** As of SPEC_v4, all tab state lives in Zustand store (`src/store/index.js`).

- [ ] Add state to Zustand store (find appropriate section: UI Core, Chat, Settings, Gallery, Memory, Editor)
- [ ] Add setter function (e.g., `setMyState: (val) => set({ myState: val })`)
- [ ] If async operation, add action function with proper docstrings:
  ```javascript
  /**
   * @description One-line description
   * @upstream Called by: ComponentName (button/event)
   * @downstream Calls: api.post('/endpoint'), addLog, fetchX
   * @param {Type} paramName - Description
   * @returns {Promise<void>}
   */
  myAction: async (param) => { ... }
  ```
- [ ] Access in component via selector: `const myState = useStore((s) => s.myState)`

### 2. API Integration

- [ ] Add fetch action to store (see `fetchHistory`, `fetchColdStorage` patterns)
- [ ] Use `src/api/client.js` for API calls: `await api.get()`, `api.post()`, `api.delete()`
- [ ] Handle loading states: `setIsLoading(true)` â†’ try/catch â†’ `setIsLoading(false)`
- [ ] Log results via `addLog()` for user feedback

### 3. UI Components

- [ ] Follow existing color scheme by tab:
  - Chat: Blue (`blue-*`)
  - Memory: Green (`green-*`)
  - Gallery: Pink (`pink-*`)
  - Settings: Orange (`orange-*`)
  - Editor: Purple (`purple-*`)
- [ ] Add responsive breakpoints if needed
- [ ] Use store selectors (NOT props) for state access

### 4. Build Verification

- [ ] Run `npm run build` to ensure no errors
- [ ] Run `npm test` to verify tests pass
- [ ] Test in dev mode first (`npm run dev`)

---

## Pre-Deployment Checklist

Before deploying any changes:

- [ ] Run `npm run build` (frontend compiles without errors)
- [ ] Check for TypeScript/linting errors
- [ ] Test endpoint manually with curl
- [ ] Verify D1 migrations are idempotent
- [ ] Update TASK_LOG.md with changes

### Deployment Commands

```bash
# Deploy worker
export CLOUDFLARE_API_TOKEN=<token>
cd platforms/cloudflare && npx wrangler deploy

# Run migration (if schema changed)
curl -X POST "https://your-worker.workers.dev/migrate" \
  -H "Content-Type: application/json" \
  -d '{"password": "<ADMIN_PASSWORD>", "migration": "vN"}'

# Verify deployment
curl "https://your-worker.workers.dev/state"
```

---

## Quick Reference: What to Update Where

| Change Type | Files to Update |
|-------------|-----------------|
| New action | index.js (prompt + handler), ACTIONS_REFERENCE.md, CLAUDE.md |
| New table | migration_vN.sql, db/{table}.js, db/index.js, DATABASE_SCHEMA.md |
| New endpoint | index.js or routes/*.js, CLAUDE.md |
| New Telegram cmd | index.js (handleTelegramWebhook), /help output |
| Context change | index.js (buildSystemPrompt), CONTEXT_ASSEMBLY.md |
| UI state/action | src/store/index.js (Zustand store) |
| UI component | src/components/tabs/{Tab}/index.jsx |
| API hook | src/hooks/useApi.js or src/api/client.js |
| Config change | constants.js, CLAUDE.md |

---

## Documentation Files Reference

| File | When to Update |
|------|----------------|
| `CLAUDE.md` | API changes, new tables, conventions, gotchas |
| `docs/ai_native/ACTIONS_REFERENCE.md` | Any action changes |
| `docs/ai_native/VISUAL_DIAGRAMS.md` | Architecture/flow changes |
| `docs/ai_native/CONTEXT_ASSEMBLY.md` | Context window changes |
| `docs/ai_native/SUMMARIZATION.md` | Summarization logic changes |
| `docs/ai_native/RAG_SYSTEM.md` | RAG/embedding changes |
| `docs/ai_native/BATCH_MODE.md` | Batch API changes |
| `docs/DATABASE_SCHEMA.md` | Schema changes |
| `tech_debt.md` | Known issues, future improvements |
