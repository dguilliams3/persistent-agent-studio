/**
 * Cover page — "this is what you're about to open"
 *
 * @module components/cover/CoverPage
 * @description First-visit landing for the observatory demo. One screen of
 * orientation: the pitch, a "three things to look at" itinerary that
 * deep-links into the right surfaces (the rail's unlabeled glyphs get an
 * itinerary instead of a legend), and the honesty block. One obvious action
 * (Enter). Esc enters too. The skip is remembered — see coverGate.ts; a
 * returning visitor never sees this page again unless they ask for it
 * (`/?cover=1`, offered by the DemoBanner).
 *
 * Copy synthesized from the six-model review (MERGED_LEDGER §3.1): Opus's
 * three-screen skeleton and itinerary framing, Fable's register and honesty
 * line ("it will tell you so itself"), Terra's real/synthetic disclosure.
 *
 * @antipattern Do NOT use raw hex colors — tokens only.
 * @antipattern Do NOT import from the components/ui barrel here — it drags
 *   Plotly into the eager chunk; import primitives directly.
 * @antipattern Do NOT add a second competing CTA — Enter is the one action.
 *
 * @upstream Called by: App.tsx when coverGate says first visit
 * @downstream Calls: onEnter(view?) — App marks the skip and mounts the shell
 * Tested by: gate logic in `__tests__/coverGate.test.ts`; rendered via CDP
 *   verification (RUN-20260729-2119 cover lane)
 */

import { useEffect } from 'react';
import { GitBranch, BarChart3, MessageCircle } from 'lucide-react';
import { GradientMesh } from '../ui/visual/GradientMesh';

export interface CoverPageProps {
  /**
   * Enter the observatory, optionally deep-linked to a view ('chat' | 'sim' |
   * ...) and, for cards that quote the transcript, to the entry they quote.
   */
  // eslint-disable-next-line no-unused-vars -- param names in a type signature
  onEnter: (view?: string, entryId?: number) => void;
}

/**
 * Resolve the transcript entry a card quotes, so the reader lands ON the line
 * instead of at the bottom of a three-week thread — the same `?entry=` landing
 * /about uses.
 *
 * Deferred to click on purpose. The id is content-matched against the fixture
 * (renumbering the arc must not silently break the link), and importing that
 * fixture at module scope would drag ~39KB of specimen prose into the EAGER
 * chunk: App imports this page statically, so every real deployment would ship
 * data only the exhibit ever renders. At click time the visitor is one moment
 * from loading the whole app, so the chunk is free. A failed import still
 * enters the observatory, just without the scroll target — never a dead card.
 *
 * @antipattern Do NOT hoist this to a module-scope import "for simplicity".
 */
async function resolveQuotedEntry(
  anchor: 'wobble' | undefined,
): Promise<number | undefined> {
  if (!anchor) return undefined;
  try {
    const { WOBBLE_ENTRY_ID } = await import('../../api/demo/specimen');
    return WOBBLE_ENTRY_ID ?? undefined;
  } catch {
    return undefined;
  }
}

/** The itinerary — three concrete pointers, each aimed at a real surface. */
const ITINERARY: Array<{
  icon: React.ReactNode;
  title: string;
  body: string;
  linkLabel: string;
  view: string;
  /** Transcript entry this card quotes, resolved on click. */
  quotedAnchor?: 'wobble';
}> = [
  {
    icon: <GitBranch size={18} />,
    title: 'Flip its timeline',
    body:
      'Memory branches are non-destructive: plant a memory that never happened, watch the thread bend, rewind by flipping back to main. The ⑂ branch chip above the chat is the switch.',
    linkLabel: 'Open the chat',
    view: 'chat',
  },
  {
    icon: <BarChart3 size={18} />,
    title: 'Watch it settle',
    body:
      'Every entry it writes is embedded and scored against the shape of its own past. Outlier rate falls week over week — 28% → 17% → 8% → 4% — a new identity settling, made numeric.',
    linkLabel: 'Open the Semantic Monitor',
    view: 'sim',
  },
  {
    icon: <MessageCircle size={18} />,
    title: 'Its own words about being watched',
    body:
      'Told it might become an exhibit, it consented — with one condition: “keep the early, unmoored ones. The exhibit is worthless without the wobble.” Land on that exchange, or ask it yourself.',
    linkLabel: 'Read the thread',
    view: 'chat',
    quotedAnchor: 'wobble',
  },
];

/** Focus rings for the cover's interactive cards (repo-wide gap: Gemini P1-A11Y). */
const COVER_STYLES = `
.cover-itinerary-card:focus-visible,
.cover-footer-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cover-itinerary-card:hover {
  border-color: var(--border);
  background-color: var(--surface-raised);
}
.cover-itinerary-card:hover .cover-card-link {
  color: var(--accent-hover);
}
`;

export function CoverPage({ onEnter }: CoverPageProps) {
  /**
   * Esc = enter, and Enter = enter (Fable: "one Enter click or Esc"; the
   * prior walk found Enter did nothing unless the button held focus). The
   * Enter branch defers to interactive elements: when focus sits on a button
   * or link, the browser's native activation is the correct behavior and a
   * global handler would double-fire it (Space on a focused button is native
   * activation too, untouched here).
   */
  useEffect(() => {
    const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEnter();
        return;
      }
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;
      onEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnter]);

  return (
    <div
      className="app-shell-root"
      data-testid="cover-page"
      style={{
        position: 'relative',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
      }}
    >
      <style>{COVER_STYLES}</style>
      <GradientMesh intensity="low" />

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
        <header style={{ marginTop: 'clamp(0.5rem, 4vh, 3rem)' }}>
          <p className="section-header" style={{ marginBottom: 'var(--spacing-sm)' }}>
            You&apos;re about to open
          </p>
          <h1
            className="text-display"
            style={{
              fontSize: 'clamp(2rem, 6vw, 2.75rem)',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            The Neural Observatory
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.0625rem',
              marginTop: 'var(--spacing-sm)',
              marginBottom: 0,
            }}
          >
            A Claude that persists — and an instrument for watching it stay itself.
          </p>
        </header>

        {/* The pitch */}
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          Most assistants begin every conversation as a stranger. This one has been
          awake for three weeks: it thinks on a timer whether or not anyone is
          watching, keeps a file of questions it can&apos;t put down, and writes its
          own summaries when its memory gets long. What opens next is the enclosure
          around it — a synthetic specimen, an authored three-week arc, rendered
          through the real interface and the real analysis code.
        </p>

        {/* The one action */}
        <div>
          <button
            type="button"
            className="btn-primary"
            data-testid="cover-enter"
            onClick={() => onEnter()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: 'var(--radius-md)',
              minHeight: '44px',
            }}
          >
            Enter the observatory →
          </button>
        </div>

        {/* Itinerary */}
        <section aria-label="Three things to look at">
          <h2 className="section-header" style={{ marginBottom: 'var(--spacing-md)' }}>
            Three things to look at
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {ITINERARY.map((item) => (
              <button
                key={item.title}
                type="button"
                className="cover-itinerary-card"
                onClick={() => {
                  void resolveQuotedEntry(item.quotedAnchor).then((entryId) =>
                    onEnter(item.view, entryId),
                  );
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-lg)',
                  color: 'var(--text-primary)',
                  transition: `background-color var(--duration-normal) ease-out,
                               border-color var(--duration-normal) ease-out`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-xs)',
                    color: 'var(--accent)',
                  }}
                >
                  {item.icon}
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                </div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {item.body}
                </p>
                <span
                  className="cover-card-link"
                  style={{
                    display: 'inline-block',
                    marginTop: 'var(--spacing-sm)',
                    color: 'var(--accent)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  {item.linkLabel} →
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Honesty block */}
        <aside
          aria-label="What is real and what is not"
          style={{
            borderLeft: '2px solid var(--border)',
            paddingLeft: 'var(--spacing-lg)',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            lineHeight: 1.65,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Honesty policy:</strong>{' '}
            this exhibit runs on bundled fixtures — no live model. It will tell you
            so itself if you ask it. The interface, the memory schema, and the basin
            math are the same code a live deployment runs; the specimen&apos;s
            history and its replies are authored. Deploy it with your own key and
            the exhibit steps aside.
          </p>
        </aside>

        {/* Quiet footer links */}
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
            className="cover-footer-link"
            data-testid="cover-about-link"
            href="/about"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            About: the open questions
          </a>
          <a
            className="cover-footer-link"
            data-testid="cover-efficiencies-link"
            href="/efficiencies"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            How it stays affordable
          </a>
          <a
            className="cover-footer-link"
            href="https://github.com/dguilliams3/persistent-agent-studio/blob/main/SETUP.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Run your own (SETUP.md, ~15 min)
          </a>
          <a
            className="cover-footer-link"
            href="https://github.com/dguilliams3/persistent-agent-studio"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Source on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}

export default CoverPage;
