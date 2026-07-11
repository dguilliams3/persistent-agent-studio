/**
 * Observatory demo — request router
 *
 * @module api/demo
 * @description Answers the web app's API calls from bundled synthetic
 * fixtures when no worker is configured (see DEMO_MODE in api/client.ts).
 * A fresh `git clone && pnpm dev` renders a living exhibit — the specimen's
 * three-week history — instead of a blank app failing against a placeholder
 * URL. Interactivity is honest theater: visitor messages are echoed into the
 * thread and answered by a script that says it's a script; think-now produces
 * a scripted cycle on the real timing.
 *
 * No network calls leave this module. State is in-memory per page load.
 *
 * @upstream Called by: api/client.ts request()/fetchRaw() when DEMO_MODE
 * @downstream Reads: api/demo/specimen.ts fixtures
 */

import {
  SPECIMEN_HISTORY,
  SPECIMEN_STATE,
  SPECIMEN_PERSONAS,
  SPECIMEN_QUESTIONS,
  SPECIMEN_LEARNED,
  SPECIMEN_NOTEBOOK,
  SPECIMEN_SUMMARIES,
  SPECIMEN_COLD_STORAGE,
  SPECIMEN_REMINDERS,
  SPECIMEN_METERS,
  SPECIMEN_SLEEP_STATUS,
  SPECIMEN_AUTH_STATUS,
  SPECIMEN_SIM_BASIN,
  VISITOR_REPLY_SCRIPT,
  THINK_CYCLE_SCRIPT,
  DEMO_ID_BASE,
  type DemoHistoryEntry,
} from './specimen';

// =============================================================================
// IN-MEMORY INTERACTIVE STATE (per page load)
// =============================================================================

const liveHistory: DemoHistoryEntry[] = [...SPECIMEN_HISTORY];
let interactiveId = DEMO_ID_BASE;
let visitorMessageCount = 0;
let thinkCycleCount = 0;

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function appendEntry(type: string, content: string): DemoHistoryEntry {
  const row: DemoHistoryEntry = {
    id: ++interactiveId,
    type,
    content,
    created_at: nowStamp(),
  };
  liveHistory.push(row);
  return row;
}

/** Schedule an entry to appear after a delay — mimics real cycle timing. */
function appendLater(type: string, content: string, delayMs: number): void {
  setTimeout(() => {
    appendEntry(type, content);
  }, delayMs);
}

// =============================================================================
// ROUTER
// =============================================================================

/** GET routes — exact-prefix matched, first hit wins. */
function demoGet(endpoint: string): Record<string, unknown> {
  const path = endpoint.split('?')[0];

  switch (path) {
    case '/auth/status':
      return SPECIMEN_AUTH_STATUS;
    case '/history': {
      return {
        history: [...liveHistory],
        total: liveHistory.length,
        limit: liveHistory.length,
        offset: 0,
        hasMore: false,
      };
    }
    case '/state':
      return SPECIMEN_STATE;
    case '/personas':
      return SPECIMEN_PERSONAS;
    case '/personas/active':
      return { persona: SPECIMEN_PERSONAS.personas[0] };
    case '/questions':
      return SPECIMEN_QUESTIONS;
    case '/learned':
      return SPECIMEN_LEARNED;
    case '/notebook':
      return SPECIMEN_NOTEBOOK;
    case '/summaries':
      return SPECIMEN_SUMMARIES;
    case '/cold-storage':
      return SPECIMEN_COLD_STORAGE;
    case '/reminders':
      return SPECIMEN_REMINDERS;
    case '/meters':
      return SPECIMEN_METERS;
    case '/sleep-status':
      return SPECIMEN_SLEEP_STATUS;
    case '/observations':
      return { observations: [] };
    case '/branches':
      return { branches: [] };
    case '/memory/synthetic':
      return { syntheticMemories: [] };
    case '/pricing':
      return { pricing: {} };
    case '/model':
      return { model: SPECIMEN_STATE.selectedModel, provider: 'anthropic' };
    case '/interval':
      return { seconds: SPECIMEN_STATE.cycleIntervalSeconds };
    case '/sim/basin':
      return SPECIMEN_SIM_BASIN;
    case '/sim/axes':
      return { axes: [] };
    case '/context':
      return {
        context:
          '[demo] Context assembly runs on the worker in a live deployment — system prompt, meters, recent history, and retrieved memories composed per cycle.',
      };
    default:
      // Unknown reads return an empty object; store fetchers all guard with
      // `|| []` / `|| {}` fallbacks, so views render their empty states.
      return {};
  }
}

/** POST routes — interactive endpoints get scripted behavior. */
function demoPost(
  endpoint: string,
  body: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const path = endpoint.split('?')[0];

  switch (path) {
    case '/auth/login':
      return SPECIMEN_AUTH_STATUS;
    case '/auth/logout':
      return { success: true };
    case '/message': {
      const content = String(body?.content || '') || '📷 image';
      appendEntry('user_message', content);
      const reply =
        VISITOR_REPLY_SCRIPT[visitorMessageCount % VISITOR_REPLY_SCRIPT.length];
      visitorMessageCount += 1;
      // A real reply arrives on the next cycle; the script arrives on a
      // shortened but non-instant delay so the feedback loop reads honestly.
      appendLater('message_to_user', reply, 6_000);
      return { success: true, demo: true };
    }
    case '/sim/basin/compute':
      return { success: true, global: SPECIMEN_SIM_BASIN.global, demo: true };
    case '/think-now': {
      const cycle =
        THINK_CYCLE_SCRIPT[thinkCycleCount % THINK_CYCLE_SCRIPT.length];
      thinkCycleCount += 1;
      appendLater('thought', cycle.thought, 9_000);
      appendLater('message_to_user', cycle.message, 9_400);
      if (cycle.status) {
        appendLater('status_update', cycle.status, 9_800);
      }
      return {
        queued: true,
        demo: true,
        message: 'Demo cycle queued — output arrives in a few seconds',
      };
    }
    default:
      // Writes are accepted and discarded — the exhibit is read-mostly.
      return { success: true, demo: true };
  }
}

/**
 * Entry point used by api/client.ts. Returns after a small latency so the
 * UI's loading states exercise realistically.
 */
export async function demoRequest<T = Record<string, unknown>>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const method = (options.method || 'GET').toUpperCase();
  let parsedBody: Record<string, unknown> | undefined;
  if (typeof options.body === 'string') {
    try {
      parsedBody = JSON.parse(options.body) as Record<string, unknown>;
    } catch {
      parsedBody = undefined;
    }
  } else if (options.body && typeof options.body === 'object') {
    parsedBody = options.body as Record<string, unknown>;
  }

  if (method === 'GET') {
    return demoGet(endpoint) as T;
  }
  return demoPost(endpoint, parsedBody) as T;
}

/** Raw-fetch stand-in: binary/audio features are disabled in the exhibit. */
export async function demoFetchRaw(): Promise<Response> {
  return new Response(JSON.stringify({ error: 'Not available in demo mode' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
