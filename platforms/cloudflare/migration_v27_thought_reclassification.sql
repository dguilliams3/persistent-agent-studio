-- =============================================================================
-- Migration v27b: Thought Reclassification — Data Cleanup
-- =============================================================================
-- Purpose:
--   Correct the type column on 351 history rows that were stored as 'thought'
--   but are not genuine cognitive outputs. This migration was produced by the
--   thought-quality-audit subagent, which scanned all 2,752 thought entries
--   and identified four categories of misclassification.
--
-- Why this matters:
--   The SIM (Semantic Identity Monitor) builds embedding trajectories from the
--   entity's thinking output. If parser artifacts, system messages, and tool
--   confirmations are stored as 'thought', they pollute the embedding corpus
--   and distort the trajectory. A "thought" that reads "Action: think" is not
--   a thought — it is a parser failure artifact. Leaving it classified as a
--   thought would cause SIM metrics to measure noise rather than signal.
--
--   Additionally, the frontend history view surfaces 'thought' entries as
--   cognitive outputs. Surfacing "Batch response parsing failed" as a thought
--   is misleading to users reviewing the entity's activity.
--
-- Categories corrected (from FINDINGS.md):
--   1. "Action:" stubs (172 entries) → tool_error
--      Parser artifacts from Jan 10-20 where the action label was logged as
--      a thought instead of being dispatched to the action router.
--   2. Dismissed reminder messages (subset of 159 entries) → reminder_dismiss
--      System feedback from the reminder tool, not cognitive output.
--   3. Status update messages (subset of 159 entries) → status_update
--      Operational state reports, not genuine reflection or reasoning.
--   4. Reminder set confirmations (subset of 159 entries) → reminder_set
--      Confirmation echoes from the reminder tool.
--   5. Parse error messages (6 entries) → parse_error
--      "Batch response parsing failed" — error reports, not thoughts.
--   6. Tool result messages (14 entries) → system
--      Pin confirmations, image wall dumps — tool execution feedback.
--
-- Idempotency:
--   FULLY IDEMPOTENT. Each UPDATE only matches rows where type = 'thought'
--   AND the content matches the specific misclassified pattern. A second run
--   finds zero matching rows (type is no longer 'thought') and updates nothing.
--
-- Run with:
--   npx wrangler d1 execute claude-loop --file=migration_v27_thought_reclassification.sql --remote
-- =============================================================================


-- =============================================================================
-- PRE-CLEANUP: Count affected rows for verification
-- =============================================================================
-- Run these SELECT statements before applying the migration to confirm the
-- data matches the expected counts from FINDINGS.md. If counts differ
-- significantly, investigate before proceeding — the WHERE clause patterns
-- may need adjustment for your data state.
--
-- SELECT COUNT(*) AS action_stubs FROM history
--   WHERE type = 'thought' AND content LIKE 'Action: %' AND LENGTH(content) < 30
--   AND created_at >= '2026-01-10' AND created_at < '2026-01-21';
--
-- SELECT COUNT(*) AS parse_errors FROM history
--   WHERE type = 'thought' AND content LIKE 'Batch response parsing failed%';
--
-- SELECT COUNT(*) AS dismissed_reminders FROM history
--   WHERE type = 'thought' AND (content LIKE 'Dismissed reminder:%' OR content LIKE 'Could not find reminder to dismiss:%');
--
-- SELECT COUNT(*) AS status_updates FROM history
--   WHERE type = 'thought' AND content LIKE 'Status:%' AND LENGTH(content) < 100;
--
-- SELECT COUNT(*) AS reminder_confirmations FROM history
--   WHERE type = 'thought' AND content LIKE 'Reminder set:%';
--
-- SELECT COUNT(*) AS tool_results FROM history
--   WHERE type = 'thought' AND (
--     content LIKE 'Pinned image #% to slot %'
--     OR content LIKE 'Image wall:%'
--     OR content LIKE 'Wanted to share art but none found%'
--   );


-- =============================================================================
-- CATEGORY 1: "Action:" Stubs → tool_error
-- =============================================================================
-- Root cause (Jan 10-20 incident):
--   A bug in the response parser caused action-dispatch labels to be logged
--   directly into history as type='thought' instead of being routed to the
--   action pipeline. The entries look like: "Action: think", "Action: search".
--   They are NOT cognition — they are the parser's attempt to label what it
--   was about to do, logged before the dispatch failure occurred.
--
-- Why tool_error (not system or parse_error):
--   These entries represent a failure in the action routing pipeline. The
--   entity intended to perform an action; the pipeline failed to dispatch it.
--   That is a tool-layer error, not a system message or parse failure.
--
-- Pattern specificity:
--   LENGTH(content) < 30 filters to short action stubs only. Genuine thoughts
--   that happen to mention an action ("Action: I should think about X because...")
--   are longer and will NOT be reclassified by this query.
-- =============================================================================

-- IMPORTANT: Before running this migration, execute the verification SELECT
-- queries above and confirm counts match FINDINGS.md expectations. If counts
-- differ, investigate before proceeding. Consider running each UPDATE in a
-- separate transaction with a SELECT COUNT first to verify exact row counts.

UPDATE history
SET type = 'tool_error'
WHERE type = 'thought'
  AND content LIKE 'Action: %'
  AND LENGTH(content) < 30
  AND created_at >= '2026-01-10' AND created_at < '2026-01-21';


-- =============================================================================
-- CATEGORY 2a: Dismissed Reminder Messages → reminder_dismiss
-- =============================================================================
-- These entries are operational feedback from the reminder tool confirming that
-- a reminder was either successfully dismissed or could not be found. They are
-- not thoughts — they are the reminder system reporting its own state back to
-- the history log. Both positive ("Dismissed reminder:") and negative ("Could
-- not find reminder to dismiss:") outcomes are captured because both are the
-- same kind of event: a dismiss attempt and its result.
-- =============================================================================

UPDATE history
SET type = 'reminder_dismiss'
WHERE type = 'thought'
  AND (content LIKE 'Dismissed reminder:%'
    OR content LIKE 'Could not find reminder to dismiss:%');


-- =============================================================================
-- CATEGORY 2b: Status Update Messages → status_update
-- =============================================================================
-- These are operational state reports from the status tool. Format:
--   "Status: [brief state description]"
-- They communicate the entity's current operational state (e.g., "Status: idle",
-- "Status: processing cycle") and are written by the system, not generated
-- through the entity's reasoning process.
--
-- LENGTH(content) < 100 prevents reclassifying longer entries that begin with
-- "Status:" but then contain genuine deliberation. Status reports are terse
-- by design — a 150-character entry starting with "Status:" is almost certainly
-- a thought that begins with that word, not a system status report.
-- =============================================================================

UPDATE history
SET type = 'status_update'
WHERE type = 'thought'
  AND content LIKE 'Status:%'
  AND LENGTH(content) < 100;


-- =============================================================================
-- CATEGORY 2c: Reminder Set Confirmations → reminder_set
-- =============================================================================
-- These are confirmation echoes from the reminder tool after a reminder is
-- successfully created. Format: "Reminder set: [description] at [time]"
-- They confirm that the entity's intent (set a reminder) was executed by the
-- tool. The entity's decision to set the reminder may be documented in a
-- genuine thought entry; this entry is the tool's confirmation response only.
-- =============================================================================

UPDATE history
SET type = 'reminder_set'
WHERE type = 'thought'
  AND content LIKE 'Reminder set:%';


-- =============================================================================
-- CATEGORY 3: Parse Error Messages → parse_error
-- =============================================================================
-- "Batch response parsing failed" entries were written by the response parser
-- when it could not deserialize the Anthropic Batch API response for a cycle.
-- There are 6 such entries, all from the same period as the Category 1 action
-- stub incident. They document system failures, not entity cognition, and
-- belong under parse_error to group them with other parser-layer events.
-- =============================================================================

UPDATE history
SET type = 'parse_error'
WHERE type = 'thought'
  AND content LIKE 'Batch response parsing failed%';


-- =============================================================================
-- CATEGORY 4: Tool Result Messages → system
-- =============================================================================
-- These entries are operational output from the image and art tools:
--   - "Pinned image #N to slot N" — confirmation that an image was pinned to
--     the image wall. Written by the pin tool, not the entity's reasoning.
--   - "Image wall: ..." — dumps of the current image wall state. Written by
--     the image wall display tool as a status output.
--   - "Wanted to share art but none found" — the art sharing tool reporting
--     that no eligible art existed when it ran.
--
-- Why 'system' (not 'tool_result'):
--   'system' is the established type for system-generated operational messages
--   that do not fit a more specific tool category. A dedicated 'tool_result'
--   type does not exist in the current event type registry. Using 'system'
--   correctly groups these with other system-generated operational entries.
-- =============================================================================

UPDATE history
SET type = 'system'
WHERE type = 'thought'
  AND (content LIKE 'Pinned image #% to slot %'
    OR content LIKE 'Image wall:%'
    OR content LIKE 'Wanted to share art but none found%');


-- =============================================================================
-- POST-CLEANUP: Verification
-- =============================================================================
-- Run these queries after applying the migration to confirm expected counts.
-- The first query shows how many rows were reclassified into each new type.
-- The second confirms that the remaining thought count dropped by ~351.
-- If the remaining thought count is higher than expected, investigate whether
-- any WHERE clause patterns above were too narrow to match all instances.
--
-- SELECT type, COUNT(*) as count FROM history
--   WHERE type IN ('tool_error', 'reminder_dismiss', 'status_update',
--                  'reminder_set', 'parse_error', 'system')
--   GROUP BY type ORDER BY count DESC;
--
-- SELECT COUNT(*) AS remaining_thoughts FROM history WHERE type = 'thought';
-- -- Expected: ~2,401 (2,752 - 351)
