/**
 * Status levels for question entries.
 * Questions move through these states as they evolve.
 *
 * Status lifecycle:
 *   open → exploring → resolved | dissolved | deleted
 *
 *   - open: newly added, not yet investigated
 *   - exploring: actively being researched in a thinking cycle
 *   - resolved: answered — the question has a clear conclusion
 *   - dissolved: the question turned out to be moot or ill-formed
 *   - deleted: soft-deleted by the user or a scoped-query cleanup;
 *              record is retained for append-only audit purposes
 *
 * @module @persistence/db/llm-storage/QuestionStatus
 * @upstream Called by:
 *   - llm-storage/questions.ts
 *   - llm-storage/QuestionEntry.ts
 *   - llm-storage/index.ts
 * @downstream Consumed by: @persistence/runtime context assembly, frontend question list views
 * @pattern union-type-as-state-machine — exhaustive status union enforced by TypeScript; add new
 *   states here and compiler will surface every switch that needs updating
 * @antipattern DO NOT store status as a bare string in application code — always import this type
 *   so new states are caught at compile time
 * @invariant 'deleted' entries are never physically removed — the append-only history constraint
 *   applies; filter them out in read queries rather than issuing DELETE statements
 */

export type QuestionStatus = 'open' | 'exploring' | 'resolved' | 'dissolved' | 'deleted';
