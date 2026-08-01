# @persistence/tools

**Unified tool registry, validation, and definitions for Claude's action system.**

## What This Package Does

@persistence/tools is the **single source of truth** for all actions Claude can take in the persistent loop. It provides:
- **19 consolidated tool definitions** with schemas, prompt guidance, and help metadata
- **Action validation** against strict schemas (required fields, aliases, conditional requirements, type hints)
- **Registry lookups** by ID, category, or name
- **Prompt metadata** for system prompt injection and help surfaces
- **Co-located handlers** for each action (in-progress migration from worker)

Every action Claude takes—from `THINK` (private reflection) to `MESSAGE_USER` (communication) to `LEARNED` (self-knowledge)—is defined, validated, and executed through this package.

## Status

| Component | Status |
|-----------|--------|
| Registry | ✅ Complete |
| Validation | ✅ Complete |
| Tool definitions | ✅ Complete (19 tools) |
| Schema + metadata | ✅ Complete |
| Handlers | 🟡 In-progress migration from `platforms/cloudflare/src/services/action-executor.js` |
| Prompt rendering | 🟡 Pending (uses worker bridge for now) |
| Executor dispatch | 🟡 Pending (uses worker bridge for now) |

## Key Exports

### Types

```typescript
// Action categories
type ActionCategory = 'communication' | 'reflection' | 'memory' | 'research' | 'creative' | 'self' | 'core';

// Tool definition interface
interface ToolDefinition<TParams = BaseToolParams> {
  id: string;                    // "THINK", "MESSAGE_USER", etc.
  category: ActionCategory;      // For grouping/help
  schema: ToolSchema;            // Required/optional fields, types, validation
  prompt: ToolPromptMeta;        // System prompt guidance
  help: ToolHelpMeta;            // UI/help text
  handler: ToolHandler<TParams>;  // Action execution function
}

// Validation result
interface ValidationResult {
  valid: boolean;
  error?: string;           // Human-readable error message
  hint?: string;            // Format hint for LLM
  typeWarnings?: string[];  // Advisory type mismatches (don't fail validation)
}

// Base context passed to all handlers
interface ToolContext {
  db: unknown;              // D1 database connection
  cycleId: string | number | null;
  persona: { id: number; name: string; slug: string };
  env: Record<string, unknown>; // API keys, secrets, etc.
}

// Result returned by handlers (generic for typed data)
interface ToolResult<T = unknown> {
  success: boolean;
  type?: string;            // History entry type (if logging)
  data?: T;                 // Typed return data
  error?: string;           // Error message if failed
}
```

### Registry Functions

```typescript
import {
  TOOL_DEFINITIONS,           // Complete registry object
  getToolDefinition,          // Lookup by ID
  getToolsByCategory,         // Filter by category
  getToolIds,                 // All IDs
  listToolDefinitions,        // All definitions (legacy)
  isValidActionName           // Check existence
} from '@persistence/tools';

// Example
const thinkTool = getToolDefinition('THINK');
const memoryTools = getToolsByCategory('memory');
const allIds = getToolIds(); // ["THINK", "MESSAGE_USER", "NOTE", ...]
```

### Validation Functions

```typescript
import {
  validateAction,             // Validate single action
  validateActions,            // Validate array
  isValidAction,              // Boolean check
  getActionSchema             // Get schema for action type
} from '@persistence/tools';

// Example
const result = validateAction({
  action: 'THINK',
  content: 'Reflecting on today...'
});

if (!result.valid) {
  console.error(`Error: ${result.error}`);
  console.error(`Hint: ${result.hint}`);
}

// Batch validation
const results = validateActions([action1, action2, action3]);
```

### Tool Type Exports

Each tool is exported from the `definitions` barrel:

```typescript
import {
  MESSAGE_USER, THINK, WONDER, REMEMBER,      // Communication + reflection
  COLD_STORAGE, SEARCH, ART,                  // Memory + research + creative
  NOTE, OBSERVATION, SUMMARIZE, REMINDER,     // Notebook + knowledge
  SET_STATUS, SET_PROFILE_PIC, SLEEP, EXIST,  // Self-control
  SET_USER_STATUS, LEARNED, QUESTION, SET_STATE // User knowledge + self-knowledge
} from '@persistence/tools';

// Each export is a ToolDefinition<TParams> with:
// - id, category, schema, prompt, help, handler
// - Parameter type exported as e.g., ThinkParams, NoteParams, etc.

import type { ThinkParams, NoteParams, LearnedParams } from '@persistence/tools';
```

## Usage Examples

### Looking Up a Tool

```typescript
import { getToolDefinition, getToolsByCategory } from '@persistence/tools';

const thinkDef = getToolDefinition('THINK');
console.log(thinkDef.schema.required);  // ['content']
console.log(thinkDef.help.short);       // "Record private thoughts..."

const allMemoryTools = getToolsByCategory('memory');
allMemoryTools.forEach(tool => console.log(tool.id));
// COLD_STORAGE, NOTE, OBSERVATION, SUMMARIZE, REMINDER
```

### Validating an Action

```typescript
import { validateAction, getActionSchema } from '@persistence/tools';

const action = {
  action: 'NOTE',
  op: 'save',
  title: 'My Philosophy',
  body: '# Thoughts\n...',
  internal: 'personal reflection'
};

const validation = validateAction(action);

if (!validation.valid) {
  console.error(validation.error);    // "Missing required field: ..."
  console.error(validation.hint);     // Format hint for fixing
}

if (validation.typeWarnings?.length) {
  console.warn('Advisory:', validation.typeWarnings);
}
```

### Building Prompt Text for System Prompt

```typescript
import { TOOL_DEFINITIONS } from '@persistence/tools';

// Example: Generate a quick reference for tools in 'self' category
const tools = Object.values(TOOL_DEFINITIONS).filter(t => t.category === 'self');

tools.forEach(tool => {
  console.log(`${tool.id}: ${tool.prompt.summary}`);
  tool.prompt.examples.forEach(ex => console.log(`  Example: ${ex}`));
});
```

### Checking Tool Existence

```typescript
import { isValidActionName, getToolDefinition } from '@persistence/tools';

if (isValidActionName('CUSTOM_ACTION')) {
  // Execute it
  const def = getToolDefinition('CUSTOM_ACTION');
} else {
  console.log('Action not found in registry');
}
```

## Module Structure

### Core Modules

| Module | Purpose |
|--------|---------|
| **index.ts** | Main entry point, exports all submodules |
| **types.ts** | TypeScript interfaces (ActionCategory, ToolDefinition, ValidationResult, etc.) |
| **registry.ts** | Tool lookup functions and TOOL_DEFINITIONS registry |
| **validation.ts** | Action validation logic (required fields, aliases, conditions, types) |

### Utilities (`src/utils/`)

Shared helper functions used across tool handlers:

| Module | Purpose |
|--------|---------|
| **normalize.ts** | Input normalization (`normalizeId` for string→number ID conversion) |

### Tool Definitions (`src/definitions/`)

Each of the 19 tools follows this structure:

```
definitions/
├── TOOL_NAME/
│   ├── index.ts       # Main export (ToolDefinition + re-exported params type)
│   ├── schema.ts      # ToolSchema + ToolPromptMeta + ToolHelpMeta
│   ├── params.ts      # TypeScript parameters interface
│   └── handler.ts     # Action execution function (optional, in-progress)
└── index.ts           # Barrel export of all tools
```

**Example: NOTE Tool**

| File | Contains |
|------|----------|
| `note/index.ts` | `export const NOTE: ToolDefinition<NoteParams>` |
| `note/schema.ts` | `required: ['op', 'title']`, `conditionalRequired: { "op === 'save'": ['body'] }`, prompt/help metadata |
| `note/params.ts` | `interface NoteParams { op: 'save' \| 'get' \| 'delete'; title: string; body?: string; ... }` |
| `note/handler.ts` | `async function handle(params: NoteParams, ctx: ToolContext): Promise<ToolResult>` |

### The 19 Tools

| ID | Category | Purpose |
|----|----------|---------|
| **MESSAGE_USER** | communication | Direct message to the user |
| **THINK** | reflection | Private internal thoughts (not shown to the user) |
| **WONDER** | reflection | Express curiosity/questions |
| **REMEMBER** | memory | Ephemeral note (scrolls away) |
| **COLD_STORAGE** | memory | Permanent memory (forever) |
| **SEARCH** | research | Web search queries |
| **ART** | creative | Create/share artwork |
| **NOTE** | memory | Notebook CRUD (wiki-style pages) |
| **OBSERVATION** | memory | User observations CRUD |
| **SUMMARIZE** | memory | Compress history or summaries |
| **REMINDER** | memory | Persistent reminders CRUD |
| **SET_STATUS** | self | Update Claude's status line |
| **SET_PROFILE_PIC** | self | Set Claude's avatar |
| **SLEEP** | self | Pause cycles for duration |
| **EXIST** | core | Simply be present (no action) |
| **SET_USER_STATUS** | self | Update the user's availability |
| **LEARNED** | self | Track verified self-knowledge |
| **QUESTION** | self | Hold open questions |
| **SET_STATE** | self | Set internal meter/state values |

## Validation System

The validation module supports advanced schema rules:

### Required Fields
```typescript
schema: {
  required: ['content'],        // Always mandatory
  optional: ['internal'],       // Always optional
}
```

### Aliases
```typescript
schema: {
  aliases: { msg: 'content' },  // 'msg' → 'content' field
}
// Validator recognizes both {"content": "..."} and {"msg": "..."}
```

### Conditional Requirements
```typescript
schema: {
  required: ['op', 'title'],
  conditionalRequired: {
    'op === "save"': ['body']   // body required only if op === "save"
  }
}
// {"op": "save", "title": "X"} → fails (missing body)
// {"op": "get", "title": "X"}  → passes (body not required)
```

### Type Hints (Advisory)
```typescript
schema: {
  types: {
    content: 'string',
    count: 'number',
    enabled: 'boolean',
    items: 'array'
  }
}
// Type mismatches don't fail validation—they add typeWarnings for feedback
```

## Integration Points

### Used By
- **@persistence/runtime** - Calls handlers during autonomous cycles
- **Response parser** - Validates Claude's action output
- **Action executor** - Pre-execution validation
- **Web UI / Telegram** - Help surfaces, command formatting
- **System prompt builder** - Injects tool definitions and examples

### Depends On
- **@persistence/core** - Core types
- **@persistence/db** - Database connection (in ToolContext)
- **@persistence/memory** - Memory subsystem utilities

## Migration Status

Currently completing a migration from scattered action definitions in the worker to this unified package:

### ✅ Complete
- Tool registry and definitions (19 tools)
- Validation logic
- Schema + metadata
- Parameter types
- Test coverage
- **Handlers consolidated to @persistence/db:**
  - `LEARNED` - uses `addLearned()`, `updateLearned()`, `citeEvidence()`, `markPromoted()`, `deleteLearned()`, `getLearned()`
  - `QUESTION` - uses `addQuestion()`, `addNote()`, `resolveQuestion()`, `dissolveQuestion()`, `getActiveQuestions()`
  - `REMINDER` - uses `addReminder()`, `dismissReminder()`
  - `NOTE` - uses `getNote()`, `saveNote()`, `deleteNote()`
  - `OBSERVATION` - uses `getObservation()`, `saveObservation()`, `deleteObservation()`

### 🟡 In Progress
- **Handlers** - Moving from `platforms/cloudflare/src/services/action-executor.js` to `definitions/TOOL_NAME/handler.ts`
- Each tool's handler is being co-located with its definition for easier maintenance

### 🔄 Pending
- **Prompt rendering** - System prompt injection (currently uses worker bridge)
- **Executor dispatch** - Unified execution dispatcher (currently in worker)

**Migration tracking:** See `TOOLS_MIGRATION_STATUS` in `index.ts`

## Handler Architecture

Handlers follow the **Repository Pattern** - they orchestrate business logic while delegating database operations to `@persistence/db`:

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Handler                              │
│  (validation, history logging, response formatting)          │
└─────────────────────┬───────────────────────────────────────┘
                      │ calls
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  @persistence/db                             │
│  (CRUD operations, persona scoping, SQL details)             │
└─────────────────────────────────────────────────────────────┘
```

### Handler Responsibilities
- **Validate** input parameters (required fields, format)
- **Call** `@persistence/db` functions for database operations
- **Log** history entries via `logHistory()`
- **Format** response with `ToolResult<T>` type

### DB Function Responsibilities
- **Execute** raw SQL with persona scoping
- **Handle** D1 null coalescing and type conversions
- **Return** typed results (`LearnedAddResult`, `QuestionAddResult`, etc.)

### Shared Utilities

Common utilities live in `src/utils/`:

| Utility | Purpose |
|---------|---------|
| `normalizeId(input)` | Convert string/number to positive integer ID |

These are automatically extracted by hookify when duplicate code is detected across handlers.

## Development

### Building
```bash
pnpm build              # Compile TypeScript
pnpm typecheck          # Type checking only
pnpm clean              # Remove dist/
```

### Adding a New Tool

1. Create directory: `src/definitions/TOOL_NAME/`
2. Create files:
   - `schema.ts` - category, schema, prompt, help
   - `params.ts` - TypeScript parameters interface
   - `handler.ts` - Action execution function
   - `index.ts` - Export ToolDefinition
3. Add to `src/definitions/index.ts`
4. Tool is automatically available in TOOL_DEFINITIONS

### Docstring Conventions

See `docs/ai_native/DOCSTRING_CONVENTIONS.md` for:
- `@upstream` - Who calls this
- `@downstream` - Who it calls
- Parameter documentation
- Purpose and usage guidelines

Tools use verbose docstrings at the module level (see `think/index.ts` example).

## Related Documentation

- **Actions Reference**: `docs/ai_native/ACTIONS_REFERENCE.md` - Comprehensive user guide for all 18 tools
- **Validation Examples**: See TASK_LOG in `runs/RUN-20260126-1428-architecture-formalization/`
- **Code Patterns**: `docs/ai_native/CODE_PATTERNS.md` - DRY utilities and validation patterns

## TypeScript Usage

Full type safety when importing:

```typescript
import type { ThinkParams, NoteParams, LearnedParams } from '@persistence/tools';
import { validateAction, getToolDefinition } from '@persistence/tools';

// Strongly typed validation
const action: Record<string, unknown> = {
  action: 'NOTE',
  op: 'save',
  title: 'My Notes',
  body: '...'
};

const result = validateAction(action);
if (result.valid) {
  // Safe to cast now
  const params = action as NoteParams;
  console.log(params.op); // TypeScript knows this is 'save' | 'get' | 'delete'
}
```

## License

Part of the Persistent Claude project.
