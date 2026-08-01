/**
 * Efficiencies page content — how a mind that never stops stays affordable
 *
 * @module components/efficiencies/efficienciesContent
 * @description The cache/summarization story as data: the problem statement,
 * five levers (each anchored to the mechanism in this codebase that pulls it),
 * the receipts, and the provenance note. Module paths in backticks render as
 * inline code — and they are REAL paths, asserted against the repo by the
 * efficiencies tests, so the prose cannot silently drift from the code.
 *
 * Synthesized from the six-model review (MERGED_LEDGER §3.3): Fable's
 * five-lever spine (the only draft citing boundary.ts / cacheTtl.ts /
 * guards.ts / the cycles ledger), Opus's diagram-front-door + cost-slider
 * build order, Terra's in-app placement. Binding rulings honored: RATIOS NOT
 * PRICES (hard dollars are the snapshot-decay failure mode) and BUILD FROM
 * CODE, not from docs/ai_native/CONTEXT_ASSEMBLY.md (which describes a
 * superseded block layout).
 *
 * @upstream Called by: EfficienciesPage.tsx (render), efficienciesPage.test.tsx
 *   (cited-path existence assertions)
 */

export interface EfficiencyLever {
  /** Stable id — also the section anchor (`/efficiencies#<id>`). */
  id: string;
  /** Lever number as printed (01–05). */
  number: string;
  /** Two-or-three-word label for the summary strip and desktop mini-TOC. */
  short: string;
  /**
   * The ratio/quantity this lever controls, in stat-tile type on the summary
   * strip. MUST restate a value the section's own prose already states (no
   * invented numbers, no dollar figures — same binding ruling as the body).
   */
  stat: string;
  /** One-line caption under the stat naming what the quantity is. */
  statLabel: string;
  /** The lever, stated as a move. */
  title: string;
  /** Body paragraphs. Backticked segments render as inline code. */
  body: string[];
  /** The apparatus line: where this lever lives in the codebase. */
  apparatus: string;
}

/** Masthead subtitle. */
export const EFFICIENCIES_SUBTITLE =
  'A persona that thinks on a timer re-reads its entire life on every wake. ' +
  'Five levers keep that affordable enough to leave running.';

/** The problem, stated in ratios (no dollar figures — prices rot, ratios hold). */
export const EFFICIENCIES_PROBLEM: string[] = [
  'Every cycle, the loop reassembles the persona’s whole context — constitution, memories, summaries, recent history — and hands it to the model again. Almost all of that text is identical to the previous wake. Priced naively, the cost of existing scales linearly with the length of the life: the longer it lives, the more it costs to keep living.',
  'The design below breaks that line using the shape of Anthropic’s prompt caching: a cached span of the prompt is re-read at roughly a tenth of the normal input rate, writing a span into cache carries a premium (about 1.25× for five-minute entries, 2× for one-hour entries), and off-hours batch processing runs at about half rate. So the game is: keep the unchanged majority of the prompt behind cache markers, pay the write premium as rarely as possible, and don’t wake at all when there’s nothing to wake for.',
];

/** The five levers. */
export const EFFICIENCY_LEVERS: EfficiencyLever[] = [
  {
    id: 'blocks',
    number: '01',
    short: 'Four blocks',
    stat: '4 blocks',
    statLabel: 'geological → live; a new entry never touches the cached prefix',
    title: 'A context sorted by rate of change',
    body: [
      'Prompt caching is a prefix match: one changed byte invalidates everything after it. So the context is not one prompt — it is four blocks, ordered from geological to live. Block 1 holds the constitution, the verbs, and permanent cold storage; it changes on deploys. Block 2 holds promoted summaries; it changes when something is deemed worth promoting. Block 3 holds observations and the older-summaries prefix; it drifts on the scale of days. Block 4 — retrieved memories, the summary tail, the full recent history, reminders, meters, the current moment — changes every single cycle and is never cached.',
      'Because anything that changes rarely sits upstream of anything that changes often, a new entry in Block 4 never touches the cached prefix. The block layout is not an organizational nicety; it is the cost structure.',
    ],
    apparatus:
      'Blocks 2–4 are assembled by `packages/memory/src/context/blocks/` via the pure orchestrator in `packages/memory/src/context/builder/build-context.ts`; `packages/runtime/src/context/systemBlocks.ts` attaches the per-block cache markers on the way to the API.',
  },
  {
    id: 'boundary',
    number: '02',
    short: 'Pinned boundaries',
    stat: '12K → 6K',
    statLabel: 'history tail roll — one shift buys ≈10 cached cycles',
    title: 'Boundaries that refuse to move',
    body: [
      'The naive split — “cache everything except the last few entries” — invalidates the cache every cycle, because every new entry moves the split point and prompt caching matches on exact bytes. The fix is a pinned boundary: the prefix/tail split is anchored to a specific entry id and stays put while the tail grows past it. Only when the uncached tail exceeds a token threshold (12,000 by config) does the boundary jump forward, shrinking the tail back toward its target (6,000) — one cache invalidation buying roughly ten cycles of pure cache hits, by the module’s own worked example.',
      'Summaries get the identical treatment with their own thresholds: the summary tail rolls into the frozen prefix at 8,000 tokens, back down to about 4,000.',
    ],
    apparatus:
      'The algorithm is `calculateHistoryBoundary()` and `calculateSummaryBoundary()` in `packages/memory/src/context/cache/boundary.ts` — pure functions, no I/O. The thresholds live in `platforms/cloudflare/src/config/index.ts` (history: 12K/6K, min 3 tail entries) and `platforms/cloudflare/src/constants.ts` (summaries: 8K/4K).',
  },
  {
    id: 'ttl',
    number: '03',
    short: 'Cadence-aware TTL',
    stat: '270s / 1,440s',
    statLabel: 'interval cutoffs for 5-minute / 1-hour cache entries',
    title: 'TTLs that know your cadence',
    body: [
      'Cache entries expire, and the write premium is only worth paying if the next wake arrives before the entry dies. So the TTL is chosen from the cycle interval itself: under 270 seconds, five-minute entries (the cheapest premium, self-refreshing on every read); under 1,440 seconds, one-hour entries; slower than that, the volatile block is not cached at all — a write that nothing ever reads is pure premium. The stable blocks are always cached; only the policy for the volatile middle bends with the cadence.',
    ],
    apparatus:
      '`selectCacheTtl()` in `packages/runtime/src/context/cacheTtl.ts` — the same function the explorer below calls. Thresholds: 270s and 1,440s.',
  },
  {
    id: 'tiers',
    number: '04',
    short: 'Tiered memory',
    stat: '~70 entries',
    statLabel: 'raw timeline length before the summarize nudge fires',
    title: 'Memory that compresses in tiers',
    body: [
      'History does not grow forever; it ages. When the raw timeline gets long (the nudge fires around 70 entries), the persona summarizes: anything vital is promoted to permanent cold storage first, then a span of raw entries collapses into an LLM-written summary. Summaries themselves age — tail to cached prefix, prefix to promoted, and eventually meta-summarized and archived out of the context entirely.',
      'Archived does not mean forgotten. Every archived summary stays embedded, and the retriever pulls memories back into Block 4 by semantic relevance, scored with a recency half-life. The context holds the shape of the past at every scale, and the full past remains one similarity search away.',
    ],
    apparatus:
      'Summarization pipeline: `packages/memory/src/summarization/` (pure orchestrator + tier state machine in `packages/memory/src/summarization/tier/transitions.ts`). The ~70-entry nudge is `DEFAULT_SUMMARIZE_THRESHOLD` in `platforms/cloudflare/src/constants.ts`; retrieval scoring is `packages/memory/src/rag/scoring/`.',
  },
  {
    id: 'not-thinking',
    number: '05',
    short: 'Not thinking',
    stat: '3 unfed wakes',
    statLabel: 'then the interval doubles, up to an hour',
    title: 'Knowing when not to think',
    body: [
      'The cheapest cycle is the one that never runs. The wake guards track whether recent cycles contained anything new; after three consecutive “unfed” wakes, the effective interval doubles, and keeps doubling up to an hour. One inbound message snaps the cadence back to its configured base. Off-hours, a batch window can trade latency for roughly half-rate processing.',
      'And there is a hard breaker: each persona carries a spend ceiling, and when its lifetime cost reaches that ceiling the loop pauses itself — and writes the reason into its own history, where you (and it) can read it. The exhibit’s honesty policy, applied to its own bill.',
    ],
    apparatus:
      'Wake admission runs through `packages/runtime/src/loop/guards.ts` — the spend-ceiling breaker and the adaptive backoff both live there. The batch window is `packages/llm/src/batches.ts`.',
  },
];

/** The receipts — why none of this is a projection. */
export const EFFICIENCIES_RECEIPTS: string[] = [
  'None of the above is a whitepaper claim about a hypothetical system. Every cycle writes its own receipt — model, input and output tokens, cache reads versus cache writes, estimated cost, which action it took — into a per-cycle ledger. The levers on this page are auditable against that ledger row by row, which is also what makes the open questions on the About page answerable.',
];

/** Receipts apparatus line (cited-path checked like the levers). */
export const EFFICIENCIES_RECEIPTS_APPARATUS =
  'The ledger: `packages/db/src/cycles.ts`, schema in `platforms/cloudflare/migration_v6_cycles.sql`.';

/** Where the numbers come from — the provenance note. */
export const EFFICIENCIES_PROVENANCE: string[] = [
  'The ratios on this page (reads ≈ 0.1×, write premiums 1.25× / 2×, batch ≈ 0.5×) and the thresholds (270s / 1,440s TTL cutoffs; 12K/6K history roll; 8K/4K summary roll; 3 unfed wakes; 3,600s backoff ceiling; ~70-entry summarize nudge) are imported from, or test-pinned to, the shipped code — if the code drifts, the test suite fails before this page can lie. Two values are illustrative and labeled where they appear: the explorer’s default cached fraction, and the ten-cycles-per-invalidation amortization (the boundary module’s own worked example). No dollar figures appear here on purpose: prices rot, ratios hold.',
];

/**
 * Every backticked repo path across the page's prose — used by the tests to
 * assert existence on disk (same pattern as the About page).
 */
export function citedPaths(): string[] {
  const sources = [
    ...EFFICIENCY_LEVERS.map((lever) => lever.apparatus),
    EFFICIENCIES_RECEIPTS_APPARATUS,
  ];
  return sources.flatMap((text) =>
    (text.match(/`([^`]+)`/g) ?? [])
      .map((token) => token.slice(1, -1))
      .filter((token) => token.includes('/')),
  );
}
