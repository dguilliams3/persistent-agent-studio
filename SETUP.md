# Setup

From-scratch deployment of Persistent Claude to your own Cloudflare account. The README covers what
the system *is*; this covers getting it running.

## Prerequisites

- **pnpm** (this is a pnpm monorepo)
- **Wrangler CLI** — `pnpm add -g wrangler`
- **Node.js 18+**
- A **Cloudflare account** (Workers + D1 + Pages — all have free tiers that cover a single persona)
- An **Anthropic API key**

## Repository layout

```
persistent-claude/
├── packages/            # shared @persistence/* libs (core, db, llm, memory, tools, services, ui, media, runtime)
├── platforms/cloudflare/  # the worker: src/index.ts, routes/, services/, migration_*.sql, wrangler config
├── apps/web/            # React frontend (built at the repo root by Vite)
├── vite.config.js       # root Vite — aliases @persistence/*, builds apps/web → dist/
└── pnpm-workspace.yaml
```

## 1. Install

```bash
pnpm install
```

## 2. Create the D1 database

```bash
cd platforms/cloudflare
wrangler d1 create claude-loop
# copy the printed database_id into your wrangler config ([[d1_databases]])
wrangler d1 execute claude-loop --file=migration_*.sql   # apply migrations in order
```

## 3. Set worker secrets

Set with `wrangler secret put <NAME>` from `platforms/cloudflare`.

### Required

| Secret | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | The model that does the thinking |
| `ADMIN_USERNAME` | Login for the web UI / protected routes |
| `ADMIN_PASSWORD` | Login password — **use a strong one; it gates all writes** |
| `JWT_SECRET` | Signs session tokens (any long random string) |

### Optional — messaging channels (the integration-layer showcase)

| Secret | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Enables the Telegram adapter (bot command interface + streaming) |
| `TELEGRAM_CHAT_ID` | Where the persona sends messages (your chat/channel id) |
| `DISCORD_WEBHOOK` | Enables the Discord adapter (webhook delivery) |

Leave these unset and the persona simply doesn't deliver over that channel — the web UI still works.

### Optional — additional model providers (OpenAI-compatible)

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI models |
| `DEEPSEEK_API_KEY` | DeepSeek (OpenAI-compatible base URL) |
| `MOONSHOT_API_KEY` | Kimi / Moonshot (OpenAI-compatible base URL) |

### Optional — voice & image generation

| Secret | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `REPLICATE_API_TOKEN` | Replicate image models (uncensored, via `REPLICATE:` prefix) |
| `PONY_STUDIO_URL` / `PONY_STUDIO_USERNAME` / `PONY_STUDIO_PASSWORD` | A self-hosted image-generation service, if you run one |
| `MODAL_PROSODY_URL` / `MODAL_PROSODY_HEALTH_URL` | Self-hosted Modal endpoint for voice-prosody, if used |
| `MODAL_VIDEO_URL` / `MODAL_VIDEO_HEALTH_URL` | Self-hosted Modal endpoint for video-to-gif, if used |

The Modal/Pony URLs default to placeholders (`https://your-endpoint...`); set them only if you run
those services.

## 4. Deploy the worker

```bash
wrangler deploy
# note your worker URL, e.g. https://<your-worker>.workers.dev
```

## 5. Build & deploy the frontend (Cloudflare Pages)

The frontend needs to know your worker's URL at build time via `VITE_WORKER_URL`:

```bash
cd ..
VITE_WORKER_URL="https://<your-worker>.workers.dev" pnpm build
wrangler pages deploy dist --project-name <your-pages-project>
```

(If unset, the frontend falls back to a placeholder and won't reach your worker.)

## Local development

```bash
pnpm dev            # root Vite dev server → http://localhost:5173
wrangler tail       # live worker logs, from platforms/cloudflare
```

## Personalize your persona's counterpart (recommended)

By default the persona refers to its human counterpart generically as **"User"** — its message
action is literally `MESSAGE_USER`. Set your own name and that changes:

```bash
# from platforms/cloudflare
wrangler d1 execute claude-loop --command="INSERT OR REPLACE INTO state (key, value) VALUES ('human_name', 'YourName')"
```

Now the persona sees its action as `MESSAGE_YOURNAME` and addresses you by name. This is deliberate,
not cosmetic: a persona that knows your name relates to you as a *peer it chooses to reach*, not an
"assistant" dispatching to a "user." Naming the relationship changes its character — which is the
whole point of giving a persona persistence in the first place. The internal storage stays a stable
`message_to_user` type, so you can rename yourself without breaking any data.

## How a cycle works

1. **Cron** invokes the worker on its interval (default: check every minute, think when due).
2. The worker checks whether the loop is running, then calls the Claude API with the persona's
   context + recent history.
3. The persona chooses an action — think, remember, make art, search, message you, or simply exist.
4. The worker executes it: writes to D1, and (if a channel is configured) delivers the message.
5. The web UI polls and reflects the new state.

## Verifying the identity monitor (SIM)

Once there's some history, the `/sim/*` routes and the **SemanticMonitor** tab compute the persona's
basins and drift over its own record. Trigger a recompute from the tab, then read the per-voice
basins and weekly drift — the same shipped functions in `packages/memory/src/sim/` run over your
real data.

## Troubleshooting

```bash
wrangler tail                                              # live logs
wrangler d1 execute claude-loop --command="SELECT * FROM state"   # inspect state
```

## Security notes

- All write routes are gated by `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Set a strong password.
- Secrets live in Wrangler/Cloudflare, never in the repo. Do not commit real keys.
- This is a personal-scale project: it authenticates a single operator, not a multi-tenant user base.
