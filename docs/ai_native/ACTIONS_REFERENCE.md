# Clio Actions Reference

Clio (the persona) takes actions by returning JSON. The full, current catalog of
actions — including schema, required/optional fields, and worked examples — is
generated from the tool definitions themselves, so it can never drift out of
sync with the running code the way a hand-maintained list would.

**Source of truth:**
- Live, generated: `GET /tool-registry` (returns id, category, prompt text, help, and schema for every registered action)
- Source code: `packages/tools/src/definitions/` (one directory per action) and `platforms/cloudflare/src/tools/actions/index.ts` (platform-only handlers with no package equivalent)

## Action Format

All actions are valid JSON with this shape:

```json
{
  "action": "ACTION_NAME",
  "op": "operation",
  "content": "The main content/message",
  "internal": "Private reasoning (not sent to the user)"
}
```

- `action` — required; one of the ids returned by `/tool-registry`.
- `op` — required for CRUD-style actions (NOTE, OBSERVATION, REMINDER, ART, LEARNED, QUESTION); each definition's `schema.formatHint` documents its ops.
- `content` — primary content; varies by action.
- `internal` — Clio's private reasoning/context, stored but never surfaced.

Clio can return an array of actions in a single response; actions execute in order.

## Dynamic message-action naming

The action that sends a message to the human counterpart is internally
`MESSAGE_USER`. The system prompt renders it to the model as
`MESSAGE_<HUMANNAME>` (default `MESSAGE_USER`, or e.g. `MESSAGE_ALEX` when the
persona's `human_name` state key is set to "Alex") — see
`getMessageActionDisplayName()` in `platforms/cloudflare/src/tools/prompt.ts`.
Internal routing, storage, and the history entry type (`message_to_user`) are
unaffected by the display name.

## Related Documentation

- [VISUAL_DIAGRAMS.md](VISUAL_DIAGRAMS.md) — architecture flow, including where actions fit in a cycle
- [CODE_PATTERNS.md](CODE_PATTERNS.md) — implementation patterns for writing a new action handler
- [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) — checklist for adding a new action
