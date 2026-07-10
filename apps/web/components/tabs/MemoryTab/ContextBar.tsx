/**
 * Context Bar Component
 *
 * @module components/tabs/MemoryTab/ContextBar
 * @description Compact horizontal bar showing token allocation at a glance.
 * This is the "hero" visualization for the Memory tab - showing cache structure
 * in a single scannable row.
 *
 * Design: Neural Observatory style with cyan accents and subtle glow effects.
 * Complements BlockVisualization which shows the detailed breakdown.
 *
 * @upstream Called by: MemoryTab/index.jsx
 * @downstream Imports: constants/blockStyles.js (getBarBlocks)
 *
 * @param {Object} props
 * @param {Object} props.tokenBreakdown - Token counts from /context endpoint
 * @param {boolean} [props.loading=false] - Show loading shimmer
 * @returns {React.ReactElement}
 *
 * @example
 * <ContextBar tokenBreakdown={tokenBreakdown} loading={contextLoading} />
 */

import { getBarBlocks } from '../../../constants/blockStyles';

/**
 * Format token count for display (e.g., 15400 -> "15.4k")
 */
function formatTokens(count: any) {
  if (!count || count === 0) return '0';
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}

// Block colors now sourced from shared config (DRY)
const BLOCKS: any[] = getBarBlocks();

interface ContextBarProps {
  tokenBreakdown?: any;
  loading?: boolean;
}

export default function ContextBar({ tokenBreakdown, loading = false }: ContextBarProps) {
  if (loading) {
    return (
      <div className="h-12 rounded-xl bg-surface border border-border-subtle animate-pulse">
        <div className="h-full flex items-center justify-center text-content-muted text-sm">
          Loading context...
        </div>
      </div>
    );
  }

  if (!tokenBreakdown) {
    return null;
  }

  const { total = 0 } = tokenBreakdown;

  // Calculate percentages
  const getPercentage = (key: any) => {
    const value = tokenBreakdown[key] || 0;
    if (total === 0) return 0;
    return (value / total) * 100;
  };

  // Calculate cache stats
  const cachedTokens = tokenBreakdown.cachedTokens || 0;
  const cachePercent = total > 0 ? Math.round((cachedTokens / total) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Compact header with total */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-content-secondary font-medium">Context</span>
          <span className="font-mono text-accent font-semibold text-glow">
            {formatTokens(total)} tokens
          </span>
        </div>
        <div className="flex items-center gap-3 text-content-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{cachePercent}% cached</span>
          </span>
        </div>
      </div>

      {/* Segmented bar */}
      <div
        className="h-8 rounded-lg overflow-hidden flex border border-border-subtle/50 glow-subtle"
        style={{ background: 'rgba(var(--void), 0.8)' }}
      >
        {BLOCKS.map((block) => {
          const percentage = getPercentage(block.key);
          const tokens = tokenBreakdown[block.key] || 0;

          if (percentage < 1) return null; // Skip tiny segments

          return (
            <div
              key={block.key}
              className={`relative bg-gradient-to-b ${block.gradient} flex items-center justify-center transition-all duration-300 group cursor-help`}
              style={{
                width: `${percentage}%`,
                minWidth: percentage > 5 ? '40px' : '0',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px ${block.glow}`,
              }}
              title={`${block.label}: ${formatTokens(tokens)} (${percentage.toFixed(1)}%)`}
            >
              {/* Label - only show if enough space */}
              {percentage > 12 && (
                <div className="text-xs font-semibold text-white/90 flex flex-col items-center leading-tight">
                  <span>{block.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">{formatTokens(tokens)}</span>
                </div>
              )}

              {/* Uncached indicator */}
              {block.uncached && percentage > 8 && (
                <div className="absolute bottom-0.5 right-1 text-[9px] text-white/60">
                  uncached
                </div>
              )}

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                <div className="bg-surface border border-border-subtle rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                  <span className="text-content-primary font-medium">{block.label}</span>
                  <span className="text-content-muted ml-2">{tokens.toLocaleString()} tok</span>
                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* Legend row - compact */}
      <div className="flex items-center gap-4 text-[10px] text-content-muted">
        {BLOCKS.map((block) => {
          const tokens = tokenBreakdown[block.key] || 0;
          if (tokens === 0) return null;

          return (
            <div key={block.key} className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-sm bg-gradient-to-b ${block.gradient}`}
                style={{ boxShadow: `0 0 4px ${block.glow}` }}
              />
              <span>{block.label}</span>
              <span className="font-mono text-content-secondary">{formatTokens(tokens)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


