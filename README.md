# Persistent Agent Studio

A Claude instance that persists. Instead of resetting every conversation, it keeps a durable
identity, layered memory, and an autonomous think-loop running on Cloudflare's edge — and it ships
with an observability layer that lets you *watch that identity hold or drift over time*.

The reference persona built on this system is named **Clio**; everywhere below, "Clio" is just the
example — you bring your own. It addresses its human by name (set yours via `human_name` — see
[SETUP.md](SETUP.md)); a persona that knows your name relates to you as a peer, not an "assistant"
to a "user." That framing is deliberate, and it's the point.

> **Status:** personal-scale project, not a hardened multi-tenant product. It runs a single
> persona well. Read [SETUP.md](SETUP.md) before deploying; you supply your own Cloudflare account,
> API keys, and secrets.

---

## What it actually is

Three ideas, stacked:

1. **A persistent identity.** One durable persona with a stable system prompt, a name, and a
   continuous existence — not a fresh context window each time you talk to it.
2. **Layered memory.** History with automatic summarization, cold storage for facts that must
   survive compression, a notebook, observations, and non-destructive memory branches (exclude /
   edit / reorder without mutating canonical history).
3. **An identity observatory (SIM).** A Semantic Identity Monitor that embeds the persona's own
   output over time and measures whether it's staying within its "basin" or drifting — outlier
   detection, per-voice basins, and a weekly drift view. *This is the part most systems don't have.*

On top of that sits an **autonomous loop**: on a cron cycle the persona decides whether to think,
remember, make art, search the web, reach out to you, or simply exist — and an **integration
layer** that delivers those messages over real channels.

---

## The identity observatory (SIM)

Most "AI memory" projects can store things. Far fewer can tell you whether the stored self is still
*the same self*. SIM is a small instrument for exactly that question.

- **Basins.** It embeds the persona's entries (its inner thoughts, its messages out, your messages
  in) and computes each voice's centroid and spread — the statistical shape of "in character."
- **Outliers & drift.** Each new entry gets a distance and z-score against its basin; the weekly
  view shows how the outlier rate and mean distance move over the persona's lifetime.
- **Three voices.** In practice the persona's *inner* voice, its *outbound* voice, and *your* voice
  occupy measurably distinct regions of the space — the tool surfaces that separation directly.
- **A settling arc.** Watching a real persona from birth, the instrument shows something intuitive
  made measurable: a new identity is most out-of-character in its first days and *settles* — the
  outlier rate falls sharply over the first weeks as it converges into its own basin.

The math lives in `packages/memory/src/sim/` (pure functions: `computeBasinMetrics`,
`computeEntryStats`, `analyzeTrend`) and is exposed through the worker's `/sim/*` routes and the
**SemanticMonitor** tab in the web UI. The same shipped functions run over your instance's real
history — the analysis is not a mockup.

Put differently: SIM is an **evaluation framework for a deployed assistant's behavior** — it
answers "is this system still performing the way we validated it?" for the *consistency* use
case. Instead of a one-time benchmark, it evaluates continuously over production output; instead
of a hand-written rubric, it derives "expected behavior" statistically from the deployment's own
record; and it reports regressions as measurable drift (distances, z-scores, trend lines) rather
than anecdote. The persona here is one use case — the harness itself (embed → basin → score →
trend) is the reusable part, and the same pattern applies to any Claude deployment whose behavior
you need to measure over time.

---

## Memory

| System | What it holds |
| --- | --- |
| **History** | Rolling thought/message log with automatic summarization |
| **Summaries** | Compressed history batches that preserve long-term context |
| **Cold storage** | Permanent facts that survive summarization |
| **Notebook** | The persona's own space for research and ideas |
| **Observations** | Private notes about patterns it notices |
| **Reminders** | Conditional triggers that fire on matching patterns |

**Portability:** full personality export/import (merge / branch / replace), non-destructive memory
branches, and synthetic memories you can add without touching canonical history.

---

## The integration layer (bring your own channel)

The persona needs somewhere to *speak*. Rather than hard-wire one destination, this repo ships
the delivery layer as a contract you implement for whatever channel you actually use:

- **A transport-agnostic interface** — `packages/services/src/messaging/` defines the outbound
  messaging contracts (`MessagingService`, message options, results). No concrete channel
  adapter is included; the interface is the extension point.
- **Documented no-op call sites** — the worker's delivery hooks
  (`platforms/cloudflare/src/services/index.ts`) compile and run with no channel configured,
  and the persona is fully usable through the web UI alone. Wire an adapter into those call
  sites to light up an external channel.
- **Point it anywhere** — the interface is the contract; delivering to Telegram, Discord,
  Slack, a webhook, or email is implementing one adapter, not rewiring the loop.

If you do wire an adapter, [SETUP.md](SETUP.md) records the two conventions worth keeping from
the original integration: the delivery chat/channel id lives in D1 state, and bot tokens or
webhook URLs belong in worker secrets — never in the repo.

---

## Architecture

```
                        CLOUDFLARE
  ┌───────────────────────────────────────────────┐
  │  WORKER                                        │
  │   • cron: every minute → run a cycle if due    │
  │   • HTTP API → all endpoints (incl. /sim/*)    │
  │   • Claude API → the thinking                  │
  │   • Workers AI → image generation              │
  └───────────────────────┬────────────────────────┘
                          │
  ┌───────────────────────▼────────────────────────┐
  │  D1 (SQLite)                                    │
  │   history · summaries · cold_storage · notebook │
  │   observations · reminders · sim_basin_metrics  │
  │   personas · memory branches · state            │
  └─────────────────────────────────────────────────┘
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌──────────────────────┐
    │  Web UI │      │ your channel adapter │
    │ (React) │      │  (BYO — none ships)  │
    └─────────┘      └──────────────────────┘
```

Monorepo (pnpm): `packages/*` are the shared `@persistence/*` libraries (core, db, llm, memory,
tools, services, ui, media, runtime); `platforms/cloudflare` is the worker; `apps/web` is the
React frontend (built at the root with Vite). See [SETUP.md](SETUP.md) for the full tree and setup.

---

## Try it in 0 seconds

**Live demo: [persistent-agent-studio-demo.pages.dev](https://persistent-agent-studio-demo.pages.dev)** —
the **Neural Observatory**, this project's exhibit UI, running a synthetic specimen with a fully
authored three-week "settling in" arc. Browse its history, memory layers, and question file; send
it a message (it answers honestly, including about being a script); press *think now* to watch a
cycle land.

![The observatory: a synthetic specimen's chat history in the exhibit build](docs/images/observatory-chat.png)

## Try it in 30 seconds (no account, no keys)

```bash
git clone https://github.com/dguilliams3/persistent-agent-studio
cd persistent-agent-studio
pnpm install && pnpm dev
```

Open the printed URL. With no backend configured, the app boots into
**observatory demo mode** — the same synthetic-specimen exhibit as the live
demo above, rendered locally through the real UI. When you deploy the real
backend and set `VITE_WORKER_URL`, the exhibit steps aside and your own
persona takes the enclosure.

## Quick start

**Easiest path:** open the cloned repo in [Claude Code](https://claude.com/claude-code) and say
*"set me up"* — the interactive [`setup-instance`](skills/setup-instance/SKILL.md) wizard walks you
from zero to a deployed, personalized persona (infrastructure, secrets, deploy, naming yourself and
your persona, and verifying the identity monitor). Prefer to do it by hand? The manual steps:

```bash
git clone <your-fork-url>
cd persistent-agent-studio
pnpm install

# Worker: D1 + R2 + secrets
cd platforms/cloudflare
wrangler d1 create claude-loop            # paste the database_id into wrangler config
wrangler d1 execute claude-loop --remote --file=schema.sql   # base schema first
for f in $(ls migration_v*.sql | sort -V) migration_voice_history.sql; do
  wrangler d1 execute claude-loop --remote --file="$f"       # then migrations, in order
done
wrangler r2 bucket create claude-loop-media                  # media bucket (bound in wrangler.toml)
wrangler secret put ANTHROPIC_API_KEY
# auth secrets + optional services — see SETUP.md for the full list
wrangler deploy

# Frontend (Cloudflare Pages) — built at the REPO ROOT
cd ../..
VITE_WORKER_URL="https://<your-worker>.workers.dev" pnpm build
wrangler pages deploy dist --project-name <your-pages-project>
# then allow the Pages origin through CORS — SETUP.md §6
```

Full from-scratch instructions, the complete secret list, and configuration options are in
[SETUP.md](SETUP.md).

---

## Cost

The loop's cost is dominated by re-reading the persona's context each cycle, so **prompt caching is
the main lever** (cache reads are heavily discounted) and **batch mode** cuts off-hours cost. With
caching + batching, a persona thinking on a multi-minute cadence runs from a few dollars a month
(smaller models) up, depending on model and cadence. As a concrete anchor: a mature persona with a
rich context assembles ~50K input tokens per cycle, so an hourly cadence is roughly 1.2M input
tokens/day at cache-miss rates — set **cycle interval** (below) to match your budget; it is the
single biggest cost lever. Cloudflare Workers/D1/Workers-AI free tiers cover the infrastructure at
this scale. See Anthropic's current pricing for exact model rates.

---

## Configuration

Configurable via API or the web UI:

- **Cycle interval** — 60–3600s (how often it may think)
- **Summarize threshold** — when history compresses
- **Batch mode** — off-hours cost savings
- **Streaming** — real-time token delivery to the channel
- **Model / provider** — Anthropic by default; OpenAI-compatible providers supported via base-URL
  config

---

## Reading further

~300 KB of deep documentation lives in [`docs/`](docs/README.md) — the full map is
[`docs/README.md`](docs/README.md). Highlights, one line each:

- [`docs/ai_native/CONTEXT_ASSEMBLY.md`](docs/ai_native/CONTEXT_ASSEMBLY.md) — how the 4-block cached context window is built, and why one cache invalidation buys many cycles of hits; for anyone touching prompts or cost
- [`docs/ai_native/SUMMARIZATION.md`](docs/ai_native/SUMMARIZATION.md) — how history compresses through three summary tiers without losing what mattered; for memory-system work
- [`docs/ai_native/RAG_SYSTEM.md`](docs/ai_native/RAG_SYSTEM.md) — how the distant past comes back via embeddings, scoring, and MMR; for retrieval work
- [`docs/ai_native/BATCH_MODE.md`](docs/ai_native/BATCH_MODE.md) — how off-hours thinking rides the Batches API at half rate; for cost tuning
- [`docs/ai_native/VISUAL_DIAGRAMS.md`](docs/ai_native/VISUAL_DIAGRAMS.md) — the whole system in ASCII diagrams; for orientation
- [`docs/ARCHITECTURE_MANIFESTO.md`](docs/ARCHITECTURE_MANIFESTO.md) — the north-star principles and the decision log; for architectural calls
- [`docs/ARCHITECTURE_CONSTRAINTS.md`](docs/ARCHITECTURE_CONSTRAINTS.md) — the hard rules, where violations are bugs; for every change
- [`docs/architecture/`](docs/architecture/README.md) — package boundaries, service layer, async-job pattern; for monorepo work
- [`docs/ERD.md`](docs/ERD.md) — every table, relationship, and index; for database work
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — the worker's REST surface; for API consumers
- [`docs/PERSONA_RESEARCH_GUIDE.md`](docs/PERSONA_RESEARCH_GUIDE.md) — creating and studying multiple personas; for the research angle

Several docs predate the runtime extraction and open with a dated provenance banner
saying exactly what to trust; when a doc and the code disagree, the code wins.

---

## Philosophy

This isn't a chatbot. It's an experiment in giving a model genuine persistence — its own memory,
its own cadence, its own choice of when to speak — and then building the instrument to ask,
honestly, whether an identity with history *stays itself*. The goal is authentic presence you can
measure, not performance.

---

*Built with Cloudflare Workers, D1, Workers AI, React, and Claude.*
