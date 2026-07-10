/**
 * Knowledge handler functions (learned facts + open questions)
 *
 * @module @persistence/db/handlers/knowledge
 * @description Pure handler functions for entity self-knowledge endpoints.
 * Accept typed params and db, return response-ready shapes.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db knowledge functions
 */

import type { DrizzleD1 } from '../client';

import {
  getLearned,
  addLearned,
  updateLearned,
  deleteLearned,
  getQuestions,
  addQuestion,
  addNote as addQuestionNote,
  resolveQuestion,
  dissolveQuestion,
  type LearnedConfidence,
} from '../index';


// --- Learned Facts ---

/**
 * GET /learned - Returns all learned facts for the active entity
 *
 * @downstream getLearned — reads from learned table
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern read-only-query — no mutations; returns raw learned fact rows
 * @antipattern Do NOT mix learned facts with cold storage — learned is for entity self-knowledge, cold storage is for frozen memories
 */
export async function handleGetLearned(db: DrizzleD1) {
  return { learned: await getLearned(db) };
}

/**
 * POST /learned - Adds or updates a learned fact
 *
 * @downstream addLearned — inserts new fact; updateLearned — patches existing fact by id
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern upsert-by-id — body.id present → update; body.id absent + body.content present → insert
 * @antipattern Do NOT call addLearned with an existing id — check for id first and route to updateLearned
 */
export async function handlePostLearned(db: DrizzleD1, body: Record<string, unknown>) {
  try {
    if (body.id) {
      const updates: Record<string, unknown> = {};
      if (body.content) updates.content = body.content;
      if (body.confidence) updates.confidence = body.confidence;
      await updateLearned(db, body.id as number, updates);
      return { success: true };
    } else if (body.content) {
      const result = await addLearned(db, body.content as string, body.confidence as LearnedConfidence | undefined, body.supporting as string | undefined);
      return { success: true, id: result.id };
    } else {
      return { success: false, error: 'content required for new entries', status: 400 };
    }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), status: 500 };
  }
}

/**
 * DELETE /learned/:id - Deletes a learned fact by id (password protected)
 *
 * @downstream deleteLearned — removes learned row by primary key
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern admin-guarded-delete — password required; returns 404 if fact not found
 * @antipattern Do NOT delete learned facts casually — they represent accumulated entity knowledge
 */
export async function handleDeleteLearned(db: DrizzleD1, id: number, password: string, adminPassword: string) {
  if (password !== adminPassword) {
    return { error: 'Invalid password', status: 401 };
  }
  const result = await deleteLearned(db, id);
  if (result) {
    return { success: true, deleted_id: id };
  } else {
    return { error: 'Learning not found or already deleted', status: 404 };
  }
}

// --- Open Questions ---

/**
 * GET /questions - Returns all open questions the entity is exploring
 *
 * @downstream getQuestions — reads from questions table filtered to non-dissolved, non-resolved entries
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern read-only-query — no mutations; returns questions with their notes
 * @antipattern Do NOT filter questions by persona_id here — questions are currently global entity-level
 */
export async function handleGetQuestions(db: DrizzleD1) {
  return { questions: await getQuestions(db) };
}

export async function handlePostQuestion(db: DrizzleD1, body: Record<string, unknown>) {
  try {
    const operation = body.op || 'add';

    switch (operation) {
      case 'add': {
        if (!body.content) {
          return { success: false, error: 'content required for add', status: 400 };
        }
        const result = await addQuestion(db, body.content as string, (body.domain as string) ?? null);
        return { success: true, id: result.id };
      }

      case 'note': {
        if (!body.id) {
          return { success: false, error: 'id required for note', status: 400 };
        }
        if (!body.note) {
          return { success: false, error: 'note content required', status: 400 };
        }
        await addQuestionNote(db, body.id as number, body.note as string, (body.set_exploring as boolean) ?? false);
        return { success: true };
      }

      case 'resolve': {
        if (!body.id) {
          return { success: false, error: 'id required for resolve', status: 400 };
        }
        await resolveQuestion(db, body.id as number, (body.resolved_into as string) ?? null);
        return { success: true };
      }

      case 'dissolve': {
        if (!body.id) {
          return { success: false, error: 'id required for dissolve', status: 400 };
        }
        await dissolveQuestion(db, body.id as number, (body.reason as string) ?? null);
        return { success: true };
      }

      case 'list': {
        const questions = await getQuestions(db);
        return { success: true, questions };
      }

      default:
        return { success: false, error: `Unknown op: ${operation}`, status: 400 };
    }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), status: 500 };
  }
}
