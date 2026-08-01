/**
 * Efficiencies diagrams — context anatomy front door + memory tier flow
 *
 * @module components/efficiencies/diagrams
 * @description The two static visuals for the Efficiencies page, drawn in the
 * observatory design language (tokens only, no ASCII). ContextAnatomyDiagram
 * is the page's front door: the four-block prompt ordered by rate of change,
 * each block carrying its cache policy — the single image that makes the
 * cost structure legible. TierFlowDiagram shows how memory ages downward
 * through the tiers and comes back via retrieval.
 *
 * Block contents mirror the SHIPPED assembly (block3.ts / block4.ts headers +
 * systemBlocks.ts), NOT docs/ai_native/CONTEXT_ASSEMBLY.md, whose block
 * layout is superseded (learned/questions/notebook moved to Block 4).
 *
 * @antipattern Do NOT use raw hex colors — tokens only.
 * @antipattern Do NOT print token counts or dollar figures in these diagrams —
 *   ratios and shapes only (MERGED_LEDGER §3.3 binding ruling).
 *
 * @upstream Called by: EfficienciesPage.tsx
 * @downstream Calls: none (pure render)
 * Tested by: `apps/web/components/efficiencies/__tests__/efficienciesPage.test.tsx`
 */

import type { CSSProperties } from 'react';

type CachePolicy = 'stable' | 'volatile' | 'never';

interface BlockSpec {
  label: string;
  contents: string;
  changes: string;
  policy: CachePolicy;
  badge: string;
}

/** The four blocks as the shipped code assembles them (geological → live). */
const BLOCKS: BlockSpec[] = [
  {
    label: 'Block 1',
    contents: 'Constitution · verbs · cold storage · pinned space',
    changes: 'on deploys and rare acts',
    policy: 'stable',
    badge: 'cached · stable TTL',
  },
  {
    label: 'Block 2',
    contents: 'Promoted summaries',
    changes: 'when a summary is promoted',
    policy: 'stable',
    badge: 'cached · stable TTL',
  },
  {
    label: 'Block 3',
    contents: 'Observations · older-summaries prefix',
    changes: 'every few days',
    policy: 'volatile',
    badge: 'cached · cadence-aware TTL',
  },
  {
    label: 'Block 4',
    contents: 'Retrieved memories · summary tail · full recent history · reminders · meters · now',
    changes: 'every cycle',
    policy: 'never',
    badge: 'never cached · fresh',
  },
];

const POLICY_COLOR: Record<CachePolicy, string> = {
  stable: 'var(--success)',
  volatile: 'var(--warning)',
  never: 'var(--accent)',
};

const BADGE_STYLE: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  borderRadius: 'var(--radius-sm)',
  padding: '0.15rem 0.5rem',
  whiteSpace: 'nowrap',
};

/**
 * @description The front-door diagram: one cycle's prompt as a stack of four
 * blocks ordered by how often their bytes change. Prompt caching is a prefix
 * match, so this ordering IS the cost structure — the diagram's one idea.
 */
export function ContextAnatomyDiagram() {
  return (
    <figure
      data-testid="context-anatomy-diagram"
      style={{ margin: 0 }}
      aria-label="One cycle's prompt: four blocks ordered by rate of change"
    >
      <figcaption
        className="section-header"
        style={{ marginBottom: 'var(--spacing-md)' }}
      >
        One cycle&apos;s prompt — ordered by rate of change
      </figcaption>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {/* The stack */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-xs)',
          }}
        >
          {BLOCKS.map((block) => (
            <div
              key={block.label}
              data-block={block.label}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderLeftWidth: '3px',
                borderLeftColor: POLICY_COLOR[block.policy],
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md) var(--spacing-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--spacing-sm)',
                  flexWrap: 'wrap',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                <span
                  className="text-mono"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                  }}
                >
                  {block.label}
                </span>
                <span
                  style={{
                    ...BADGE_STYLE,
                    color: POLICY_COLOR[block.policy],
                    backgroundColor: 'var(--surface-raised)',
                    border: `1px solid var(--border-subtle)`,
                  }}
                >
                  {block.badge}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                {block.contents}
              </p>
              <p
                style={{
                  margin: 0,
                  marginTop: '0.15rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                changes: {block.changes}
              </p>
            </div>
          ))}
        </div>

        {/* Rate-of-change axis (decorative; hidden from AT) */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            paddingTop: '0.25rem',
            paddingBottom: '0.25rem',
          }}
        >
          <span
            style={{
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              writingMode: 'vertical-rl',
            }}
          >
            geological
          </span>
          <div
            style={{
              flex: 1,
              width: '3px',
              borderRadius: '2px',
              background: `linear-gradient(to bottom, var(--success), var(--warning), var(--accent))`,
            }}
          />
          <span
            style={{
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              writingMode: 'vertical-rl',
            }}
          >
            live
          </span>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          marginTop: 'var(--spacing-md)',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
        }}
      >
        Prompt caching is a prefix match — one changed byte invalidates
        everything after it. Ordering the blocks by rate of change means a new
        entry at the bottom never touches the cached majority above it.
      </p>
    </figure>
  );
}

interface TierStage {
  name: string;
  detail: string;
  transition?: string;
  policy: CachePolicy | 'archived';
}

const TIER_STAGES: TierStage[] = [
  {
    name: 'Raw history',
    detail: 'every entry the persona writes, verbatim',
    transition: 'summarize — nudged when the timeline runs long (~70 entries); vital facts promoted to cold storage first',
    policy: 'never',
  },
  {
    name: 'Summary tail',
    detail: 'fresh summaries, still uncached (Block 4)',
    transition: 'roll — tail exceeds its token threshold, oldest summaries freeze into the prefix',
    policy: 'never',
  },
  {
    name: 'Summary prefix',
    detail: 'older summaries behind the pinned boundary (Block 3, cached)',
    transition: 'promote / meta-summarize',
    policy: 'volatile',
  },
  {
    name: 'Promoted',
    detail: 'summaries worth keeping in front of every cycle (Block 2, cached)',
    transition: 'archive — out of the context entirely',
    policy: 'stable',
  },
  {
    name: 'Archived',
    detail: 'gone from the prompt, still embedded — retrieved back into Block 4 by similarity, scored with a recency half-life',
    policy: 'archived',
  },
];

/**
 * @description Lever 4's visual: memory aging downward through the tiers,
 * with the retrieval loop bringing the archived past back on demand.
 */
export function TierFlowDiagram() {
  return (
    <figure
      data-testid="tier-flow-diagram"
      style={{ margin: 0 }}
      aria-label="Memory tiers: raw history compresses downward, retrieval reaches back"
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {TIER_STAGES.map((stage) => (
          <div key={stage.name}>
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border:
                  stage.policy === 'archived'
                    ? '1px dashed var(--border)'
                    : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color:
                    stage.policy === 'archived'
                      ? 'var(--text-secondary)'
                      : 'var(--text-primary)',
                }}
              >
                {stage.name}
              </span>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  marginLeft: 'var(--spacing-sm)',
                }}
              >
                — {stage.detail}
              </span>
            </div>
            {stage.transition && (
              <div
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: '0.3rem 0 0.3rem var(--spacing-lg)',
                }}
              >
                <span style={{ color: 'var(--accent)', fontSize: '0.8125rem' }}>↓</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {stage.transition}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}
