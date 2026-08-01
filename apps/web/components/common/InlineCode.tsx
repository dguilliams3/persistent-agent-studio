/**
 * InlineCode — backtick-to-code renderer for mechanism-citing prose
 *
 * @module components/common/InlineCode
 * @description Renders a prose string whose backticked segments become inline
 * code — the module paths the About and Efficiencies pages cite. A tiny
 * renderer, not a markdown engine. Long module paths WRAP at 390px instead of
 * severing off-screen (overflowWrap: anywhere — measured on the About page:
 * build-system-prompt.ts ran to x=433 on a 390 viewport without it).
 *
 * @upstream Called by: AboutPage.tsx, EfficienciesPage.tsx
 * @downstream Calls: none (pure render)
 * Tested by: `apps/web/components/about/__tests__/aboutPage.test.tsx` (via
 *   AboutPage render), `apps/web/components/efficiencies/__tests__/
 *   efficienciesPage.test.tsx` (via EfficienciesPage render)
 */

import { Fragment } from 'react';

export function InlineCode({ text }: { text: string }) {
  const parts = text.split('`');
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="text-mono"
            style={{
              fontSize: '0.8125em',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.05em 0.35em',
              overflowWrap: 'anywhere',
            }}
          >
            {part}
          </code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export default InlineCode;
