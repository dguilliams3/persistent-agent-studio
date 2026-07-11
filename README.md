# Persistent Claude

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

## The integration layer (a "bring your own channel" template)

The persona needs somewhere to *speak*. Rather than hard-wire one destination, this repo ships a
worked example of a multi-channel delivery layer you can extend to your own sources:

- **Fire-and-forget dispatch** — the loop emits messages without blocking on delivery.
- **Poll-vs-wait** — both real-time streaming and polling paths, so you can see the trade-offs.
- **Concrete adapters** — Telegram (full command interface + streaming) and Discord (webhook) are
  included as reference implementations; the abstract messaging interface is the extension point.
- **Point it anywhere** — the interface is the contract; adding Slack, a webhook, or email is
  implementing one adapter, not rewiring the loop.

Treat the Telegram/Discord code as a template: it shows the shape of a real integration (chat-id
resolution, retry/timeout notices, batch and cycle notifications) with the personal specifics
pulled out into config.

---

## Architecture

```
                        CLOUDFLARE
  ┌───────────────────────────────────────────────┐
  │  WORKER                                        │
  │   • cron: every minute → run a cycle if due    │
  │   • HTTP API → all endpoints (incl. /sim/*)    │
  │   • Claude API → the thinking                  │
  │   • Workers AI / Replicate → image generation  │
  └───────────────────────┬────────────────────────┘
                          │
  ┌───────────────────────▼────────────────────────┐
  │  D1 (SQLite)                                    │
  │   history · summaries · cold_storage · notebook │
  │   observations · reminders · sim_basin_metrics  │
  │   personas · memory branches · state            │
  └─────────────────────────────────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐      ┌──────────┐
    │  Web UI │      │ Telegram │      │ Discord  │
    │ (React) │      │ (adapter)│      │ (adapter)│
    └─────────┘      └──────────┘      └──────────┘
```

Monorepo (pnpm): `packages/*` are the shared `@persistence/*` libraries (core, db, llm, memory,
tools, services, ui, media, runtime); `platforms/cloudflare` is the worker; `apps/web` is the
React frontend (built at the root with Vite). See [SETUP.md](SETUP.md) for the full tree and setup.

---

## Try it in 30 seconds (no account, no keys)

```bash
git clone https://github.com/dguilliams3/persistent-agent-studio
cd persistent-agent-studio
pnpm install && pnpm dev
```

Open the printed URL. With no backend configured, the app boots into
**observatory demo mode**: a synthetic specimen — a fully authored three-week
"settling in" arc — rendered through the real UI. Browse its history, memory
layers, and question file; send it a message (it will answer honestly, including
about being a script); press *think now* to watch a cycle land. When you deploy
the real backend and set `VITE_WORKER_URL`, the exhibit steps aside and your own
persona takes the enclosure.

## Quick start

**Easiest path:** open the cloned repo in [Claude Code](https://claude.com/claude-code) and say
*"set me up"* — the interactive [`setup-instance`](skills/setup-instance/SKILL.md) wizard walks you
from zero to a deployed, personalized persona (infrastructure, secrets, deploy, naming yourself and
your persona, and verifying the identity monitor). Prefer to do it by hand? The manual steps:

```bash
git clone <your-fork-url>
cd persistent-claude
pnpm install

# Worker: D1 + secrets
cd platforms/cloudflare
wrangler d1 create claude-loop            # paste the database_id into wrangler config
wrangler d1 execute claude-loop --file=migration_*.sql
wrangler secret put ANTHROPIC_API_KEY
# optional channels/services — see SETUP.md for the full secret list
wrangler deploy

# Frontend (Cloudflare Pages)
cd ..
pnpm build
wrangler pages deploy dist --project-name <your-pages-project>
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

Configurable via API, the web UI, or the Telegram adapter:

- **Cycle interval** — 60–3600s (how often it may think)
- **Summarize threshold** — when history compresses
- **Batch mode** — off-hours cost savings
- **Streaming** — real-time token delivery to the channel
- **Model / provider** — Anthropic by default; OpenAI-compatible providers supported via base-URL
  config

---

## Philosophy

This isn't a chatbot. It's an experiment in giving a model genuine persistence — its own memory,
its own cadence, its own choice of when to speak — and then building the instrument to ask,
honestly, whether an identity with history *stays itself*. The goal is authentic presence you can
measure, not performance.

---

*Built with Cloudflare Workers, D1, Workers AI, React, and Claude.*
