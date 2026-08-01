/**
 * About page — "the open questions this instrument exists to ask"
 *
 * @module components/about/AboutPage
 * @description The buried research page (route `/about`). A reading page —
 * typography over widgets: an at-a-glance question index (anchor-linked to
 * per-question section ids, `/about#<id>`), the six open questions from
 * aboutContent.ts, each with the mechanism in this codebase that could answer
 * it and the line that says what would count as an answer, a desktop-only
 * fixed mini-TOC in the left margin (≥1180px), and a "Next" tour link to the
 * sibling /efficiencies page. Deliberately quiet: reached from the cover's
 * footer, the Settings build footer, the demo banner, and the specimen's own
 * chat pointers — never a headline nav item. Works in demo mode and real deployments alike (these
 * are the project's questions, not the specimen's); only the observer-effect
 * question's transcript deep link is demo-gated, because it points into the
 * bundled specimen's history.
 *
 * @antipattern Do NOT use raw hex colors — tokens only.
 * @antipattern Do NOT import from the components/ui barrel here — it drags
 *   Plotly into the chunk; import primitives directly.
 * @antipattern Do NOT add interactive widgets — this is a reading page.
 *
 * @upstream Called by: App.tsx (lazy) when pathname === '/about'
 * @downstream Calls: GradientMesh, InlineCode, aboutContent, specimen
 *   (WOBBLE_ENTRY_ID), api/client (DEMO_MODE)
 * Tested by: `apps/web/components/about/__tests__/aboutPage.test.tsx`
 */

import type { CSSProperties } from 'react';
import { GradientMesh } from '../ui/visual/GradientMesh';
import { InlineCode } from '../common/InlineCode';
import { DEMO_MODE } from '../../api/client';
import { WOBBLE_ENTRY_ID } from '../../api/demo/specimen';
import {
  ABOUT_INTRO,
  ABOUT_QUESTIONS,
  ABOUT_WHY,
  ABOUT_CAVEATS,
  WOBBLE_QUOTE,
} from './aboutContent';

/**
 * Focus/hover affordances for the page's links, plus the desktop mini-TOC:
 * fixed in the whitespace left of the 640px column, shown only where that
 * whitespace actually exists (≥1180px), invisible everywhere else so the
 * single-column reading layout is untouched.
 */
const ABOUT_STYLES = `
.about-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.about-link:hover {
  color: var(--accent-hover);
}
.about-toc {
  display: none;
}
@media (min-width: 1180px) {
  .about-toc {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: fixed;
    top: clamp(4rem, 14vh, 7rem);
    left: calc(50% - 550px);
    width: 190px;
    z-index: 2;
  }
  .about-toc a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.8125rem;
    line-height: 1.4;
  }
  .about-toc a:hover {
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

export interface AboutPageProps {
  /**
   * Demo-mode override, injected for testability (DEMO_MODE is const-false
   * under vitest by design). Defaults to the real flag.
   */
  demoMode?: boolean;
}

export function AboutPage({ demoMode = DEMO_MODE }: AboutPageProps = {}) {
  /**
   * The transcript deep link only exists where the transcript does: the demo
   * exhibit. A live deployment renders the quote, attributed to the bundled
   * specimen, with no link — entry ids there belong to someone else's life.
   */
  const wobbleHref =
    demoMode && WOBBLE_ENTRY_ID !== null
      ? `/observatory?tab=chat&entry=${WOBBLE_ENTRY_ID}`
      : null;

  return (
    <div
      className="app-shell-root"
      data-testid="about-page"
      style={{
        position: 'relative',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
      }}
    >
      <style>{ABOUT_STYLES}</style>
      <GradientMesh intensity="low" />

      {/* Desktop-only mini-TOC — fixed in the margin, absent below 1180px */}
      <nav className="about-toc" aria-label="On this page" data-testid="about-mini-toc">
        <span className="section-header">On this page</span>
        {ABOUT_QUESTIONS.map((question) => (
          <a key={question.id} href={`#${question.id}`}>
            <span className="text-mono" style={{ fontSize: '0.75rem' }}>
              {question.number}
            </span>{' '}
            {question.short}
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
            About this instrument
          </p>
          <h1
            className="text-display"
            style={{
              fontSize: 'clamp(1.75rem, 5.5vw, 2.5rem)',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            The open questions
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginTop: 'var(--spacing-sm)',
              marginBottom: 0,
            }}
          >
            Six questions this observatory exists to ask. None of them are
            answered yet.
          </p>
        </header>

        {/* At a glance — one line per question, anchor-linked to its section */}
        <nav
          aria-label="The six questions at a glance"
          data-testid="about-question-index"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {ABOUT_QUESTIONS.map((question) => (
            <a
              key={question.id}
              className="about-link"
              data-testid={`about-index-${question.id}`}
              href={`#${question.id}`}
              style={{
                display: 'flex',
                gap: 'var(--spacing-sm)',
                alignItems: 'baseline',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              <span
                className="text-mono"
                style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}
              >
                {question.number}
              </span>
              <span>{question.title}</span>
            </a>
          ))}
        </nav>

        {/* Intro */}
        <section aria-label="What this is">
          {ABOUT_INTRO.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-md)' }}
            >
              {paragraph}
            </p>
          ))}
        </section>

        {/* The questions */}
        {ABOUT_QUESTIONS.map((question) => (
          <section
            key={question.id}
            id={question.id}
            aria-label={question.title}
            data-question-id={question.id}
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--spacing-lg)',
              scrollMarginTop: 'var(--spacing-lg)',
            }}
          >
            <p
              className="section-header text-mono"
              style={{ marginBottom: 'var(--spacing-xs)' }}
            >
              {question.number}
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
              {question.title}
            </h2>

            {question.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-md)' }}
              >
                {paragraph}
              </p>
            ))}

            {/* The wobble exchange — the transcript demonstrates the question */}
            {question.id === 'observer-effect' && (
              <figure
                style={{
                  margin: `0 0 var(--spacing-md)`,
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: 'var(--spacing-lg)',
                }}
              >
                <blockquote style={{ ...PARAGRAPH_STYLE, fontStyle: 'italic' }}>
                  “{WOBBLE_QUOTE}”
                </blockquote>
                <figcaption
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  — the specimen, on learning it might become this exhibit.{' '}
                  {wobbleHref ? (
                    <a
                      className="about-link"
                      data-testid="wobble-deep-link"
                      href={wobbleHref}
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      Read that moment in the transcript →
                    </a>
                  ) : (
                    <span>The exchange ships in the bundled demo specimen.</span>
                  )}
                </figcaption>
              </figure>
            )}

            <p style={{ ...PARAGRAPH_STYLE, marginBottom: 'var(--spacing-sm)' }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                The apparatus:
              </strong>{' '}
              <InlineCode text={question.apparatus} />
            </p>
            <p style={{ ...PARAGRAPH_STYLE, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                What would count as an answer:
              </strong>{' '}
              {question.measure}
            </p>

            {/* The distances this question would plot ARE the SIM tab — the
                one live surface for it, in demo and real deployments alike. */}
            {question.id === 'model-swap' && (
              <p style={{ ...PARAGRAPH_STYLE, marginTop: 'var(--spacing-sm)', fontSize: '0.8125rem' }}>
                <a
                  className="about-link"
                  data-testid="about-sim-live-link"
                  href="/observatory?tab=sim"
                  style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                >
                  See it live: the settling arc in the basin charts →
                </a>
              </p>
            )}
          </section>
        ))}

        {/* Why bother */}
        <section
          aria-label="Why bother"
          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--spacing-lg)' }}
        >
          <h2 className="section-header" style={{ marginBottom: 'var(--spacing-md)' }}>
            Why bother
          </h2>
          {ABOUT_WHY.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} style={PARAGRAPH_STYLE}>
              {paragraph}
            </p>
          ))}
        </section>

        {/* The honest caveats */}
        <aside
          aria-label="The honest caveats"
          style={{
            borderLeft: '2px solid var(--border)',
            paddingLeft: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          {ABOUT_CAVEATS.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} style={{ ...PARAGRAPH_STYLE, fontSize: '0.875rem' }}>
              {paragraph}
            </p>
          ))}
        </aside>

        {/* The tour continues — sibling page next */}
        <nav
          aria-label="Where next"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--spacing-lg)',
          }}
        >
          <a
            className="about-link"
            data-testid="about-next-efficiencies"
            href="/efficiencies"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: '0.9375rem',
              fontWeight: 500,
            }}
          >
            Next: how it stays affordable →
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
            className="about-link"
            data-testid="about-to-observatory"
            href="/observatory"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Enter the observatory
          </a>
          <a
            className="about-link"
            data-testid="about-efficiencies-link"
            href="/efficiencies"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            How it stays affordable
          </a>
          <a
            className="about-link"
            href="https://github.com/dguilliams3/persistent-agent-studio"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Source on GitHub
          </a>
          <a
            className="about-link"
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

export default AboutPage;
