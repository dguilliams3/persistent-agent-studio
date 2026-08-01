# Documentation Map

One index for everything under `docs/`. Each entry: what the doc answers, and who it's
for. Several docs predate the runtime extraction and carry a dated **Provenance** banner
up top — the banner tells you what to trust and where the authoritative source lives.
When any doc and the code disagree, the code wins.

## Deep dives (`docs/ai_native/`)

Written for AI/LLM consumption — structured headers, ASCII diagrams, copy-paste examples.
Index: [`ai_native/README.md`](ai_native/README.md).

| Doc | What it answers | For |
| --- | --- | --- |
| [CONTEXT_ASSEMBLY.md](ai_native/CONTEXT_ASSEMBLY.md) | How the 4-block cached context window is assembled, and why one boundary shift buys many cache hits | anyone touching prompt assembly or cost |
| [SUMMARIZATION.md](ai_native/SUMMARIZATION.md) | How history compresses into summaries and meta-summaries across three tiers | memory-system work |
| [RAG_SYSTEM.md](ai_native/RAG_SYSTEM.md) | How embeddings, scoring, and MMR retrieval recall the distant past | semantic-search work |
| [BATCH_MODE.md](ai_native/BATCH_MODE.md) | How off-hours cycles ride the Batches API at ~0.5x rate | cost/batch work |
| [CONTEXT_WINDOW_ROLLING.md](ai_native/CONTEXT_WINDOW_ROLLING.md) | How the context window rolls forward without losing continuity | memory-system work |
| [VISUAL_DIAGRAMS.md](ai_native/VISUAL_DIAGRAMS.md) | The whole system in ASCII diagrams | orientation |
| [CODE_PATTERNS.md](ai_native/CODE_PATTERNS.md) | Implementation patterns for extending the system | feature work |
| [ACTIONS_REFERENCE.md](ai_native/ACTIONS_REFERENCE.md) | The persona's action format + the live `/tool-registry` | action/tool work |
| [RESPONSE_NORMALIZER.md](ai_native/RESPONSE_NORMALIZER.md) | How raw LLM output becomes validated actions | provider/parser work |
| [FEATURE_CHECKLIST.md](ai_native/FEATURE_CHECKLIST.md) | Every step a new capability must touch | feature work |
| [DOCSTRING_CONVENTIONS.md](ai_native/DOCSTRING_CONVENTIONS.md) | How code documents itself here | writing/reviewing code |
| [EMERGENCY_DEBUGGING.md](ai_native/EMERGENCY_DEBUGGING.md) | What to do when production breaks | incidents |

## Architecture (`docs/architecture/` + top level)

Vision documents — how things *should* be structured. Index:
[`architecture/README.md`](architecture/README.md).

| Doc | What it answers | For |
| --- | --- | --- |
| [ARCHITECTURE_MANIFESTO.md](ARCHITECTURE_MANIFESTO.md) | The north-star principles and the decision log | any architectural call |
| [ARCHITECTURE_CONSTRAINTS.md](ARCHITECTURE_CONSTRAINTS.md) | The hard rules — violations are bugs, not trade-offs | every change |
| [architecture/PACKAGE_STRUCTURE.md](architecture/PACKAGE_STRUCTURE.md) | What each `@persistence/*` package owns | monorepo work |
| [architecture/PLATFORM_VS_PACKAGE.md](architecture/PLATFORM_VS_PACKAGE.md) | What is Cloudflare-specific vs portable | extraction/porting work |
| [architecture/SERVICES_ARCHITECTURE.md](architecture/SERVICES_ARCHITECTURE.md) | How external services plug in behind contracts | integrations |
| [architecture/SERVICE_LAYER.md](architecture/SERVICE_LAYER.md) | How to add a new service integration | integrations |
| [architecture/ASYNC_JOB_PATTERN.md](architecture/ASYNC_JOB_PATTERN.md) | How async work spans thinking cycles without blocking them | long-running features |

## Reference

| Doc | What it answers | For |
| --- | --- | --- |
| [API_REFERENCE.md](API_REFERENCE.md) | The worker's REST surface (route registry is the ground truth) | API consumers |
| [ERD.md](ERD.md) | Every table, relationship, and index (schema v25) | DB work |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | v15-era schema snapshot with per-table rationale | history/rationale |
| [MODEL_PRICING.md](MODEL_PRICING.md) | Dated price snapshot (the repo standard is ratios, not prices) | cost context |
| [CLOUDFLARE_BILLING.md](CLOUDFLARE_BILLING.md) | What Cloudflare charges for at this scale (dated snapshot) | infra cost |
| [PERSONA_RESEARCH_GUIDE.md](PERSONA_RESEARCH_GUIDE.md) | Creating and studying multiple personas | persona research |
| [FUTURE_IDEAS.md](FUTURE_IDEAS.md) | The someday/maybe list | roadmap curiosity |

## Templates (`docs/templates/`)

Task-tracking templates (SPEC, TASK_LOG, archive, docstring validation) from the
original development workflow — reusable if you adopt a similar run-based process.

## Elsewhere in the repo

- [`../README.md`](../README.md) — what this project is; start here
- [`../SETUP.md`](../SETUP.md) — from-scratch deployment to your own Cloudflare account
- `../packages/*/README.md` — per-package deep dives (`memory`, `runtime`, `db`, `llm`, `services`, `tools`, `core`)
- `../packages/ARCHITECTURE.md` / `../platforms/ARCHITECTURE.md` — layer-level notes
- The web app's **Efficiencies** page — the cost story, interactive, with values imported
  from or test-pinned to the shipped code
