/**
 * Persona management handler functions
 *
 * @module @persistence/db/handlers/personas
 * @description Pure handler functions for persona management endpoints.
 * Accept typed params and db, return response-ready shapes.
 *
 * Note: handleForkPersona stays in platform (uses Response objects + env.ADMIN_PASSWORD).
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db persona functions
 */

import { sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { personas } from '../schema/personas';

import {
  getActivePersonaId,
  setActivePersonaId,
  getPersona,
  listPersonas,
} from '../index';


const SYSTEM_PROMPT_TEMPLATES = new Set(['clio-v1', 'blank', 'minimal']);

interface CreatePersonaBody {
  password?: string;
  slug?: string;
  name?: string;
  systemPromptTemplate?: string;
  operatorContextId?: number;
  forkedFromId?: number;
}

/**
 * GET /personas - List personas and highlight the active one
 */
export async function handleListPersonas(db: DrizzleD1, includeArchived = false) {
  const personas = await listPersonas(db, includeArchived);
  const activePersonaId = await getActivePersonaId(db);

  return {
    personas: personas.map((persona: any) => ({
      ...persona,
      isActive: persona.id === activePersonaId
    })),
    activePersonaId,
    count: personas.length
  };
}

/**
 * GET /personas/active - Fetch the active persona metadata
 */
export async function handleGetActivePersona(db: DrizzleD1) {
  const activePersonaId = await getActivePersonaId(db);
  const persona = await getPersona(db, activePersonaId);
  return {
    activePersonaId,
    persona: persona || null
  };
}

/**
 * GET /personas/:id - Fetch a persona by id
 */
export async function handleGetPersona(db: DrizzleD1, personaId: string | number) {
  const normalized = Number(personaId);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return { error: 'Invalid persona ID', code: 'INVALID_PERSONA_ID', status: 400 };
  }

  const persona = await getPersona(db, normalized);
  if (!persona) {
    return { error: 'Persona not found', code: 'PERSONA_NOT_FOUND', status: 404 };
  }

  return { persona };
}

/**
 * POST /personas - Create a new persona (password protected)
 */
export async function handleCreatePersona(db: DrizzleD1, body: CreatePersonaBody, expectedPassword: string | null) {
  if (!expectedPassword) {
    return {
      error: 'Persona creation is disabled (missing admin password guard)',
      code: 'PERSONA_CREATION_LOCKED',
      status: 503
    };
  }

  if (body.password !== expectedPassword) {
    return { error: 'Invalid password', code: 'INVALID_PASSWORD', status: 401 };
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug must be lowercase alphanumeric with dashes', status: 400, code: 'INVALID_SLUG' };
  }

  const template = typeof body.systemPromptTemplate === 'string' ? body.systemPromptTemplate.trim() : '';
  if (!SYSTEM_PROMPT_TEMPLATES.has(template)) {
    return {
      error: `systemPromptTemplate must be one of: ${[...SYSTEM_PROMPT_TEMPLATES].join(', ')}`,
      status: 400,
      code: 'INVALID_TEMPLATE'
    };
  }

  const existing = await listPersonas(db, true);
  if (existing.some((persona: any) => persona.slug === slug)) {
    return { error: `Slug '${slug}' already exists`, status: 409, code: 'SLUG_CONFLICT' };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : null;
  const parsedOperatorContextId = Number(body.operatorContextId);
  const operatorContextId = Number.isFinite(parsedOperatorContextId) ? parsedOperatorContextId : null;
  const parsedForkedFromId = Number(body.forkedFromId);
  const forkedFromId = Number.isFinite(parsedForkedFromId) ? parsedForkedFromId : null;

  const now = sql`datetime('now')`;
  const insertResult = await db.insert(personas).values({
    name: name || slug,
    slug,
    systemPromptTemplate: template,
    operatorContextId: operatorContextId != null ? String(operatorContextId) : null,
    forkedFromId,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: personas.id });

  const newPersonaId = insertResult[0]?.id || existing.length + 1;
  const persona = await getPersona(db, newPersonaId);

  return {
    success: true,
    persona: persona || {
      id: newPersonaId,
      name,
      slug,
      systemPromptTemplate: template,
      operatorContextId,
      forkedFromId,
      archivedAt: null
    }
  };
}

/**
 * PUT /personas/:id/activate - Switch the active persona id
 */
export async function handleActivatePersona(db: DrizzleD1, personaId: string | number) {
  const normalized = Number(personaId);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return { error: 'Invalid persona ID', code: 'INVALID_PERSONA_ID', status: 400 };
  }

  const persona = await getPersona(db, normalized);
  if (!persona) {
    return { error: 'Persona not found', code: 'PERSONA_NOT_FOUND', status: 404 };
  }

  await setActivePersonaId(db, normalized);
  return { success: true, activePersonaId: normalized, persona };
}
