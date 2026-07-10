# Frontend Architecture

React + TS frontend (root Vite build).

## Directory Structure (verified)

```
apps/web/
├── main.tsx
├── App.tsx
├── index.css
├── api/client.ts
├── hooks/
├── components/
│   ├── layout/AppShell.tsx   # rail + isPanel + view routing
│   ├── tabs/                 # MemoryTab/, VoiceTab/, SettingsTab/, SemanticMonitorTab/ (dead tabs removed)
│   ├── common/ (ErrorBoundary etc.)
│   └── ui/
├── store/slices/             # zustand slices (ui, data, memory, ...)
└── ...
```

## Key Architecture

- AppShell.tsx + rail for navigation (laptop panel + mobile).
- Per-view error boundaries.
- LoadingSkeleton primitive (variants).
- isPanel pattern for side panels.
- Tabs now reflect live views only (post dead-era cleanup).

## Key Patterns (current, verified by ls + reads)

- TSX sources under apps/web/
- AppShell.tsx (layout/rail/isPanel)
- Tabs: only live ones (MemoryTab, VoiceTab, SettingsTab, SemanticMonitorTab)
- Store: slices/ (ui.ts, data.ts, gallery.ts, ...)
- API via store actions or api/client.ts
- Error boundaries per view; LoadingSkeleton primitive

See root README + AppShell.tsx + store/slices for details.

## Docstring Convention

Follows the project's LLM-first style (see docs/ and source).

## Build / Dev (root)

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm lint:budget
```

All paths ls'ed; commands listed via `pnpm run`.
