/**
 * Persona routes (platform re-export)
 *
 * @module routes/personas
 * @description Re-exports persona handler functions from @persistence/db/handlers/personas.
 * handleForkPersona remains here (uses Response objects + env.ADMIN_PASSWORD).
 * handleListPersonas/handleCreatePersona are wrapped for platform-specific parameter extraction.
 */

import type { Env } from '../bootstrap.js';

import {
  handleGetActivePersona as _handleGetActivePersona,
  handleGetPersona as _handleGetPersona,
  handleActivatePersona as _handleActivatePersona,
  handleListPersonas as _handleListPersonas,
  handleCreatePersona as _handleCreatePersona,
} from '@persistence/db/handlers/personas';

/**
 * Platform wrappers: maintain (db, request, url, ...) call signatures
 * used by the registry, while the underlying handlers accept clean typed params.
 */
export async function handleGetActivePersona(db: D1Database, request: Request, url: URL) {
  void request;
  void url;
  return _handleGetActivePersona(db);
}

export async function handleGetPersona(db: D1Database, request: Request, url: URL, personaId: string | number) {
  void request;
  void url;
  return _handleGetPersona(db, personaId);
}

export async function handleActivatePersona(db: D1Database, request: Request, url: URL, personaId: string | number) {
  void request;
  void url;
  return _handleActivatePersona(db, personaId);
}

/**
 * Platform wrapper: extracts includeArchived from URL search params.
 */
export async function handleListPersonas(db: D1Database, request: Request, url: URL) {
  void request;
  const includeArchived = url?.searchParams?.get('includeArchived') === 'true';
  return _handleListPersonas(db, includeArchived);
}

/**
 * Platform wrapper: extracts body and admin password from request.
 */
export async function handleCreatePersona(db: D1Database, request: Request, url: URL) {
  void url;
  const expectedPassword = request?.headers?.get('x-internal-admin-password');
  const body = await request.json() as any;
  return _handleCreatePersona(db, body, expectedPassword);
}

interface ForkPersonaBody {
  password?: string;
  newName?: string;
  historyDays?: number;
}

/**
 * POST /personas/:id/fork - Fork a persona with all its memories.
 * Platform-specific: uses Response objects and env.ADMIN_PASSWORD.
 */
export async function handleForkPersona(db: D1Database, request: Request, url: URL, sourceId: string | number, env: Env) {
  void url;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const body = await request.json() as ForkPersonaBody;
    const { password, newName, historyDays } = body;

    if (password !== env.ADMIN_PASSWORD) {
      return Response.json(
        { error: 'Invalid password', code: 'INVALID_PASSWORD' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      return Response.json(
        { error: 'newName is required', code: 'INVALID_NAME' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (newName.trim().length < 2) {
      return Response.json(
        { error: 'newName must be at least 2 characters', code: 'INVALID_NAME' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { forkPersona } = await import('@persistence/db');
    const result = await forkPersona(db, parseInt(String(sourceId), 10), newName.trim(), {
      historyDays: historyDays ?? 90
    });

    if (!result.success) {
      const status = result.code === 'PERSONA_NOT_FOUND' ? 404 :
                     result.code === 'NAME_CONFLICT' ? 409 : 500;
      return Response.json(
        { error: result.error, code: result.code },
        { status, headers: corsHeaders }
      );
    }

    return Response.json(result, { headers: corsHeaders });

  } catch (error: unknown) {
    console.error('Fork persona error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error), code: 'INTERNAL_ERROR' },
      { status: 500, headers: corsHeaders }
    );
  }
}
