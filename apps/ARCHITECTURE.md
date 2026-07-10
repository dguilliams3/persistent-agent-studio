# apps/ - User-Facing Applications

**Status:** STABLE (as of 2026-01-27)

---

## What Lives Here

User interfaces that run on client devices (browser, mobile, etc.):

| App | Status | Purpose |
|-----|--------|---------|
| `apps/web/` | Active | Main React dashboard |
| `apps/telegram-mini/` | Not started | Telegram WebApp (Phase 4) |

---

## apps/web/ - The Dashboard

The main admin interface for managing Clio.

```
apps/web/
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Root component
│   ├── components/
│   │   ├── tabs/             # Tab panels (History, Memory, etc.)
│   │   └── ui/               # Reusable components
│   ├── store/
│   │   └── index.js          # Zustand global state (~2000 lines)
│   └── api/
│       └── client.js         # Fetch wrapper for worker API
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### Tech Stack
- **React** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Lucide** - Icons

### Data Flow

```
User clicks button
       │
       v
React component calls store action
       │
       v
Zustand store calls API client
       │
       v
fetch() to https://your-worker.workers.dev/...
       │
       v
Worker processes request, returns JSON
       │
       v
Store updates state, React re-renders
```

---

## Apps vs Platforms vs Packages

```
                    ┌─────────────┐
                    │   apps/     │  Runs on: User's browser
                    │   (React)   │  Makes: HTTP requests
                    └──────┬──────┘
                           │ fetch()
                           v
                    ┌─────────────┐
                    │ platforms/  │  Runs on: Cloudflare edge
                    │  (Worker)   │  Has: DB, secrets, AI
                    └──────┬──────┘
                           │ imports
                           v
                    ┌─────────────┐
                    │ packages/   │  Runs on: Anywhere
                    │   (Pure)    │  Has: Types, logic, schemas
                    └─────────────┘
```

**Key distinction:**
- Apps make HTTP requests to platforms
- Platforms import from packages
- Apps should NOT import from platforms (no shared code)
- Apps CAN import types from packages

---

## What Belongs in apps/

- React components
- CSS/Tailwind styles
- Client-side state (Zustand)
- API client code
- Platform SDK integration (Telegram WebApp SDK, etc.)

## What Does NOT Belong in apps/

- Database queries (that's platforms/)
- Business logic (that's packages/)
- Secrets/API keys (that's platforms/)
- Webhook handlers (that's platforms/)

---

## Telegram Bot vs Telegram Mini App

These are DIFFERENT things with different homes:

| Aspect | Telegram Bot | Telegram Mini App |
|--------|--------------|-------------------|
| What | Receives /commands | Full web UI in Telegram |
| Where | `platforms/cloudflare/src/telegram/` | `apps/telegram-mini/` |
| Runs on | Cloudflare Workers | User's device |
| Trigger | User sends message | User taps "Open App" |

**The bot is backend (platforms/). The mini app is frontend (apps/).**

---

## Adding a New App

1. Create `apps/your-app/` directory
2. Add to `pnpm-workspace.yaml` (already covers `apps/*`)
3. Set up build tooling (Vite recommended)
4. Import types from `@persistence/*` packages as needed
5. Call worker API for data

Example for Telegram mini app:
```typescript
// apps/telegram-mini/src/hooks/useTelegram.ts
// Note: no @persistence/telegram package; Telegram types would come from @types or platform if needed.
import type { TelegramUser } from 'OLD_FICTION';

export function useTelegram() {
  const webApp = window.Telegram?.WebApp;
  const user: TelegramUser | null = webApp?.initDataUnsafe?.user ?? null;
  // ...
}
```

---

## Shared Code Between Apps

Apps should NOT import from each other:

```typescript
// BAD
import { SomeComponent } from '../../web/src/components';

// GOOD - extract to package if truly reusable
import { formatDate } from '@persistence/core';
```

If two apps need the same component, either:
1. Duplicate it (if simple)
2. Extract to a `@persistence/ui` package (if complex)

---

## Development

```bash
# Start web dashboard dev server
pnpm dev

# Build for production
pnpm build

# The built files go to apps/web/dist/
# Served by Cloudflare Pages or similar
```
