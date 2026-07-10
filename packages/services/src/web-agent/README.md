# Web Agent Digest System

The web agent is a scheduled/on-demand system for fetching web information on configurable topics, summarizing via LLM, and logging to Clio's context window.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TRIGGERS                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Cron (every minute)              │  Telegram /digest command       │
│  └─ isWebAgentDue() check         │  └─ handleDigest() handler      │
│     └─ per preset check           │     └─ immediate execution      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    runDigest() - Pure Service                        │
├─────────────────────────────────────────────────────────────────────┤
│  Input: { topics[], synthesize?, synthesisProvider?, synthesisModel? }
│                                                                      │
│  1. Parallel web search (Claude Sonnet + web_search tool)           │
│     └─ Retry with exponential backoff (3 attempts, 1s/2s/4s)        │
│                                                                      │
│  2. Optional synthesis via LLM (gpt-4o-mini default)                │
│                                                                      │
│  Output: { topics[], synthesis?, durationMs, successCount }         │
│                                                                      │
│  Side effects: NONE (pure service)                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONSUMERS (handle side effects)                   │
├─────────────────────────────────────────────────────────────────────┤
│  Cron Handler (index.js)          │  Telegram Handler (commands/)   │
│  └─ logHistory() per topic        │  └─ sendTelegram() results      │
│  └─ logHistory() synthesis        │  └─ logHistory() combined       │
│  └─ setState(lastRun)             │  └─ setState(lastRun)           │
└─────────────────────────────────────────────────────────────────────┘
```

## Scheduling Logic

The cron handler runs every minute and checks each preset:

```typescript
for (const [presetName, presetConfig] of Object.entries(WEB_AGENT_PRESETS)) {
  const due = await isWebAgentDue(
    presetConfig.statePrefix,      // e.g., 'web_agent_geopolitical'
    presetConfig.intervalHours,    // e.g., 6
    { db, getState },
    presetConfig.targetHourUTC     // optional: only run at this UTC hour
  );

  if (due) {
    // Run digest...
  }
}
```

### `isWebAgentDue()` Checks:

1. **Enabled?** - `{statePrefix}_enabled` must be `'true'`
2. **Target hour?** - If `targetHourUTC` is set, current UTC hour must match
3. **Interval elapsed?** - Time since `{statePrefix}_last_run` must exceed `intervalHours`

## State Keys

Each preset stores configuration in the state table with a prefix:

| Key | Description | Example Value |
|-----|-------------|---------------|
| `{prefix}_enabled` | Whether scheduled runs are active | `'true'` |
| `{prefix}_topics` | JSON array of topic strings | `'["US-China relations", "EU policy"]'` |
| `{prefix}_last_run` | ISO timestamp of last run | `'2026-01-31T21:45:02.698Z'` |
| `{prefix}_interval_hours` | Hours between runs (optional override) | `'12'` |
| `{prefix}_provider` | LLM provider override | `'anthropic'` |
| `{prefix}_model` | Model override | `'haiku'` |

## Presets

| Preset | State Prefix | Default Interval | Target Hour |
|--------|--------------|------------------|-------------|
| `geopolitical` | `web_agent_geopolitical` | 24 hours | 11:00 UTC (6 AM EST) |
| `tech` | `web_agent_tech` | 12 hours | None |
| `daily` | `web_agent_daily` | 24 hours | 14:00 UTC (9 AM EST) |

## Usage

### Three Entry Points

| Entry Point | Who Uses It | When |
|-------------|-------------|------|
| **Cron** (automatic) | System | Every minute, checks if any preset is due |
| **`/digest` command** | User via Telegram | On-demand, immediate |
| **DIGEST tool** | Clio in autonomous cycles | To manage topics or trigger manually |

### Telegram Command

```
/digest              # Run geopolitical preset
/digest tech         # Run tech preset
/digest daily        # Run daily preset
```

Returns immediately with confirmation, sends results when complete (~20-30s for 3 topics).

### Clio DIGEST Tool

Clio can manage the digest system in her autonomous cycles:

| Operation | Example | Effect |
|-----------|---------|--------|
| `add_topic` | `{"action":"DIGEST","op":"add_topic","topic":"AI regulation"}` | Add topic to preset (max 10) |
| `remove_topic` | `{"action":"DIGEST","op":"remove_topic","topic":"AI regulation"}` | Remove topic |
| `list_topics` | `{"action":"DIGEST","op":"list_topics"}` | Show current topics |
| `trigger` | `{"action":"DIGEST","op":"trigger"}` | Run digest now |
| `enable` | `{"action":"DIGEST","op":"enable"}` | Enable scheduled runs |
| `disable` | `{"action":"DIGEST","op":"disable"}` | Disable scheduled runs |

Optional `preset` parameter defaults to `geopolitical`.

The DIGEST tool is defined in `packages/tools/src/definitions/digest/` and follows the standard tool pattern with handler, schema, params, and index files.

### Enable Scheduled Runs

Set via migrate endpoint or have Clio use DIGEST action:

```sql
INSERT OR REPLACE INTO state (key, value, updated_at)
VALUES ('web_agent_geopolitical_enabled', 'true', datetime('now'));

INSERT OR REPLACE INTO state (key, value, updated_at)
VALUES ('web_agent_geopolitical_topics',
        '["US-China relations", "EU policy developments", "Middle East situation"]',
        datetime('now'));
```

## Exports

```typescript
// Pure service - no side effects
import { runDigest } from '@persistence/services/web-agent';

// Scheduling helpers
import { isWebAgentDue, loadTopicsFromState, loadWebAgentConfig } from '@persistence/services/web-agent';

// Types and constants
import {
  WEB_AGENT_PRESETS,
  getWebAgentStateKeys,
  MAX_TOPICS,
  type DigestRequest,
  type DigestResult,
  type WebAgentConfig
} from '@persistence/services/web-agent';
```

## Cost Considerations

- **Web Search**: Uses Claude Sonnet (~$3/MTok input) with web_search tool
- **Synthesis**: Uses GPT-4o-mini (~$0.15/MTok) by default
- **Per topic**: ~$0.01-0.02 depending on result length
- **With synthesis**: Additional ~$0.01 for the combined briefing

The synthesis step is optional - set `synthesize: false` to skip and just get raw topic results.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Type definitions, presets, state key helpers |
| `service.ts` | Pure `runDigest()` service and config loaders |
| `index.ts` | Barrel exports |

## Infrastructure Reuse

This system leverages existing infrastructure - no new provider/search code was written:

| Function | Source | Used For |
|----------|--------|----------|
| `doWebSearch()` | `platforms/cloudflare/src/services/web-search.js` | Topic searches (Claude Sonnet + web_search tool) |
| `callLLM()` | `platforms/cloudflare/src/services/llm.js` | Optional synthesis (gpt-4o-mini default) |

The `runDigest()` service takes these as dependency injection, keeping the service pure and testable.

## See Also

- Run documentation: `runs/RUN-20260130-2242-web-agent-architecture/`
- Telegram handler: `packages/services/src/messaging/telegram/commands/digest/`
- Clio tool: `packages/tools/src/definitions/digest/`
- Platform integration: `platforms/cloudflare/src/telegram/commands/index.js` (handleDigest)
- Cron integration: `platforms/cloudflare/src/index.js` (scheduled handler)
