/**
 * Model registry — the fleet of valid models lives in D1, not constants.
 *
 * @module @persistence/db/model-registry
 * @description Doctrine I1 (config-as-data doctrine: models live in D1): which models exist, their labels, and the default are DATA
 * in the global `config` table (key `model_registry`), seeded once from platform
 * constants and thereafter editable with NO redeploy. Feature code validates and
 * resolves against THIS, never against hardcoded triples (the retired
 * hardcoded `validModels` list).
 *
 * Resolution ladder (one place, exported, tested):
 *   options.model  >  personas.model (active persona)  >  state selected_model
 *   >  registry defaultId
 *
 * @upstream Called by: routes registry (GET /models, POST /model, POST /personas),
 *   @persistence/runtime orchestrator prechecks (resolveProviderConfig)
 * @downstream Calls: Drizzle config table, getPersona/getActivePersonaId, getState
 * @pattern self-healing-seed — absent/malformed registry row is rewritten from the
 *   caller-supplied seed and logged loudly (I9: config failures must not be silent)
 * @antipattern Do NOT import platform constants here — the SEED is passed in by the
 *   platform layer; this package stays constant-free
 * Tests: packages/db/src/model-registry.test.ts
 */

import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1 } from './client';
import { config } from './schema/config';
import { getActivePersonaId } from './persona-scope';
import { getPersona } from './personas';
import { getState } from './state';

export interface ModelRegistryEntry {
  /** Provider model id, e.g. "claude-opus-4-6" */
  id: string;
  /** Human label for pickers, e.g. "Opus (Deep)" */
  label: string;
  /** Provider key, e.g. "anthropic" | "openai" */
  provider: string;
  /** Optional tier hint for UIs, e.g. "fast" | "balanced" | "deep" */
  tier?: string;
}

export interface ModelRegistry {
  models: ModelRegistryEntry[];
  defaultId: string;
}

const REGISTRY_KEY = 'model_registry';

/**
 * Validates an unknown parsed value into a ModelRegistry, or null.
 * Pure — exported for tests and for the platform seed's own sanity check.
 */
export function parseModelRegistry(raw: unknown): ModelRegistry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as { models?: unknown; defaultId?: unknown };
  if (!Array.isArray(candidate.models) || candidate.models.length === 0) return null;
  if (typeof candidate.defaultId !== 'string' || !candidate.defaultId) return null;
  const models: ModelRegistryEntry[] = [];
  for (const m of candidate.models) {
    if (!m || typeof m !== 'object') return null;
    const entry = m as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !entry.id) return null;
    if (typeof entry.label !== 'string' || typeof entry.provider !== 'string') return null;
    models.push({
      id: entry.id,
      label: entry.label,
      provider: entry.provider,
      ...(typeof entry.tier === 'string' ? { tier: entry.tier } : {}),
    });
  }
  if (!models.some((m) => m.id === candidate.defaultId)) return null;
  return { models, defaultId: candidate.defaultId };
}

/**
 * Reads the registry from config, self-healing from `seed` when the row is
 * absent or malformed (malformed is logged loudly — I9).
 */
export async function getModelRegistry(
  db: DrizzleD1,
  seed: ModelRegistry,
): Promise<ModelRegistry> {
  const row = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, REGISTRY_KEY))
    .get();

  if (row?.value) {
    try {
      const parsed = parseModelRegistry(JSON.parse(row.value));
      if (parsed) return parsed;
      console.warn('[model-registry] malformed registry in config — re-seeding from constants');
    } catch {
      console.warn('[model-registry] unparseable registry JSON in config — re-seeding from constants');
    }
  }

  await setModelRegistry(db, seed);
  return seed;
}

/** Writes the registry (upsert). Operator edits normally happen directly in D1. */
export async function setModelRegistry(db: DrizzleD1, registry: ModelRegistry): Promise<void> {
  const value = JSON.stringify(registry);
  await db
    .insert(config)
    .values({ key: REGISTRY_KEY, value, updatedAt: sql`datetime('now')` })
    .onConflictDoUpdate({
      target: config.key,
      set: { value, updatedAt: sql`datetime('now')` },
    });
}

/** True when `id` is a model the registry knows. */
export async function isRegisteredModel(
  db: DrizzleD1,
  id: string,
  seed: ModelRegistry,
): Promise<boolean> {
  const registry = await getModelRegistry(db, seed);
  return registry.models.some((m) => m.id === id);
}

/**
 * The priority decision, pure and total — first non-empty wins.
 * Exported separately so the ladder's SEMANTICS are pinned by fast pure tests
 * while the async wrapper below just gathers inputs.
 */
export function pickEffectiveModel(inputs: {
  optionsModel?: string | null;
  personaModel?: string | null;
  stateModel?: string | null;
  defaultId: string;
}): string {
  return (
    (inputs.optionsModel && inputs.optionsModel.trim()) ||
    (inputs.personaModel && inputs.personaModel.trim()) ||
    (inputs.stateModel && inputs.stateModel.trim()) ||
    inputs.defaultId
  );
}

/**
 * Full ladder: options.model > active persona's model > state selected_model >
 * registry default. `optionsModel` is trusted as-is (caller-supplied override);
 * persona/state values that are no longer registered fall through to the next
 * rung rather than silently running an unknown model (loud skip via console.warn).
 */
export async function resolveEffectiveModel(
  db: DrizzleD1,
  args: { optionsModel?: string | null; seed: ModelRegistry },
): Promise<string> {
  const registry = await getModelRegistry(db, args.seed);
  const known = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (registry.models.some((m) => m.id === id)) return id;
    console.warn(`[model-registry] configured model "${id}" is not in the registry — falling through`);
    return null;
  };

  if (args.optionsModel && args.optionsModel.trim()) return args.optionsModel.trim();

  const personaId = await getActivePersonaId(db);
  const persona = await getPersona(db, personaId);
  const personaModel = known((persona as { model?: string | null } | null)?.model ?? null);
  if (personaModel) return personaModel;

  const stateModel = known((await getState(db, 'selected_model')) ?? null);
  if (stateModel) return stateModel;

  return registry.defaultId;
}
