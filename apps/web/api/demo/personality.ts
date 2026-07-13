import {
  SPECIMEN_COLD_STORAGE,
  SPECIMEN_NOTEBOOK,
  SPECIMEN_STATE,
  SPECIMEN_SUMMARIES,
  SPECIMEN_REMINDERS,
  type DemoHistoryEntry,
} from './specimen';

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

interface DemoPersonalityContext {
  liveHistory: DemoHistoryEntry[];
  demoBranches: DemoBranch[];
  branchOverrides: () => DemoOverride[];
  branchSynthetics: () => DemoSynthetic[];
  activeBranchName: () => string;
  ensureDemoEditBranch: () => void;
  demoOverrides: Map<string, DemoOverride[]>;
  nowStamp: () => string;
}

interface DemoSnapshotBody {
  name?: unknown;
  description?: unknown;
}

function unwrapSnapshot(body: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const snapshot = body?.snapshot;
  if (snapshot && typeof snapshot === 'object') {
    return snapshot as Record<string, unknown>;
  }
  if (body && typeof body === 'object') {
    return body;
  }
  return null;
}

function isDemoSnapshot(snapshot: Record<string, unknown> | null): boolean {
  return Boolean(
    snapshot &&
      typeof snapshot === 'object' &&
      snapshot.meta &&
      snapshot.memories &&
      snapshot.branches,
  );
}

function collectDemoSnapshotStats(snapshot: Record<string, unknown> | null): Record<string, number> {
  const data = (snapshot || {}) as Record<string, any>;
  return {
    historyCount: Array.isArray(data.memories?.history) ? data.memories.history.length : 0,
    coldStorageCount: Array.isArray(data.memories?.coldStorage)
      ? data.memories.coldStorage.length
      : 0,
    notebookCount: Array.isArray(data.memories?.notebook) ? data.memories.notebook.length : 0,
    observationsCount: Array.isArray(data.memories?.observations)
      ? data.memories.observations.length
      : 0,
    summariesCount: Array.isArray(data.memories?.summaries) ? data.memories.summaries.length : 0,
    remindersCount: Array.isArray(data.memories?.reminders) ? data.memories.reminders.length : 0,
    branchCount: Array.isArray(data.branches?.list) ? data.branches.list.length : 0,
  };
}

export function buildDemoSnapshot(
  body: DemoSnapshotBody | undefined,
  context: DemoPersonalityContext,
): Record<string, unknown> {
  return {
    meta: {
      version: 'demo',
      exportedAt: context.nowStamp(),
      sourceHost: 'demo',
      name: String(body?.name || 'Demo export'),
      description: String(body?.description || ''),
    },
    state: { ...SPECIMEN_STATE },
    memories: {
      history: context.liveHistory,
      coldStorage: SPECIMEN_COLD_STORAGE,
      notebook: SPECIMEN_NOTEBOOK,
      observations: [],
      summaries: SPECIMEN_SUMMARIES,
      reminders: SPECIMEN_REMINDERS,
      imageRefs: [],
    },
    media: {
      profilePicture: null,
      gallery: [],
    },
    branches: {
      list: context.demoBranches,
      overrides: context.branchOverrides(),
      synthetics: context.branchSynthetics(),
      activeBranch: context.activeBranchName(),
    },
    systemPrompt: {
      template: 'default',
      customizations: {},
    },
  };
}

export function handleDemoPersonalityPost(
  endpoint: string,
  body: Record<string, unknown> | undefined,
  context: DemoPersonalityContext,
): Record<string, unknown> {
  const path = endpoint.split('?')[0];

  switch (path) {
    case '/personality/export':
      return buildDemoSnapshot(body, context);
    case '/personality/validate': {
      const snapshot = unwrapSnapshot(body);
      const valid = isDemoSnapshot(snapshot);
      return {
        valid,
        errors: valid ? [] : ['Snapshot format is incomplete'],
        stats: collectDemoSnapshotStats(snapshot),
        estimatedSize: JSON.stringify(snapshot || {}).length,
        demo: true,
      };
    }
    case '/personality/preview': {
      const snapshot = unwrapSnapshot(body);
      if (!isDemoSnapshot(snapshot)) {
        return { error: 'Invalid snapshot format', details: ['Snapshot format is incomplete'] };
      }
      return {
        changes: [],
        warnings: [],
        stats: collectDemoSnapshotStats(snapshot),
        demo: true,
      };
    }
    case '/personality/import': {
      const mode =
        new URLSearchParams(endpoint.split('?')[1] || '').get('mode') ||
        String(body?.mode || 'merge');
      if (mode === 'replace' && !body?.password) {
        return { error: 'password required', demo: true };
      }
      return { success: true, imported: true, mode, demo: true };
    }
    default:
      return { success: true, demo: true };
  }
}

export function handleDemoOverrideDelete(
  endpoint: string,
  context: Pick<
    DemoPersonalityContext,
    'activeBranchName' | 'branchOverrides' | 'demoOverrides'
  >,
): Record<string, unknown> {
  const path = endpoint.split('?')[0];
  const overrideMatch = path.match(/^\/memory\/override\/(\d+)$/);
  if (overrideMatch) {
    const overrideId = Number(overrideMatch[1]);
    const list = context.branchOverrides();
    const next = list.filter((override) => override.id !== overrideId);
    if (next.length === list.length) {
      return { error: 'override not found' };
    }
    context.demoOverrides.set(context.activeBranchName(), next);
    return { success: true, deleted_id: overrideId, demo: true };
  }
  return { success: true, demo: true };
}
