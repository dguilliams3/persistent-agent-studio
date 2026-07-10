/**
 * Block Visualization Component
 *
 * @module components/tabs/MemoryTab/BlockVisualization
 * @description Displays the 4-block cache structure with token allocation per block.
 * Shows cached vs uncached split where Blocks 1-3 are cached (Prompt Caching enabled)
 * and Block 4 is uncached (fresh tail, always included in input).
 *
 * Cache Architecture:
 * - Block 1 (blue): Static constitution (never changes, cached 1hr)
 * - Block 2 (green): Stable context - learned, questions, notebook, observations, promoted summaries
 * - Block 3 (yellow): Summaries prefix (older summaries in cached block)
 * - Block 4 (red): Fresh tail (newest history, never cached, always input)
 *
 * Blocks 1-3 save 90% of token cost when hit in cache. Block 4 is always uncached.
 *
 * @upstream Called by: MemoryTab - Renders at top of tab
 * @downstream Calls: None - Pure presentational component
 *
 * @param {Object} props - Component props
 * @param {Object} props.tokenBreakdown - Token counts per block from /context endpoint
 * @param {number} props.tokenBreakdown.block1_system - Constitution tokens (cached)
 * @param {number} props.tokenBreakdown.block2_stable - Stable context tokens (cached)
 * @param {number} props.tokenBreakdown.block3_summariesPrefix - Summaries tokens (cached)
 * @param {number} props.tokenBreakdown.block4_fresh - Fresh tail tokens (uncached)
 * @param {number} props.tokenBreakdown.cachedTokens - Sum of blocks 1-3 (computed)
 * @param {number} props.tokenBreakdown.uncachedTokens - Sum of block 4 (computed)
 * @param {number} props.tokenBreakdown.total - Total tokens (computed)
 * @returns {React.ReactElement} Stacked bar visualization with legend
 *
 * @example
 * const tokenBreakdown = {
 *   block1_system: 1200,
 *   block2_stable: 800,
 *   block3_summariesPrefix: 2500,
 *   block4_fresh: 3000,
 *   cachedTokens: 4500,
 *   uncachedTokens: 3000,
 *   total: 7500
 * };
 * <BlockVisualization tokenBreakdown={tokenBreakdown} />
 */

interface BlockVisualizationProps {
  tokenBreakdown?: {
    block1_system?: number;
    block2_stable?: number;
    block3_summariesPrefix?: number;
    block4_fresh?: number;
    cachedTokens?: number;
    uncachedTokens?: number;
    total?: number;
  };
}

/**
 * @description Renders the 4-block cache structure visualization
 *
 * This is a pure presentational component that receives pre-calculated token
 * counts and displays them as a stacked horizontal bar chart with detailed
 * breakdown. It highlights cache efficiency by showing the 90% cost savings
 * from Anthropic's Prompt Caching on Blocks 1-3.
 *
 * @upstream Called by: MemoryTab - Renders at the top of the memory tab
 * @downstream Calls: None - Pure presentational component with no dependencies
 *
 * @param {Object} props - Component props
 * @param {Object} props.tokenBreakdown - Token counts per block from /context endpoint
 * @param {number} props.tokenBreakdown.block1_system - Constitution tokens
 * @param {number} props.tokenBreakdown.block2_stable - Stable context tokens
 * @param {number} props.tokenBreakdown.block3_summariesPrefix - Cached summaries tokens
 * @param {number} props.tokenBreakdown.block4_fresh - Fresh tail tokens (uncached)
 * @param {number} props.tokenBreakdown.cachedTokens - Sum of blocks 1-3
 * @param {number} props.tokenBreakdown.uncachedTokens - Sum of block 4
 * @param {number} props.tokenBreakdown.total - Total tokens
 * @returns {React.ReactElement} Stacked horizontal bar with legend and statistics
 *
 * @example
 * const breakdown = {
 *   block1_system: 1200,
 *   block2_stable: 800,
 *   block3_summariesPrefix: 2500,
 *   block4_fresh: 3000,
 *   cachedTokens: 4500,
 *   uncachedTokens: 3000,
 *   total: 7500
 * };
 * <BlockVisualization tokenBreakdown={breakdown} />
 *
 * @note Returns null if tokenBreakdown is not provided (safe for conditional rendering)
 * @note Cache cost savings calculation assumes Anthropic's current pricing: 90% reduction for cached tokens
 */
export default function BlockVisualization({ tokenBreakdown }: BlockVisualizationProps) {
  if (!tokenBreakdown) {
    return null;
  }

  const {
    block1_system = 0,
    block2_stable = 0,
    block3_summariesPrefix = 0,
    block4_fresh = 0,
    cachedTokens = 0,
    uncachedTokens = 0,
    total = 0
  } = tokenBreakdown;

  // Blocks definition with colors and labels
  const blocks = [
    {
      id: 'block1',
      name: 'Block 1',
      label: 'Constitution',
      tokens: block1_system,
      color: 'bg-blue-500',
      cached: true,
      description: 'Static system prompt (cached)'
    },
    {
      id: 'block2',
      name: 'Block 2',
      label: 'Stable Context',
      tokens: block2_stable,
      color: 'bg-green-500',
      cached: true,
      description: 'Learned, questions, notebook, observations (cached)'
    },
    {
      id: 'block3',
      name: 'Block 3',
      label: 'Cached Summaries',
      tokens: block3_summariesPrefix,
      color: 'bg-yellow-500',
      cached: true,
      description: 'Older summaries in cached block (cached)'
    },
    {
      id: 'block4',
      name: 'Block 4',
      label: 'Fresh Tail',
      tokens: block4_fresh,
      color: 'bg-red-500',
      cached: false,
      description: 'Latest history (never cached, always input)'
    }
  ];

  // Calculate percentages for bar widths
  const getPercentage = (tokens: any) => {
    if (total === 0) return 0;
    return (tokens / total) * 100;
  };

  // Format large numbers with commas
  const formatNumber = (num: any) => num.toLocaleString();

  // Calculate cost savings based on Opus pricing from worker/src/constants.js MODEL_PRICING
  // Opus input: $5/MTok (MODEL_PRICING.opus.inputPerMillion)
  // Cache read discount: 0.1 (pay 10%) from CACHE_PRICING.cacheReadDiscount
  // So: Uncached = $5/MTok, Cached = $0.50/MTok, Savings = $4.50/MTok
  const INPUT_PRICE_PER_MTOK = 5.0;      // MODEL_PRICING.opus.inputPerMillion
  const CACHE_READ_DISCOUNT = 0.1;       // CACHE_PRICING.cacheReadDiscount
  const cachedPricePerMTok = INPUT_PRICE_PER_MTOK * CACHE_READ_DISCOUNT;
  const savingsPerMTok = INPUT_PRICE_PER_MTOK - cachedPricePerMTok;
  const cachedCostReduction = Math.round((cachedTokens / 1000000) * savingsPerMTok * 100) / 100;

  return (
    <div className="space-y-3">
      {/* Stacked bar visualization */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-content-secondary font-medium">Context Structure</span>
          <span className="text-content-muted">
            {formatNumber(total)} tokens total
            {cachedTokens > 0 && (
              <span className="text-success ml-2">
                ~{formatNumber(cachedTokens)} cached (90% cost savings)
              </span>
            )}
          </span>
        </div>

        {/* Horizontal stacked bar */}
        <div className="flex h-8 rounded-md overflow-hidden border border-border-subtle bg-depth shadow-sm">
          {blocks.map((block) => {
            const percentage = getPercentage(block.tokens);
            const isVisible = percentage > 2; // Only show label if >2% width

            return (
              <div
                key={block.id}
                style={{ width: `${percentage}%` }}
                className={`${block.color} transition-all duration-fast relative group hover:opacity-90 cursor-help`}
                title={`${block.name}: ${formatNumber(block.tokens)} tokens (${percentage.toFixed(1)}%)`}
              >
                {/* Label - only show if there's enough space */}
                {isVisible && (
                  <div className="flex items-center justify-center h-full text-xs font-semibold text-white/90 px-1">
                    <span className="truncate">{block.name}</span>
                  </div>
                )}

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-surface border border-border-subtle rounded-md p-2 text-xs text-content-primary whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{block.label}</div>
                    <div className="text-content-muted">{formatNumber(block.tokens)} tokens</div>
                    <div className="text-content-muted">{percentage.toFixed(1)}% of total</div>
                    {block.cached && (
                      <div className="text-success text-xs mt-1">✓ Cached (90% cost savings)</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed breakdown with legend */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="bg-depth rounded-md p-2 border border-border-subtle text-xs"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-sm ${block.color}`} />
              <span className="font-medium text-content-primary">{block.name}</span>
            </div>
            <div className="text-content-secondary">
              {formatNumber(block.tokens)} tok
            </div>
            <div className={`text-xs mt-1 ${block.cached ? 'text-success' : 'text-warning'}`}>
              {block.cached ? '🔒 Cached' : '🔓 Uncached'}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="bg-depth/50 rounded-md p-3 border border-border-subtle space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-content-secondary">Cached Tokens (Blocks 1-3):</span>
          <span className="font-mono font-semibold text-success">
            {formatNumber(cachedTokens)}
            <span className="text-content-muted text-xs ml-2">({((cachedTokens / total) * 100).toFixed(1)}%)</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-content-secondary">Uncached Tokens (Block 4):</span>
          <span className="font-mono font-semibold text-warning">
            {formatNumber(uncachedTokens)}
            <span className="text-content-muted text-xs ml-2">({((uncachedTokens / total) * 100).toFixed(1)}%)</span>
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border-subtle">
          <span className="text-content-primary font-medium">Approximate Cache Cost Savings:</span>
          <span className="font-mono font-semibold text-success">
            ~${cachedCostReduction.toFixed(2)} per cycle
          </span>
        </div>
      </div>

      {/* Cache info */}
      <div className="text-xs text-content-muted italic bg-depth/30 rounded-md p-2 border border-border-subtle/50">
        <strong>Cache Note:</strong> Blocks 1-3 are cached with Anthropic's Prompt Caching. Cache hits save 90% on input tokens.
        Block 4 (fresh tail) is never cached and always counts full price. Cache TTL is typically 1 hour.
      </div>
    </div>
  );
}



