/**
 * Boundary-shift lab — the real caching algorithm, run by hand
 *
 * @module components/efficiencies/BoundaryShiftLab
 * @description Lever 2's interactive: press "wake" to append history entries
 * and watch the pinned cache boundary hold (cache HIT) until the uncached
 * tail crosses the shipped threshold, then jump forward once (one cache
 * write buying the next run of hits). The point of this widget is its
 * import: it runs `calculateHistoryBoundary()` from `@persistence/memory` —
 * THE function the production loop runs — not a re-implementation. The
 * BOUNDARY_ENGINE re-export exists so the tests can pin that identity;
 * a refactor that breaks the import breaks the suite, not just the toy.
 *
 * Thresholds default to the shipped history config (12K / 6K / min 3 —
 * parity-pinned in costModel.ts). Entry size is a slider so a visitor can
 * discover the cadence: bigger entries, earlier shifts.
 *
 * @antipattern Do NOT reimplement the boundary math here — import it.
 * @antipattern Do NOT use raw hex colors — tokens only.
 *
 * @upstream Called by: EfficienciesPage.tsx
 * @downstream Calls: calculateHistoryBoundary (@persistence/memory — REAL
 *   shipped pure function), costModel.ts (shipped thresholds)
 * Tested by: `apps/web/components/efficiencies/__tests__/costModel.test.ts`
 *   (engine identity + stable-then-shift behavior)
 */

import { useMemo, useState } from 'react';
import { calculateHistoryBoundary } from '@persistence/memory/context/cache/boundary';
import type { HistoryEntry, HistoryId } from '@persistence/memory/types';
import type { CacheConfig } from '@persistence/memory/context/types';
import { HISTORY_ROLL, SUMMARY_ROLL } from './costModel';
import { EFF_CONTROL_STYLES } from './CadenceCostExplorer';

/** The shipped function, re-exported so tests can pin the import identity. */
export const BOUNDARY_ENGINE = calculateHistoryBoundary;

/**
 * Full CacheConfig for the lab: history thresholds are the shipped defaults;
 * summary fields are required by the type but unused by the history path.
 */
export function labCacheConfig(): CacheConfig {
  return {
    useVolatileCaching: true,
    cycleIntervalSeconds: 1800,
    ttl: '1hr',
    historyTailTokenThreshold: HISTORY_ROLL.thresholdTokens,
    historyTailTokenTarget: HISTORY_ROLL.targetTokens,
    minHistoryTailEntries: HISTORY_ROLL.minTailEntries,
    summaryTailTokenThreshold: SUMMARY_ROLL.thresholdTokens,
    summaryTailTokenTarget: SUMMARY_ROLL.targetTokens,
    minSummaryTailSummaries: SUMMARY_ROLL.minTailSummaries,
    summaryPrefixSize: SUMMARY_ROLL.prefixSize,
  };
}

/** Minimal-but-typed history entry carrying an explicit token_count. */
export function labEntry(id: number, tokenCount: number): HistoryEntry & { token_count: number } {
  return {
    id: id as HistoryId,
    persona_id: 1 as HistoryEntry['persona_id'],
    type: 'thought' as HistoryEntry['type'],
    content: '',
    internal: null,
    created_at: new Date(0).toISOString() as HistoryEntry['created_at'],
    summarized_at: null,
    cycle_id: null,
    meter_snapshot: null,
    token_count: tokenCount,
  };
}

interface LabState {
  entries: Array<HistoryEntry & { token_count: number }>;
  boundaryId: HistoryId | null;
  hitsSinceShift: number;
  totalShifts: number;
  lastLog: string;
  lastShifted: boolean;
}

const INITIAL_STATE: LabState = {
  entries: [],
  boundaryId: null,
  hitsSinceShift: 0,
  totalShifts: 0,
  lastLog: 'No wakes yet — press "wake ×1" to append an entry and run the real boundary pass.',
  lastShifted: false,
};

/**
 * @description One simulated wake: append `count` entries, then run the REAL
 * boundary calculation exactly as the production context builder does.
 */
export function stepLab(state: LabState, tokensPerEntry: number, count: number): LabState {
  let entries = state.entries;
  let boundaryId = state.boundaryId;
  let hitsSinceShift = state.hitsSinceShift;
  let totalShifts = state.totalShifts;
  let lastLog = state.lastLog;
  let lastShifted = false;

  for (let step = 0; step < count; step++) {
    const nextId = entries.length + 1;
    entries = [...entries, labEntry(nextId, tokensPerEntry)];
    const result = BOUNDARY_ENGINE(entries, boundaryId, labCacheConfig());
    lastLog = result.logMessage;
    lastShifted = result.shifted;
    if (result.shifted) {
      totalShifts += 1;
      hitsSinceShift = 0;
    } else {
      hitsSinceShift += 1;
    }
    boundaryId = result.boundaryId;
  }

  return { entries, boundaryId, hitsSinceShift, totalShifts, lastLog, lastShifted };
}

export function BoundaryShiftLab() {
  const [tokensPerEntry, setTokensPerEntry] = useState(600);
  const [state, setState] = useState<LabState>(INITIAL_STATE);

  const { prefixTokens, tailTokens, tailCount, boundaryIndex } = useMemo(() => {
    const index = state.boundaryId
      ? state.entries.findIndex((entry) => entry.id === state.boundaryId)
      : -1;
    const tail = index >= 0 ? state.entries.slice(index + 1) : state.entries;
    const prefix = index >= 0 ? state.entries.slice(0, index + 1) : [];
    const sum = (list: Array<{ token_count: number }>) =>
      list.reduce((total, entry) => total + entry.token_count, 0);
    return {
      prefixTokens: sum(prefix),
      tailTokens: sum(tail),
      tailCount: tail.length,
      boundaryIndex: index,
    };
  }, [state]);

  const totalTokens = prefixTokens + tailTokens;
  const prefixShare = totalTokens > 0 ? prefixTokens / totalTokens : 0;
  const tailShare = totalTokens > 0 ? tailTokens / totalTokens : 0;
  const thresholdProgress = Math.min(1, tailTokens / HISTORY_ROLL.thresholdTokens);

  const wake = (count: number) => setState((prev) => stepLab(prev, tokensPerEntry, count));

  return (
    <div
      data-testid="boundary-shift-lab"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
      }}
    >
      <style>{EFF_CONTROL_STYLES}</style>
      <p className="section-header" style={{ margin: 0, marginBottom: 'var(--spacing-xs)' }}>
        The boundary, live — this widget runs the shipped algorithm
      </p>
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--spacing-md)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}
      >
        Not a mock-up: each press calls the same <code className="text-mono">calculateHistoryBoundary()</code>{' '}
        the production loop calls, with the shipped thresholds (
        {HISTORY_ROLL.thresholdTokens.toLocaleString()} roll /{' '}
        {HISTORY_ROLL.targetTokens.toLocaleString()} target).
      </p>

      {/* Entry-size slider */}
      <label style={{ display: 'block', marginBottom: 'var(--spacing-md)' }}>
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.2rem',
          }}
        >
          <span>Tokens per entry</span>
          <span className="text-mono" style={{ color: 'var(--text-primary)' }}>
            ~{tokensPerEntry}
          </span>
        </span>
        <input
          className="eff-range"
          type="range"
          data-testid="lab-tokens-slider"
          min={200}
          max={1200}
          step={100}
          value={tokensPerEntry}
          onChange={(changeEvent) => setTokensPerEntry(Number(changeEvent.target.value))}
          aria-label="Tokens per history entry"
        />
      </label>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
        <button
          type="button"
          className="btn-primary"
          data-testid="lab-wake-1"
          onClick={() => wake(1)}
          style={{ minHeight: '44px', padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-md)' }}
        >
          wake ×1
        </button>
        <button
          type="button"
          className="btn-primary"
          data-testid="lab-wake-10"
          onClick={() => wake(10)}
          style={{ minHeight: '44px', padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-md)' }}
        >
          wake ×10
        </button>
        <button
          type="button"
          data-testid="lab-reset"
          onClick={() => setState(INITIAL_STATE)}
          style={{
            minHeight: '44px',
            padding: '0.5rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          reset
        </button>
      </div>

      {/* Prefix/tail bar */}
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            height: '18px',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--surface-raised)',
            border: state.lastShifted ? '1px solid var(--warning)' : '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: `${prefixShare * 100}%`,
              backgroundColor: 'var(--success)',
              transition: 'width var(--duration-normal) ease-out',
            }}
          />
          <div
            style={{
              width: `${tailShare * 100}%`,
              backgroundColor: 'var(--accent)',
              transition: 'width var(--duration-normal) ease-out',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 'var(--spacing-sm)',
            marginTop: '0.35rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            cached prefix: {boundaryIndex + 1} entries (~{prefixTokens.toLocaleString()} tok)
            {state.boundaryId !== null && (
              <>
                {' '}
                · pinned at entry <span className="text-mono">#{String(state.boundaryId)}</span>
              </>
            )}
          </span>
          <span>
            tail: {tailCount} entries (~{tailTokens.toLocaleString()} tok ·{' '}
            {Math.round(thresholdProgress * 100)}% of threshold)
          </span>
        </div>
      </div>

      {/* Counters */}
      <p
        data-testid="lab-counters"
        style={{ margin: 0, marginBottom: 'var(--spacing-sm)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
      >
        cache hits since last shift:{' '}
        <strong className="text-mono" style={{ color: 'var(--success)' }}>
          {state.hitsSinceShift}
        </strong>{' '}
        · boundary shifts (cache writes):{' '}
        <strong className="text-mono" style={{ color: 'var(--warning)' }}>
          {state.totalShifts}
        </strong>
      </p>

      {/* The algorithm's own voice */}
      <p
        data-testid="lab-log"
        className="text-mono"
        style={{
          margin: 0,
          fontSize: '0.71rem',
          lineHeight: 1.5,
          color: state.lastShifted ? 'var(--warning)' : 'var(--text-muted)',
          overflowWrap: 'anywhere',
        }}
      >
        {state.lastLog}
      </p>
    </div>
  );
}

export default BoundaryShiftLab;
