/**
 * Web Agent Digest System
 *
 * @module @persistence/services/web-agent
 * @description Scheduled web agent for topic-based digests.
 *
 * Fetches web information on configurable topics, summarizes via LLM,
 * and logs to history for Clio's context window.
 *
 * @see SPEC_v2.md in runs/RUN-20260130-2242-web-agent-architecture/
 */

export * from './types';
export * from './service';
