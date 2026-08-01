/**
 * Glossary API Routes
 *
 * @description REST endpoints for managing STT glossary entries.
 *   Glossary stores wrong→correct mappings for speech-to-text corrections.
 *
 * @upstream Called by: index.js handleRequest()
 * @downstream Calls: db/glossary.js functions
 *
 * Endpoints:
 *   GET  /glossary           - List all glossary entries
 *   POST /glossary           - Add new entry
 *   GET  /glossary/:id       - Get single entry
 *   PUT  /glossary/:id       - Update entry
 *   DELETE /glossary/:id     - Delete entry (requires admin password)
 *   GET  /glossary/prompt    - Get formatted prompt string for WhisperX
 */

import {
  getGlossaryEntries,
  getGlossaryEntry,
  addGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  getGlossaryPrompt
} from '../db/glossary.js';
import type { Env } from '../bootstrap.js';

/**
 * @description Handle GET /glossary - list all entries
 *
 * @param {D1Database} db - D1 database instance
 * @param {URL} url - Request URL for query params
 * @returns {Response} JSON array of glossary entries
 */
export async function handleGetGlossary(db: D1Database, url: URL) {
  const forPrompt = url.searchParams.get('forPrompt') === 'true';
  const forReplace = url.searchParams.get('forReplace') === 'true';

  const entries = await getGlossaryEntries(db, { forPrompt, forReplace });

  return new Response(JSON.stringify({ entries, count: entries.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle POST /glossary - add new entry
 *
 * @param {D1Database} db - D1 database instance
 * @param {Request} request - Request with JSON body
 * @returns {Response} Created entry
 */
export async function handlePostGlossary(db: D1Database, request: Request) {
  const body = await request.json() as { wrong_form?: string; correct_form?: string; category?: string };

  if (!body.wrong_form || !body.correct_form) {
    return new Response(
      JSON.stringify({ error: 'wrong_form and correct_form are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const entry = await addGlossaryEntry(
      db,
      body.wrong_form.trim(),
      body.correct_form.trim(),
      body.category || 'name'
    );

    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message?.includes('UNIQUE')) {
      return new Response(
        JSON.stringify({ error: 'Entry for this wrong_form already exists' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw error;
  }
}

/**
 * @description Handle GET /glossary/:id - get single entry
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Entry ID from URL
 * @returns {Response} Single entry or 404
 */
export async function handleGetGlossaryEntry(db: D1Database, id: string) {
  const entry = await getGlossaryEntry(db, parseInt(id));

  if (!entry) {
    return new Response(
      JSON.stringify({ error: 'Entry not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(entry), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle PUT /glossary/:id - update entry
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Entry ID from URL
 * @param {Request} request - Request with JSON body
 * @returns {Response} Success or error
 */
export async function handlePutGlossary(db: D1Database, id: string, request: Request) {
  const body = await request.json() as { wrong_form?: string; correct_form?: string; category?: string; use_in_prompt?: boolean; use_in_replace?: boolean };

  const success = await updateGlossaryEntry(db, parseInt(id), {
    wrong_form: body.wrong_form,
    correct_form: body.correct_form,
    category: body.category,
    use_in_prompt: body.use_in_prompt,
    use_in_replace: body.use_in_replace,
  });

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Entry not found or no changes made' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle DELETE /glossary/:id - delete entry with admin password
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Entry ID from URL
 * @param {Request} request - Request with JSON body containing admin password
 * @param {Object} env - Environment bindings for auth secrets
 * @returns {Response} Success or error
 */
export async function handleDeleteGlossary(db: D1Database, id: string, request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (body.password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: 'Invalid password' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const success = await deleteGlossaryEntry(db, parseInt(id));

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Entry not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle GET /glossary/prompt - get WhisperX prompt string
 *
 * @param {D1Database} db - D1 database instance
 * @returns {Response} JSON with prompt string
 */
export async function handleGetGlossaryPrompt(db: D1Database) {
  const prompt = await getGlossaryPrompt(db);

  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
}


