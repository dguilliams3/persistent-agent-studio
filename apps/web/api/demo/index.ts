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
  SPECIMEN_OBSERVATIONS,
  SPECIMEN_FILM_TEST_BRANCH,
  SPECIMEN_CONTEXT_BLOCKS,
  SPECIMEN_METERS,
  SPECIMEN_SLEEP_STATUS,
  SPECIMEN_AUTH_STATUS,
  SPECIMEN_SIM_BASIN,
  SPECIMEN_SIM_TRAJECTORY,
  SPECIMEN_SIM_WEEKLY,
  SPECIMEN_SIM_ANOMALIES,
  VISITOR_REPLY_SCRIPT,
  THINK_CYCLE_SCRIPT,
  DEMO_ID_BASE,
  type DemoHistoryEntry,
} from './specimen';
import {
  handleDemoOverrideDelete,
  handleDemoPersonalityPost,
} from './personality';

// =============================================================================
// IN-MEMORY INTERACTIVE STATE (per page load)
// =============================================================================

const liveHistory: DemoHistoryEntry[] = [...SPECIMEN_HISTORY];
// Mutable copy so DELETE /learned/:id is honest: the Memory tab's in-card
// delete confirmation visibly removes the row instead of "succeeding" while
// the refetch serves the untouched fixture (the FB-02 silent-lie class).
const demoLearned = [...SPECIMEN_LEARNED.learned];
let interactiveId = DEMO_ID_BASE;
let visitorMessageCount = 0;
let thinkCycleCount = 0;
type DemoPersona = (typeof SPECIMEN_PERSONAS.personas)[number];
const demoPersonas: DemoPersona[] = SPECIMEN_PERSONAS.personas.map((persona) => ({
  ...persona,
}));
let demoPersonaId = demoPersonas.reduce(
  (maxId, persona) => Math.max(maxId, persona.id),
  0,
);

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// --- Branch / synthetic-memory / override state (per page load) ---
// The exhibit used to accept-and-discard these writes (silent lie, FB-02):
// Create Branch and Add Synthetic "succeeded" while nothing changed. Now the
// film-test story — inject a memory, watch the thread, rewind by swapping
// back to main — performs honestly against in-memory state.
interface DemoBranch {
  name: string;
  is_active: number;
  description: string | null;
}
interface DemoSynthetic {
  id: number;
  memory_type: string;
  content: string;
  internal: string | null;
  position_timestamp: string | null;
  position_after_id: number | null;
  created_at: string;
}
interface DemoOverride {
  id: number;
  target_table: string;
  target_id: number;
  override_type: string;
  override_data: string | null;
}

const demoBranches: DemoBranch[] = [
  { name: 'main', is_active: 1, description: 'canonical timeline' },
  // Pre-seeded film-test branch: flipping to it shows inline synthetics
  // without the visitor creating anything; flipping back is clean because
  // the rows live only under this branch's key in demoSynthetics.
  {
    name: SPECIMEN_FILM_TEST_BRANCH.name,
    is_active: 0,
    description: SPECIMEN_FILM_TEST_BRANCH.description,
  },
];
const demoSynthetics = new Map<string, DemoSynthetic[]>([
  [SPECIMEN_FILM_TEST_BRANCH.name, [...SPECIMEN_FILM_TEST_BRANCH.synthetics]],
]);
const demoOverrides = new Map<string, DemoOverride[]>();
let demoBranchRowId = 100;

const activeBranchName = () =>
  demoBranches.find((b) => b.is_active === 1)?.name || 'main';

// Mirrors the server: edits/injections made from main auto-divert to a
// dedicated 'edits' branch so main stays pristine (the context resolve
// ignores main overrides, so an edit on main would never apply).
function ensureDemoEditBranch() {
  if (activeBranchName() !== 'main') return;
  if (!demoBranches.some((b) => b.name === 'edits')) {
    demoBranches.push({ name: 'edits', is_active: 0, description: 'edits off main' });
  }
  for (const b of demoBranches) b.is_active = b.name === 'edits' ? 1 : 0;
}
const branchSynthetics = () => {
  const key = activeBranchName();
  if (!demoSynthetics.has(key)) demoSynthetics.set(key, []);
  return demoSynthetics.get(key)!;
};
const branchOverrides = () => {
  const key = activeBranchName();
  if (!demoOverrides.has(key)) demoOverrides.set(key, []);
  return demoOverrides.get(key)!;
};

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
  const [path, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);

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
    // Model registry fixture — same shape as the worker's D1-backed GET /models,
    // so the CreatePersonaModal's Mind picker works in the exhibit.
    case '/models':
      return {
        models: [
          { id: 'claude-haiku-4-5', label: 'Haiku (Fast)', provider: 'anthropic', tier: 'fast' },
          { id: 'claude-sonnet-4-6', label: 'Sonnet (Balanced)', provider: 'anthropic', tier: 'balanced' },
          { id: 'claude-opus-4-6', label: 'Opus (Deep)', provider: 'anthropic', tier: 'deep' },
        ],
        defaultId: 'claude-opus-4-6',
        // Must agree with SPECIMEN_STATE.selectedModel — /state, /model, and
        // /models are three views of one selection.
        selectedModel: SPECIMEN_STATE.selectedModel,
        source: 'demo',
      };
    case '/personas':
      return { personas: demoPersonas };
    case '/personas/active':
      return {
        persona:
          demoPersonas.find((persona) => persona.isActive) || demoPersonas[0] || null,
      };
    case '/questions':
      return SPECIMEN_QUESTIONS;
    case '/learned':
      return { learned: [...demoLearned] };
    case '/notebook':
      return SPECIMEN_NOTEBOOK;
    case '/summaries':
      return SPECIMEN_SUMMARIES;
    // Summary tier thresholds — read by the Memory tab's SummariesSection
    // (useSummaryConfig) every time the section mounts. Values match the
    // boundaries the Efficiencies page states (8K summary-tail threshold),
    // so the exhibit cannot disagree with its own documentation. Without
    // this fixture the Memory walk warned "[demo] no fixture" on every
    // section visit.
    case '/summary-config':
      return {
        tailTokenThreshold: 8000,
        tailTokenTarget: 4000,
        contextSize: 10,
        bufferSize: 15,
        demo: true,
      };
    case '/cold-storage':
      return SPECIMEN_COLD_STORAGE;
    case '/reminders':
      return SPECIMEN_REMINDERS;
    case '/meters':
      return SPECIMEN_METERS;
    case '/sleep-status':
      return SPECIMEN_SLEEP_STATUS;
    case '/observations':
      return { observations: SPECIMEN_OBSERVATIONS };
    // RAG runs against a live deployment's embeddings — the exhibit has none,
    // and says so (RAGPreview renders honest demo copy off this flag) instead
    // of pointing at a Settings toggle that goes nowhere here.
    case '/rag':
      return { enabled: false, mmrLambda: 0.7, demo: true };
    case '/gallery': {
      // The Media tab reads /gallery; the chat thread renders images off a
      // history entry's `internal`. With no /gallery route the demo answered
      // {} here, so the tab said "No media yet" while the specimen's drawing
      // was plainly visible in the thread — one exhibit contradicting itself.
      // Derived from liveHistory rather than a second fixture, so the two
      // surfaces cannot drift apart again.
      return {
        images: liveHistory
          .filter(
            (row) =>
              typeof row.internal === 'string' &&
              row.internal.startsWith('data:image'),
          )
          .map((row) => ({
            id: row.id,
            type: 'art',
            image: row.internal,
            prompt: row.content,
            createdAt: row.created_at,
            blurred: false,
            vaulted: false,
          }))
          .reverse(),
      };
    }
    case '/branches':
      return {
        branches: demoBranches,
        activeBranch: activeBranchName(),
        count: demoBranches.length,
      };
    case '/memory/overrides':
      return {
        overrides: branchOverrides(),
        branchName: activeBranchName(),
      };
    case '/memory/synthetic':
      return {
        synthetics: branchSynthetics(),
        syntheticMemories: branchSynthetics(),
      };
    case '/pricing':
      return { pricing: {} };
    case '/model':
      return { model: SPECIMEN_STATE.selectedModel, provider: 'anthropic' };
    case '/interval':
      return { seconds: SPECIMEN_STATE.cycleIntervalSeconds };
    case '/sim/basin':
      return SPECIMEN_SIM_BASIN;
    case '/sim/basin/trajectory': {
      // Honors the same query params as handleGetTrajectory so the
      // Trajectory view's type filter and limit selector behave honestly.
      const limit = Math.min(Math.max(1, Number(params.get('limit')) || 100), 500);
      const entryTypes = (params.get('entryTypes') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const points = SPECIMEN_SIM_TRAJECTORY.points
        .filter((p) => entryTypes.length === 0 || entryTypes.includes(p.type))
        .slice(0, limit);
      return { points, metrics: SPECIMEN_SIM_TRAJECTORY.metrics };
    }
    case '/sim/basin/weekly': {
      const type = params.get('type')?.trim() || '';
      const weekly = SPECIMEN_SIM_WEEKLY[type];
      if (!weekly) {
        return {
          success: false,
          error: 'type must be one of thought, message_to_user, user_message',
        };
      }
      return weekly;
    }
    case '/sim/anomalies':
      return { anomalies: SPECIMEN_SIM_ANOMALIES };
    case '/sim/export':
      // handleSimExport's shape: trajectory rows + camelCase anomaly rows.
      return {
        exportedAt: new Date().toISOString(),
        format: 'sim-export-v1',
        basinMetrics: SPECIMEN_SIM_BASIN.global,
        axes: [],
        axisScores: [],
        trajectory: SPECIMEN_SIM_TRAJECTORY.points,
        anomalies: SPECIMEN_SIM_ANOMALIES.map((a) => ({
          id: a.id,
          targetTable: a.target_table,
          targetId: a.target_id,
          basinDistance: a.basin_distance,
          zScore: a.z_score,
          flaggedAxes: a.flagged_axes,
          detectionMethod: a.detection_method,
          inspected: a.inspected,
          verdict: a.verdict,
          createdAt: a.created_at,
        })),
        demo: true,
      };
    case '/sim/axes':
      return { axes: [] };
    case '/context': {
      // Mirrors the real GET /context (platforms/cloudflare routes/registry.ts):
      // {systemPrompt, stats: {...counts, tokenBreakdown}, characterCount}.
      // The old fixture returned a prose string under a key nothing reads, so
      // the Memory tab's ContextBar/BlockVisualization starved on {}. Block
      // sizes are authored (specimen.ts SPECIMEN_CONTEXT_BLOCKS, consistent
      // with the Efficiencies boundaries); the sums are computed here and the
      // counts are derived from the fixtures themselves, so no surface can
      // disagree with another about how much of anything exists.
      const blocks = SPECIMEN_CONTEXT_BLOCKS;
      const cachedTokens =
        blocks.block1_system + blocks.block2_stable + blocks.block3_summariesPrefix;
      const totalTokens = cachedTokens + blocks.block4_fresh;
      const systemPrompt =
        '[demo] In a live deployment this field carries the full assembled system prompt — constitution, meters, memory blocks, recent history. The exhibit serves the real block accounting below without staging a fake prompt text.';
      return {
        systemPrompt,
        stats: {
          historyCount: liveHistory.length,
          summariesCount: SPECIMEN_SUMMARIES.active.length,
          remindersCount: SPECIMEN_REMINDERS.reminders.length,
          coldStorageCount: SPECIMEN_COLD_STORAGE.coldStorage.length,
          learnedCount: SPECIMEN_LEARNED.learned.length,
          questionsCount: SPECIMEN_QUESTIONS.questions.length,
          notebookCount: SPECIMEN_NOTEBOOK.notebook.length,
          observationsCount: SPECIMEN_OBSERVATIONS.length,
          imagesCount: 0,
          // Same census /gallery reports — derived, not restated.
          claudeArtCount: liveHistory.filter(
            (row) =>
              typeof row.internal === 'string' && row.internal.startsWith('data:image'),
          ).length,
          activeBranch: activeBranchName(),
          ragRetrievedCount: 0,
          ragRetrievedSummaries: [],
          estimatedInputTokens: totalTokens,
          estimatedOutputTokens: 300,
          ragTokens: 0,
          tokenBreakdown: {
            block1_system: blocks.block1_system,
            block2_stable: blocks.block2_stable,
            block3_summariesPrefix: blocks.block3_summariesPrefix,
            block4_fresh: blocks.block4_fresh,
            ragArchive: 0,
            total: totalTokens,
            cachedTokens,
            uncachedTokens: blocks.block4_fresh,
          },
          cacheStrategy: 'blocks',
        },
        characterCount: systemPrompt.length,
        demo: true,
      };
    }
    default:
      // Unknown reads return an empty object; store fetchers all guard with
      // `|| []` / `|| {}` fallbacks, so views render their empty states.
      //
      // That silence is why several "empty surface" bugs went unnoticed for
      // weeks: an unfixtured endpoint is indistinguishable from a fixture that
      // legitimately has nothing in it. Say so out loud in dev — a surface that
      // looks empty in the exhibit should be a deliberate choice, not an
      // endpoint nobody wrote.
      if (import.meta.env?.DEV) {
        console.warn(
          `[demo] no fixture for GET ${endpoint} — returning {}. ` +
            'Any view reading this endpoint will render its empty state.',
        );
      }
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
      // One beat, not a simulated think. This reply is a string already in
      // memory; the only thing the delay has to buy is a moment where the sent
      // bubble and the pending affordance are both legible before the answer
      // lands. Anything longer is a pause pretending to be deliberation — and
      // the exhibit's own pending copy says outright that nothing is thinking.
      // (Think-now keeps its ~9s: that one is deliberately reproducing real
      // cycle timing, and its script tells you the pause is the honest part.)
      appendLater('message_to_user', reply, 1_200);
      return { success: true, demo: true };
    }
    case '/sim/basin/compute':
      return {
        success: true,
        global: SPECIMEN_SIM_BASIN.global,
        perType: SPECIMEN_SIM_BASIN.perType,
        crossType: SPECIMEN_SIM_BASIN.crossType,
        computedAt: SPECIMEN_SIM_BASIN.global.computedAt,
        demo: true,
      };
    case '/sim/direction/compute': {
      // Contract mirrors handleComputeDirection: {success, direction:
      // {magnitude, poleACount, poleBCount, poleA, poleB}, projections}.
      // The exhibit has no embeddings, so projections are scripted: pole
      // members anchor the ends, everything else spreads deterministically.
      const poleA = (body?.poleA as Array<{ id: number }> | undefined) ?? [];
      const poleB = (body?.poleB as Array<{ id: number }> | undefined) ?? [];
      if (poleA.length === 0) {
        return { success: false, error: 'Pole A requires at least one anchor entry' };
      }
      if (poleB.length === 0) {
        return { success: false, error: 'Pole B requires at least one anchor entry' };
      }
      const aIds = new Set(poleA.map((anchor) => anchor.id));
      const bIds = new Set(poleB.map((anchor) => anchor.id));
      const spread = (id: number) => (((id * 31) % 17) / 17) * 1.3 - 0.65;
      const jitter = (id: number) => ((id * 7) % 5) * 0.012;
      const projections = SPECIMEN_SIM_TRAJECTORY.points
        .map((p) => ({
          id: p.id,
          table: 'history',
          type: p.type,
          projection: Number(
            (aIds.has(p.id)
              ? -0.85 + jitter(p.id)
              : bIds.has(p.id)
                ? 0.85 - jitter(p.id)
                : spread(p.id)
            ).toFixed(4),
          ),
          timestamp: p.timestamp,
          content: p.content,
        }))
        .sort((a, b) => a.projection - b.projection);
      return {
        success: true,
        demo: true,
        direction: {
          magnitude: 0.4183,
          poleACount: poleA.length,
          poleBCount: poleB.length,
          poleA,
          poleB,
        },
        projections,
      };
    }
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
    case '/branches': {
      const name = String(body?.name || '').trim();
      if (!name || demoBranches.some((b) => b.name === name)) {
        return { error: 'branch name required and must be unique' };
      }
      demoBranches.push({ name, is_active: 0, description: null });
      return { success: true, demo: true };
    }
    case '/memory/synthetic': {
      ensureDemoEditBranch();
      const row: DemoSynthetic = {
        id: ++demoBranchRowId,
        memory_type: String(body?.type || 'user_message'),
        content: String(body?.content || ''),
        internal: (body?.internal as string) || null,
        position_timestamp: (body?.timestamp as string) || null,
        position_after_id: (body?.afterId as number) || null,
        created_at: nowStamp(),
      };
      branchSynthetics().push(row);
      return { success: true, id: row.id, demo: true };
    }
    case '/memory/edit': {
      ensureDemoEditBranch();
      const targetId = Number(body?.id);
      if (!targetId) return { error: 'id required' };
      const list = branchOverrides();
      const existing = list.find(
        (o) => o.target_id === targetId && o.override_type === 'edit',
      );
      const data = JSON.stringify({ content: String(body?.content || '') });
      if (existing) existing.override_data = data;
      else
        list.push({
          id: ++demoBranchRowId,
          target_table: 'history',
          target_id: targetId,
          override_type: 'edit',
          override_data: data,
        });
      return { success: true, demo: true };
    }

    case '/personality/export':
    case '/personality/validate':
    case '/personality/preview':
    case '/personality/import':
      return handleDemoPersonalityPost(endpoint, body, {
        liveHistory,
        demoBranches,
        branchOverrides,
        branchSynthetics,
        activeBranchName,
        ensureDemoEditBranch,
        demoOverrides,
        nowStamp,
      });

    case '/personas': {
      const name = String(body?.name || '').trim();
      if (!name) return { error: 'name required' };

      const persona: DemoPersona = {
        id: ++demoPersonaId,
        name,
        isActive: true,
        created_at: nowStamp(),
        description: String(body?.description || ''),
      };
      for (const existing of demoPersonas) existing.isActive = false;
      demoPersonas.push(persona);
      return { success: true, persona, demo: true };
    }
    default: {
      // PUT /branches/:name/activate — branch swap
      const activate = path.match(/^\/branches\/([^/]+)\/activate$/);
      if (activate) {
        const name = decodeURIComponent(activate[1]);
        if (!demoBranches.some((b) => b.name === name)) {
          return { error: 'unknown branch' };
        }
        for (const b of demoBranches) b.is_active = b.name === name ? 1 : 0;
        return { success: true, activeBranch: name, demo: true };
      }
      const activatePersona = path.match(/^\/personas\/(\d+)\/activate$/);
      if (activatePersona) {
        const personaId = Number(activatePersona[1]);
        const persona = demoPersonas.find((candidate) => candidate.id === personaId);
        if (!persona) {
          return { error: 'unknown persona' };
        }
        for (const existing of demoPersonas) existing.isActive = existing.id === personaId;
        return { success: true, persona, demo: true };
      }
      // Other writes remain read-mostly; personas and branch swaps are handled honestly above.
      return { success: true, demo: true };
    }
  }
}

/** DELETE routes — targeted undo and cleanup actions. */
function demoDelete(endpoint: string): Record<string, unknown> {
  const path = endpoint.split('?')[0];

  // DELETE /memory/synthetic/:id — the delete confirmation in the Memory Lab
  // used to fall through to the blanket `{success: true}` while the branch
  // Map kept the row, so the refetched list came back unchanged (the FB-02
  // silent-lie class, on the delete verb). Splice for real.
  const syntheticMatch = path.match(/^\/memory\/synthetic\/(\d+)$/);
  if (syntheticMatch) {
    const syntheticId = Number(syntheticMatch[1]);
    const list = branchSynthetics();
    const index = list.findIndex((synthetic) => synthetic.id === syntheticId);
    if (index === -1) {
      return { error: 'synthetic memory not found' };
    }
    list.splice(index, 1);
    return { success: true, deleted_id: syntheticId, demo: true };
  }

  // DELETE /learned/:id — same honesty for the Learnings card's confirm strip.
  const learnedMatch = path.match(/^\/learned\/(\d+)$/);
  if (learnedMatch) {
    const learnedId = Number(learnedMatch[1]);
    const index = demoLearned.findIndex((row) => row.id === learnedId);
    if (index === -1) {
      return { error: 'learned entry not found' };
    }
    demoLearned.splice(index, 1);
    return { success: true, deleted_id: learnedId, demo: true };
  }

  return handleDemoOverrideDelete(endpoint, {
    activeBranchName,
    branchOverrides,
    demoOverrides,
  });
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
  if (method === 'DELETE') {
    return demoDelete(endpoint) as T;
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
