---
name: setup-instance
description: Use when setting up a new Persistent Claude instance for the first time — when a user says "set me up", "get started", "deploy this", or "configure my persona". Walks interactively from zero to a deployed, personalized, autonomous persona on Cloudflare (D1, secrets, worker + web deploy, naming your persona and yourself, and verifying the identity monitor).
---

# Setup Instance — Interactive Wizard

Walks a new user from a fresh clone to a live, personalized Persistent Claude persona running on
their own Cloudflare account. It covers infrastructure, secrets, deployment, personalization (your
name and the persona's), and validation including the identity monitor (SIM).

## Ground rules

- **Single source of truth:** `setup-run/setup-log.md` (append-only). Every answer, command, and
  result is appended. Never edit or delete earlier entries.
- **Resumable:** Each phase begins by reading `setup-run/setup-log.md`. If context compacts, re-read
  it to recover state.
- **Cross-platform:** No OS-specific assumptions. Prefer `npx`/`pnpm`. Quote paths, use forward slashes.
- **Interactive:** Ask, confirm, then act. Never assume answers. This deploys to the user's own
  paid-capable cloud account — confirm before creating billable resources.

---

## Phase 0: Questionnaire

_Gather all inputs upfront._

1. Create `setup-run/` and `setup-run/setup-log.md`:
   ```markdown
   # Setup Log
   Started: <timestamp>

   ## Phase 0: Questionnaire
   ```
2. Welcome:
   > This wizard sets up your own persistent Claude persona from scratch — its own memory, its own
   > autonomous think-loop, and the identity monitor. I'll ask a few questions, then handle the rest.
3. **Account & tools** — ask/record: Cloudflare account? (`wrangler whoami` if yes); `node --version`
   (need 18+); `pnpm --version`; `npx wrangler --version`; Anthropic API key ready?
4. **Resource names** — propose sensible defaults, let them override; record each:
   - `WORKER_NAME` (default `persistent-claude`)
   - `D1_DATABASE_NAME` (default `claude-loop`)
   - `PAGES_PROJECT_NAME` (default `persistent-claude-ui`)
5. **Your persona** — ask:
   - Persona name (the example ships as **Clio** — pick your own, e.g. "Ada", "Sol").
   - **Your** name (`human_name`, default "User") — the persona will address you by this and its
     message action becomes `MESSAGE_<YOURNAME>`. Recommend they set a real name (peer framing).
6. **Optional integrations** — ask which they want (all optional; the web UI works without any):
   - Telegram delivery (needs a bot token + chat id)
   - Discord delivery (needs a webhook)
   - Extra model providers (OpenAI / DeepSeek / Kimi)
   - Voice (ElevenLabs) · Image gen (Replicate)
7. **Summary + confirm:** present all answers as a table. "Look right? Any changes before we proceed?"
8. Append everything to the log under an explicit `## Resource names` + `## Choices` section so later
   phases read the chosen names (NOT the template defaults).

---

## Phase 1: Prerequisites

Read the log; install anything missing:
- Node 18+ → https://nodejs.org · pnpm → `npm install -g pnpm` · wrangler → `npm install -g wrangler`
- `wrangler login` if not authenticated. Record versions in the log.

---

## Phase 2: Install + D1 database

```bash
pnpm install
cd platforms/cloudflare
wrangler d1 create <D1_DATABASE_NAME>          # use their chosen name
```
Paste the printed `database_id` into `platforms/cloudflare/wrangler.toml` (`[[d1_databases]]`,
replacing the `YOUR_D1_DATABASE_ID` placeholder). Also set `database_name` and the worker `name`
to their chosen values. Then apply migrations in order:
```bash
wrangler d1 execute <D1_DATABASE_NAME> --file=migration_*.sql
```
Confirm success; append the database_id (last 4 chars only in the log) and migration result.

---

## Phase 3: Secrets

Set from `platforms/cloudflare` with `wrangler secret put <NAME>`. **Required:**
- `ANTHROPIC_API_KEY` · `ADMIN_USERNAME` · `ADMIN_PASSWORD` (strong! gates all writes) · `JWT_SECRET`
  (any long random string)

**Optional — only the ones they chose in Phase 0:**
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` · Discord: `DISCORD_WEBHOOK`
- Providers: `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `MOONSHOT_API_KEY`
- Voice/image: `ELEVENLABS_API_KEY` / `REPLICATE_API_TOKEN`

Never write secret values into the log or the repo. Record only which secrets were set.

---

## Phase 4: Deploy the worker

```bash
wrangler deploy        # from platforms/cloudflare
```
Record the worker URL (`https://<WORKER_NAME>.<subdomain>.workers.dev`). Do a health check:
`curl <worker-url>/state` should return JSON.

---

## Phase 5: Deploy the web UI (Cloudflare Pages)

The frontend needs the worker URL at build time:
```bash
cd ..
VITE_WORKER_URL="<worker-url>" pnpm build
wrangler pages deploy dist --project-name <PAGES_PROJECT_NAME>
```
Record the Pages URL. Confirm it loads and reaches the worker.

---

## Phase 6: Personalize

1. **Your name** (peer framing): set `human_name` so the persona addresses you by name and its
   action becomes `MESSAGE_<YOURNAME>`:
   ```bash
   wrangler d1 execute <D1_DATABASE_NAME> --command="INSERT OR REPLACE INTO state (key,value) VALUES ('human_name','<YourName>')"
   ```
2. **The persona** (name + voice): the persona's identity lives in its system prompt
   (`platforms/cloudflare/src/context.ts` and the persona's `system_prompt_template`). Guide the
   user to replace the example "Clio" identity with their own persona's name and character. Keep it
   short and in their own voice — this is the soul of the instance.
3. Redeploy the worker if they edited source (`wrangler deploy`).

---

## Phase 7: Validation

- Worker health: `curl <worker-url>/state` returns JSON with the loop state.
- Trigger a first think cycle: `curl -X POST <worker-url>/think-now` (authenticated per your admin
  creds) and confirm a new `history` entry appears.
- Open the web UI → **SemanticMonitor** tab → trigger a basin recompute once there's some history;
  confirm per-voice basins render. (Early on there's little data — that's expected; SIM gets
  interesting as the persona accumulates a record.)
- Confirm the persona's message action shows as `MESSAGE_<YOURNAME>` in `/context`.

---

## Phase 8: Completion

Append a final summary to `setup-run/setup-log.md`: URLs, chosen names, which integrations are live,
and any follow-ups. Tell the user:
> Your persona is live. It will think on its own schedule, remember, and reach out. Watch it settle
> into itself on the SemanticMonitor tab over the coming weeks. Read the README for the deeper story.
