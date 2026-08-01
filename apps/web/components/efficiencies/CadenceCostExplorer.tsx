/**
 * Cadence & cost explorer — the ratio structure of a cycle, manipulable
 *
 * @module components/efficiencies/CadenceCostExplorer
 * @description The Efficiencies page's primary interactive (Opus's
 * cost-slider spec): drag the cycle interval and watch the REAL shipped TTL
 * policy (`selectCacheTtl`) change regime, and the bill's composition —
 * cache reads / fresh tail / amortized writes — restack. Everything is a
 * ratio against "the same prompt, uncached = 1.0". No dollar figures, no
 * absolute token counts (MERGED_LEDGER §3.3 binding ruling); the one
 * illustrative control (cached fraction) is labeled as illustrative in the UI.
 *
 * Touch: native range inputs with enlarged thumbs (44px hit targets via
 * padding), a checkbox toggle for batch mode. Works identically in demo and
 * real deployments — it computes, it does not fetch.
 *
 * @antipattern Do NOT use raw hex colors — tokens only.
 * @antipattern Do NOT add dollar outputs — ratios only.
 *
 * @upstream Called by: EfficienciesPage.tsx
 * @downstream Calls: computeCycleEconomics (costModel.ts → real shipped
 *   selectCacheTtl + CACHE_PRICING)
 * Tested by: `apps/web/components/efficiencies/__tests__/efficienciesPage.test.tsx`
 *   (slider interaction), `__tests__/costModel.test.ts` (the arithmetic)
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  computeCycleEconomics,
  DEFAULT_CACHED_FRACTION,
  INTERVAL_BOUNDS,
  CYCLES_PER_BOUNDARY_SHIFT,
  type CycleEconomics,
} from './costModel';

/**
 * Range-input styling shared by every efficiencies slider (touch-friendly
 * thumbs). Exported so BoundaryShiftLab renders the same rules — a duplicate
 * <style> tag with identical CSS is idempotent.
 */
export const EFF_CONTROL_STYLES = `
.eff-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 28px;
  background: transparent;
  cursor: pointer;
}
.eff-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
}
.eff-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--background);
}
.eff-range::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
}
.eff-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--background);
}
.eff-range:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;

/** Human cadence label: "every 30 min" / "every 90 s". */
function formatInterval(seconds: number): string {
  if (seconds < 120) return `every ${seconds} s`;
  return `every ${Math.round(seconds / 60)} min`;
}

/** Regime copy keyed off the real selectCacheTtl outcome. */
function regimeCopy(economics: CycleEconomics): string {
  switch (economics.regime) {
    case '5m':
      return '5-minute cache entries — the cheapest write premium (1.25×), self-refreshing on every read.';
    case '1h':
      return '1-hour cache entries — a 2× write premium, amortized across the wakes that read it.';
    default:
      return 'Too slow for volatile caching: entries would expire unread, so the loop stops caching the volatile block entirely. Stable blocks stay cached.';
  }
}

/** One segment of the stacked cost bar. */
function BarSegment({
  share,
  color,
  label,
}: {
  share: number;
  color: string;
  label: string;
}) {
  if (share <= 0.001) return null;
  return (
    <div
      title={label}
      style={{
        width: `${share * 100}%`,
        backgroundColor: color,
        height: '100%',
        transition: 'width var(--duration-normal) ease-out',
      }}
    />
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '2px',
          backgroundColor: color,
          display: 'inline-block',
        }}
      />
      {children}
    </span>
  );
}

export function CadenceCostExplorer() {
  const [intervalSeconds, setIntervalSeconds] = useState(900);
  const [cachedFraction, setCachedFraction] = useState(DEFAULT_CACHED_FRACTION);
  const [batchMode, setBatchMode] = useState(false);

  const economics = computeCycleEconomics({ intervalSeconds, cachedFraction, batchMode });
  const costPercent = Math.round(economics.relativeCost * 100);

  return (
    <div
      data-testid="cadence-cost-explorer"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
      }}
    >
      <style>{EFF_CONTROL_STYLES}</style>

      <p className="section-header" style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>
        The shape of the bill — drag the cadence
      </p>

      {/* Interval slider */}
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
          <span>Cycle interval</span>
          <span className="text-mono" data-testid="eff-interval-label" style={{ color: 'var(--text-primary)' }}>
            {formatInterval(intervalSeconds)}
          </span>
        </span>
        <input
          className="eff-range"
          type="range"
          data-testid="eff-interval-slider"
          min={INTERVAL_BOUNDS.min}
          max={INTERVAL_BOUNDS.max}
          step={30}
          value={intervalSeconds}
          onChange={(changeEvent) => setIntervalSeconds(Number(changeEvent.target.value))}
          aria-label="Cycle interval in seconds"
        />
      </label>

      {/* Cached-fraction slider */}
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
          <span>
            Cached share of the prompt{' '}
            <em style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(illustrative)</em>
          </span>
          <span className="text-mono" style={{ color: 'var(--text-primary)' }}>
            {Math.round(cachedFraction * 100)}%
          </span>
        </span>
        <input
          className="eff-range"
          type="range"
          data-testid="eff-cached-slider"
          min={0}
          max={0.95}
          step={0.05}
          value={cachedFraction}
          onChange={(changeEvent) => setCachedFraction(Number(changeEvent.target.value))}
          aria-label="Cached fraction of the prompt"
        />
      </label>

      {/* Batch toggle */}
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-lg)',
          minHeight: '32px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          data-testid="eff-batch-toggle"
          checked={batchMode}
          onChange={(changeEvent) => setBatchMode(changeEvent.target.checked)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
        />
        Off-hours batch window (≈ half rate, minutes of latency)
      </label>

      {/* Regime line — driven by the real selectCacheTtl */}
      <p
        data-testid="eff-regime"
        style={{
          margin: 0,
          marginBottom: 'var(--spacing-md)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          borderLeft: '2px solid var(--border)',
          paddingLeft: 'var(--spacing-md)',
        }}
      >
        {Math.round(economics.wakesPerDay)} wakes/day · {regimeCopy(economics)}
      </p>

      {/* Stacked cost bar vs uncached baseline */}
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '0.25rem',
          }}
        >
          <span>this design</span>
          <span>same prompt, uncached</span>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            height: '18px',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
          }}
        >
          <BarSegment share={economics.readShare} color="var(--success)" label="cache reads" />
          <BarSegment share={economics.freshShare} color="var(--accent)" label="fresh tail" />
          <BarSegment share={economics.writeShare} color="var(--warning)" label="amortized cache writes" />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm) var(--spacing-lg)',
            marginTop: '0.4rem',
          }}
        >
          <Legend color="var(--success)">cache reads (≈0.1×)</Legend>
          <Legend color="var(--accent)">fresh tail (1×)</Legend>
          <Legend color="var(--warning)">
            writes, amortized over ~{CYCLES_PER_BOUNDARY_SHIFT} cycles
          </Legend>
        </div>
      </div>

      {/* The headline ratio */}
      <p
        data-testid="eff-cost-readout"
        style={{
          margin: 0,
          marginTop: 'var(--spacing-md)',
          fontSize: '1rem',
          color: 'var(--text-primary)',
        }}
      >
        Each cycle costs{' '}
        <strong className="text-mono" style={{ color: 'var(--accent)' }}>
          ≈{costPercent}%
        </strong>{' '}
        of what the same prompt would cost uncached
        {economics.savingsFraction > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}
            — {Math.round(economics.savingsFraction * 100)}% of the naive bill never happens.
          </span>
        )}
      </p>
    </div>
  );
}

export default CadenceCostExplorer;
