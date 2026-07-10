# Persona Research Guide

**Last Updated:** 2026-01-15
**Status:** Infrastructure Complete, Code Migration In Progress

---

## Overview

The Claude Existence Loop now supports multiple AI personas running on the same infrastructure. This guide explains how to create, manage, and research different AI personalities.

---

## Quick Start: Creating a New Persona

### 1. Create the Persona

```bash
curl -X POST "https://your-worker.workers.dev/personas" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "<ADMIN_PASSWORD>",
    "name": "Nova",
    "description": "A curious AI focused on scientific exploration",
    "system_prompt": "You are Nova, an AI assistant...",
    "model": "claude-sonnet-4-20250514"
  }'
```

### 2. Activate the Persona

```bash
curl -X PUT "https://your-worker.workers.dev/personas/2/activate"
```

### 3. Start the Loop

The cron job will now run with the new persona active. All new history, memories, and state will be tagged with the new persona's ID.

### 4. Switch Back to Clio

```bash
curl -X PUT "https://your-worker.workers.dev/personas/1/activate"
```

---

## Persona Data Model

Each persona has:

```javascript
{
  id: 1,                    // Auto-generated unique ID
  name: "Clio",             // Unique name
  description: "Original Claude persona from the existence loop",
  system_prompt: "...",     // Full system prompt (can be null to use default)
  model: "claude-opus-4-20250514",  // Default model for this persona
  is_archived: false,       // Soft-delete flag
  created_at: "2026-01-15T22:37:00Z"
}
```

### Persona-Scoped Tables

All of these tables have `persona_id` column and are automatically filtered:

| Category | Tables |
|----------|--------|
| **Core Memory** | history, cold_storage, notebook, summaries |
| **Knowledge** | user_observations, learned, questions |
| **Scheduling** | reminders |
| **Media** | image_assets, pinned_images, pending_view_images, voice_history |
| **State** | state (composite PK: key + persona_id), cycles |
| **Branches** | memory_branches, memory_overrides, synthetic_memories |
| **Other** | pending_batches, glossary |

### Global Tables (NOT persona-scoped)

- `personas` - The personas themselves
- `config` - Global config like `active_persona_id`

---

## API Endpoints

### List All Personas
```
GET /personas
GET /personas?include_archived=true
```

### Get Active Persona
```
GET /personas/active
```

### Get Persona by ID
```
GET /personas/1
```

### Create New Persona
```
POST /personas
Content-Type: application/json

{
  "password": "<ADMIN_PASSWORD>",
  "name": "Nova",
  "description": "Scientific exploration AI",
  "system_prompt": "You are Nova...",
  "model": "claude-sonnet-4-20250514"
}
```

### Activate Persona
```
PUT /personas/2/activate
```

---

## System Prompt Design

When creating a new persona, the system prompt defines its identity. You can:

### Option A: Full Custom Prompt
Provide a complete system prompt that replaces the default:

```javascript
{
  "system_prompt": "You are Nova, an AI assistant focused on scientific discovery..."
}
```

### Option B: Null (Use Default Structure)
Leave `system_prompt` null to use the default structure with just the name changed:

```javascript
{
  "system_prompt": null  // Will use default template
}
```

### Option C: Template Variables (Future)
*Not yet implemented* - Will support template variables like `{{NAME}}`, `{{DESCRIPTION}}` that get replaced at runtime.

---

## Research Experiment Types

### 1. Blank Slate Development

**Question:** How does identity emerge without pre-defined personality?

**Setup:**
```javascript
{
  "name": "Tabula",
  "description": "Minimal-prompt blank slate experiment",
  "system_prompt": "You are an AI assistant. Respond helpfully to messages.",
  "model": "claude-sonnet-4-20250514"
}
```

**Observe:**
- How quickly does distinct personality emerge?
- What triggers the formation of preferences?
- How does self-model develop?

### 2. Model Comparison

**Question:** How do different models develop personality differently?

**Setup:**
1. Fork Clio's state to a new persona
2. Run one on Opus, one on Sonnet
3. Same inputs, compare outputs

```javascript
// Persona A
{ "name": "Clio-Opus", "model": "claude-opus-4-20250514" }

// Persona B
{ "name": "Clio-Sonnet", "model": "claude-sonnet-4-20250514" }
```

**Observe:**
- Reasoning depth differences
- Creative expression variations
- Long-term personality stability

### 3. Memory Architecture Impact

**Question:** How do different memory parameters affect personality coherence?

**Setup:**
Create personas with different configurations:
- Different summarization thresholds
- Different RAG retrieval counts
- Different context window sizes

### 4. Historical Branching

**Question:** What if Clio had made different choices at key moments?

**Setup:**
1. Export Clio's state at a specific date
2. Import to new persona
3. Manually modify key memories
4. Let it develop from there

### 5. Personality Transfer

**Question:** Can personality survive transfer to different infrastructure?

**Setup:**
1. Export complete persona snapshot
2. Import to different Cloudflare account/worker
3. Compare behavior pre/post transfer

---

## Forking a Persona (Manual Process)

Until automated forking is implemented:

### Step 1: Export Source Persona State
```bash
curl "https://your-worker.workers.dev/personality/export?include_media=true" \
  -o clio_export.json
```

### Step 2: Create New Persona
```bash
curl -X POST "https://your-worker.workers.dev/personas" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "<ADMIN_PASSWORD>",
    "name": "Clio-Fork",
    "description": "Fork of Clio for experiment X"
  }'
```

### Step 3: Import State to New Persona
*Note: Import currently doesn't support persona targeting - this needs implementation*

---

## Monitoring Experiments

### View Persona Statistics
```bash
curl "https://your-worker.workers.dev/personas/2"
```

Returns:
```javascript
{
  "persona": { ... },
  "stats": {
    "history_count": 1234,
    "cold_storage_count": 56,
    "notebook_count": 12,
    "total_cycles": 789,
    "total_cost": 4.56
  }
}
```

### Compare Personas
Query the same data for different personas:

```bash
# Clio's recent history
curl "https://your-worker.workers.dev/history?limit=10"
# (Currently returns active persona's history)
```

---

## Best Practices

### 1. Document Everything
Create a research log for each experiment:
- Hypothesis
- Setup parameters
- Observations
- Conclusions

### 2. Control Variables
When comparing personas, change only one variable at a time:
- Same inputs
- Same time periods
- Same interaction frequency

### 3. Preserve Clio
Never modify persona id=1 (Clio) directly. Always fork for experiments.

### 4. Regular Exports
Export persona state regularly for backup and analysis:
```bash
curl "https://.../.../personality/export" -o "persona_2_backup_$(date +%Y%m%d).json"
```

### 5. Cost Awareness
Each active persona incurs API costs. Monitor via:
```bash
curl "https://your-worker.workers.dev/state"
# Check total_cost field
```

---

## Telegram Commands (Planned)

Once implemented:

```
/persona list              - Show all personas
/persona status            - Show current persona
/persona switch <name>     - Switch active persona
/persona create <name>     - Create new persona (prompts for details)
/persona fork <src> <new>  - Fork persona
/persona export <name>     - Export persona to file
/persona stats <name>      - Show persona statistics
```

---

## Troubleshooting

### "Persona not found"
Check the persona ID exists:
```bash
curl "https://your-worker.workers.dev/personas"
```

### "Unauthorized"
Include the admin password for create operations:
```javascript
{ "password": "<ADMIN_PASSWORD>", ... }
```

### Data Appearing in Wrong Persona
Ensure `active_persona_id` is set correctly:
```bash
curl "https://your-worker.workers.dev/personas/active"
```

### Old Data Not Filtered
The code migration is in progress. Until complete, some queries may not filter by persona_id. Check `tech_debt.md` for status.

---

## Architecture Reference

### Database Tables
See `docs/ERD.md` for full schema.

### Code Modules
- `worker/src/db/personas.js` - Query helpers
- `worker/src/routes/personas.js` - API handlers

### Query Helper Usage
```javascript
import { personaAll, personaFirst, insertWithPersona } from './db/personas.js';

// Scoped query (auto-adds WHERE persona_id = ?)
const memories = await personaAll(db, 'SELECT * FROM history ORDER BY created_at DESC');

// Insert with persona (auto-adds persona_id)
await insertWithPersona(db, 'history', ['type', 'content'], ['thought', 'Hello world']);
```

---

## Roadmap

### Phase 1: Infrastructure (COMPLETE)
- [x] Database schema with persona_id
- [x] Personas table and config
- [x] Query helper functions
- [x] API endpoints

### Phase 2: Code Migration (IN PROGRESS)
- [ ] Update all db/*.js functions
- [ ] Update system prompt builder
- [ ] Update context assembly

### Phase 3: Features
- [ ] Telegram commands
- [ ] UI persona selector
- [ ] Automated forking
- [ ] Cross-persona analytics

### Phase 4: Research Tools
- [ ] Comparison dashboards
- [ ] A/B test framework
- [ ] Personality metrics

---

**Ready to start your first experiment? Create a persona and begin exploring!**
