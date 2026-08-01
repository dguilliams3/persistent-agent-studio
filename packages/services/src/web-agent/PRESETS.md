# Web Agent Presets

**Source of Truth:** `packages/services/src/web-agent/types.ts` → `WEB_AGENT_PRESETS`

This document tracks the default values for each preset. Update this doc when changing preset defaults.

---

## geopolitical

| Property | Value | Notes |
|----------|-------|-------|
| `statePrefix` | `web_agent_geopolitical` | State keys: `{prefix}_topics`, `{prefix}_enabled`, etc. |
| `provider` | `openai` | LLM provider for synthesis |
| `model` | `gpt-4o-mini` | Cost-effective for summarization |
| `intervalHours` | `24` | Once per day |
| `targetHourUTC` | `11` | 6 AM EST |
| `maxArticlesPerTopic` | `5` | (unused - doWebSearch returns text) |
| `historyType` | `web_digest` | |

**System Prompt:**
> You are a concise geopolitical analyst. Given search results about a topic, provide a 2-3 paragraph briefing covering: key developments, implications, and what to watch. Focus on facts, not speculation. Include source attributions when available.

---

## tech

| Property | Value | Notes |
|----------|-------|-------|
| `statePrefix` | `web_agent_tech` | |
| `provider` | `openai` | |
| `model` | `gpt-4o-mini` | |
| `intervalHours` | `12` | Twice per day |
| `targetHourUTC` | (none) | Runs when interval elapsed |
| `maxArticlesPerTopic` | `3` | (unused) |
| `historyType` | `web_digest` | |

**System Prompt:**
> You are a tech news summarizer. Given search results, provide a concise 3-paragraph summary of the most important developments. Focus on practical implications and what it means for developers, researchers, and users.

---

## daily

| Property | Value | Notes |
|----------|-------|-------|
| `statePrefix` | `web_agent_daily` | |
| `provider` | `openai` | |
| `model` | `gpt-4o-mini` | |
| `intervalHours` | `24` | Once per day |
| `targetHourUTC` | `14` | 9 AM EST |
| `maxArticlesPerTopic` | `5` | (unused) |
| `historyType` | `web_digest` | |

**System Prompt:**
> You are a daily news briefer. Given search results about a topic, provide a concise 2-paragraph summary of the most important developments from the past day. Be factual and balanced. Note any significant changes or emerging trends.

---

## State Keys Per Preset

Each preset stores configuration in the state table with these keys:

```
{statePrefix}_enabled        - 'true' or 'false'
{statePrefix}_topics         - JSON array of topic strings
{statePrefix}_last_run       - ISO timestamp
{statePrefix}_interval_hours - Override default interval
{statePrefix}_provider       - Override default provider
{statePrefix}_model          - Override default model
```

---

## Adding a New Preset

1. Add to `WEB_AGENT_PRESETS` in `types.ts`
2. Add type to `WebAgentPresetName` (automatic via `keyof typeof`)
3. Update this PRESETS.md
4. Update `/digest` command help in `definition.ts`
5. Update tool `promptGuidelines` in packages/tools (if applicable)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-31 | tech: 2→3 paragraphs, added "researchers" to audience |
| 2026-01-31 | geopolitical changed from 6h interval to daily @ 6 AM EST |
| 2026-01-30 | Initial presets created |
