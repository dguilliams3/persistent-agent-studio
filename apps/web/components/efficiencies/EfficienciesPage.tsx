/**
 * Efficiencies page — "how a mind that never stops stays affordable"
 *
 * @module components/efficiencies/EfficienciesPage
 * @description The cache/summarization story (route `/efficiencies`, sibling
 * of `/about`): an at-a-glance five-lever summary strip (stat tiles restating
 * values the sections already state, anchor-linked to per-lever section ids
 * `/efficiencies#<id>`), the context-anatomy diagram as the front door, then
 * the five levers from efficienciesContent.ts as readable sections with
 * module paths, with two interactives — the cadence/cost explorer (real
 * selectCacheTtl, real CACHE_PRICING ratios) after lever 3, and the
 * boundary-shift lab (real calculateHistoryBoundary) inside lever 2 — plus a
 * desktop-only fixed mini-TOC (≥1180px) and tour links back to /observatory
 * and /about. Deliberately quiet: reached from the cover footer, the About
 * footer, the Settings build footer, the demo banner, and the specimen's own
 * chat pointers — never a headline nav item. Works in demo mode and real deployments alike (the
 * page is about the system, not the specimen; it computes, it never fetches).
 *
 * @antipattern Do NOT use raw hex colors — tokens only.
 * @antipattern Do NOT import from the components/ui barrel here — it drags
 *   Plotly into the chunk; import primitives directly.
 * @antipattern Do NOT add dollar figures — ratios only (MERGED_LEDGER §3.3).
 *
 * @upstream Called by: App.tsx (lazy) when pathname === '/efficiencies'
 * @downstream Calls: GradientMesh, InlineCode, efficienciesContent, diagrams,
 *   CadenceCostExplorer, BoundaryShiftLab
 * Tested by: `apps/web/components/efficiencies/__tests__/efficienciesPage.test.tsx`
 */

import type { CSSProperties } from 'react';
import { GradientMesh } from '../ui/visual/GradientMesh';
import { InlineCode } from '../common/InlineCode';
import { ContextAnatomyDiagram, TierFlowDiagram } from './diagrams';
import { CadenceCostExplorer } from './CadenceCostExplorer';
import { BoundaryShiftLab } from './BoundaryShiftLab';
import {
  EFFICIENCIES_SUBTITLE,
  EFFICIENCIES_PROBLEM,
  EFFICIENCY_LEVERS,
  EFFICIENCIES_RECEIPTS,
  EFFICIENCIES_RECEIPTS_APPARATUS,
  EFFICIENCIES_PROVENANCE,
} from './efficienciesContent';

/**
 * Focus/hover affordances for the page's links, plus the desktop mini-TOC
 * (same pattern as AboutPage: fixed in the whitespace left of the column,
 * shown only ≥1180px, invisible everywhere else) and the summary strip grid.
 */
const PAGE_STYLES = `
.eff-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.eff-link:hover {
  color: var(--accent-hover);
}
.eff-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}
.eff-strip-card:hover {
  border-color: var(--accent);
}
.eff-toc {
  display: none;
}
@media (min-width: 1180px) {
  .eff-toc {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: fixed;
    top: clamp(4rem, 14vh, 7rem);
    left: calc(50% - 550px);
    width: 190px;
    z-index: 2;
  }
  .eff-toc a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.8125rem;
    line-height: 1.4;
  }
  .eff-toc a:hover {
    color: var(--accent-hover);
  }
}
`;

/** Shared body-paragraph style — one reading measure for the whole page. */
const PARAGRAPH_STYLE: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.9375rem',
  lineHeight: 1.7,
  margin: 0,
};

export function EfficienciesPage() {
  return (
    <div
      className="app-shell-root"
      data-testid="efficiencies-page"
      style={{
        position: 'relative',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
      }}
    >
      <style>{PAGE_STYLES}</style>
      <GradientMesh intensity="low" />

      {/* Desktop-only mini-TOC — fixed in the margin, absent below 1180px */}
      <nav className="eff-toc" aria-label="On this page" data-testid="eff-mini-toc">
        <span className="section-header">On this page</span>
        {EFFICIENCY_LEVERS.map((lever) => (
          <a key={lever.id} href={`#${lever.id}`}>
            <span className="text-mono" style={{ fontSize: '0.75rem' }}>
              {lever.number}
            </span>{' '}
            {lever.short}
          </a>
        ))}
      </nav>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '640px',
          margin: '0 auto',
          padding: 'clamp(1.25rem, 4vw, 3rem) clamp(1rem, 4vw, 1.5rem) 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xl)',
        }}
      >
        {/* Masthead */}
        <header style={{ marginTop: 'clamp(0.5rem, 3vh, 2rem)' }}>
          <p className="section-header" style={{ marginBottom: 'var(--spacing-sm)' }}>
            Engineering notes
          </p>
          <h1
            className="text-display"
            style={{
              fontSize: 'clamp(1.75rem, 5.5vw, 2.5rem)',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            How a mind that never stops stays affordable
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginTop: 'var(--spacing-sm)',
              marginBottom: 0,
            }}
          >
            {EFFICIENCIES_SUBTITLE}
          </p>
        </header>

        {/* At a glance — five levers as stat tiles, anchor-linked to sections.
            Every stat restates a value the sections/provenance already carry:
            no new numbers, no dollar figures (binding ruling). */}
        <nav aria-label="The five levers at a glance" data-testid="eff-lever-strip">
          <div className="eff-strip">
            {EFFICIENCY_LEVERS.map((lever) => (
              <a
                key={lever.id}
                className="eff-link eff-strip-card"
                data-testid={`eff-strip-${lever.id}`}
                href={`#${lever.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'border-color var(--duration-normal) ease-out',
                }}
              >
                <span className="section-header text-mono" style={{ fontSize: '0.6875rem' }}>
                  {lever.number} · {lever.short}
                </span>
                <span
                  className="text-mono"
                  style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  {lever.stat}
                </span>
                <span style={{ fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--text-muted)' }}>
                  {lever.statLabel}
                </span>
              </a>
            ))}
          </div>
          <p
            data-testid="eff-strip-explorers-note"
            style={{
              margin: 0,
              marginTop: 'var(--spacing-sm)',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
            }}
          >
            Two of these are interactive further down the page: lever 02 carries the
            boundary-shift lab, lever 03 the cadence/cost explorer.
          </p>
        </nav>

        {/* The problem */}
        <section aria-label="The problem">
          {EFFICIENCIES_PROBLEM.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-md)' }}
            >
              {paragraph}
            </p>
          ))}
        </section>

        {/* Front door: the context anatomy diagram */}
        <section aria-label="One cycle's prompt">
          <ContextAnatomyDiagram />
        </section>

        {/* The five levers */}
        {EFFICIENCY_LEVERS.map((lever) => (
          <section
            key={lever.id}
            id={lever.id}
            aria-label={lever.title}
            data-lever-id={lever.id}
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--spacing-lg)',
              scrollMarginTop: 'var(--spacing-lg)',
            }}
          >
            <p className="section-header text-mono" style={{ marginBottom: 'var(--spacing-xs)' }}>
              {lever.number}
            </p>
            <h2
              className="text-display"
              style={{
                fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)',
                lineHeight: 1.3,
                margin: 0,
                marginBottom: 'var(--spacing-md)',
              }}
            >
              {lever.title}
            </h2>

            {lever.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-md)' }}
              >
                {paragraph}
              </p>
            ))}

            {/* Lever 2 carries the boundary lab — the real shipped algorithm */}
            {lever.id === 'boundary' && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <BoundaryShiftLab />
              </div>
            )}

            {/* Lever 4 carries the tier-flow diagram */}
            {lever.id === 'tiers' && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <TierFlowDiagram />
              </div>
            )}

            <p style={{ ...PARAGRAPH_STYLE, marginBottom: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                Where it lives:
              </strong>{' '}
              <InlineCode text={lever.apparatus} />
            </p>

            {/* The cost explorer composes levers 1–3 — it sits after the TTL lever */}
            {lever.id === 'ttl' && (
              <div style={{ marginTop: 'var(--spacing-lg)' }}>
                <CadenceCostExplorer />
              </div>
            )}
          </section>
        ))}

        {/* The receipts */}
        <section
          aria-label="The receipts"
          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--spacing-lg)' }}
        >
          <h2 className="section-header" style={{ marginBottom: 'var(--spacing-md)' }}>
            The receipts
          </h2>
          {EFFICIENCIES_RECEIPTS.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-md)' }}
            >
              {paragraph}
            </p>
          ))}
          <p style={{ ...PARAGRAPH_STYLE, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <InlineCode text={EFFICIENCIES_RECEIPTS_APPARATUS} />
          </p>
        </section>

        {/* Where the numbers come from */}
        <aside
          aria-label="Where the numbers come from"
          style={{
            borderLeft: '2px solid var(--border)',
            paddingLeft: 'var(--spacing-lg)',
          }}
        >
          {EFFICIENCIES_PROVENANCE.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} style={{ ...PARAGRAPH_STYLE, fontSize: '0.875rem' }}>
              {paragraph}
            </p>
          ))}
        </aside>

        {/* The tour closes — back to the exhibit, with the sibling page a step away */}
        <nav
          aria-label="Where next"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: 'var(--spacing-sm) var(--spacing-lg)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--spacing-lg)',
          }}
        >
          <a
            className="eff-link"
            data-testid="eff-back-observatory"
            href="/observatory"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
            }}
          >
            Back to the observatory →
          </a>
          <a
            className="eff-link"
            data-testid="eff-back-about"
            href="/about"
            style={{
              color: 'var(--text-muted)',
              textDecoration: 'underline',
              fontSize: '0.8125rem',
            }}
          >
            the questions
          </a>
        </nav>

        {/* Quiet footer */}
        <footer
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm) var(--spacing-lg)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <a
            className="eff-link"
            data-testid="efficiencies-to-observatory"
            href="/observatory"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Enter the observatory
          </a>
          <a
            className="eff-link"
            data-testid="efficiencies-to-about"
            href="/about"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            About: the open questions
          </a>
          <a
            className="eff-link"
            href="https://github.com/dguilliams3/persistent-agent-studio"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Source on GitHub
          </a>
          <a
            className="eff-link"
            href="https://github.com/dguilliams3/persistent-agent-studio/blob/main/SETUP.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Run your own (SETUP.md, ~15 min)
          </a>
        </footer>
      </div>
    </div>
  );
}

export default EfficienciesPage;
