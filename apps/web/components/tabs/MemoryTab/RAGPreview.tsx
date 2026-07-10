/**
 * RAG Preview Component
 *
 * @module components/tabs/MemoryTab/RAGPreview
 * @description Shows which summaries/notebooks were retrieved by semantic search.
 * Displays RAG retrieval results with similarity scores, helping users understand
 * what context Clio is receiving from the archive.
 *
 * Neural Observatory Design:
 * - Cyan accent for active RAG entries
 * - Similarity scores as colored bars
 * - Click to expand and see full content
 * - Token counts per entry
 *
 * @upstream Called by: MemoryTab/index.jsx
 * @downstream Calls: None (pure presentational)
 *
 * @param {Object} props
 * @param {Array} props.ragResults - Array of RAG retrieval results
 * @param {number} props.ragResults[].id - Summary or notebook ID
 * @param {string} props.ragResults[].type - 'summary' or 'notebook'
 * @param {string} props.ragResults[].range - Covered range (summary) or title (notebook)
 * @param {string} props.ragResults[].content - Full text content
 * @param {number} props.ragResults[].tokenCount - Token count for entry
 * @param {Object} props.ragResults[].scores - Similarity scores
 * @param {number} props.ragResults[].scores.similarity - 0-1 cosine similarity
 * @param {number} props.ragResults[].scores.recency - 0-1 recency score
 * @param {number} props.ragResults[].scores.importance - 0-1 importance score
 * @param {number} props.ragResults[].scores.combined - Weighted combined score
 * @param {number} props.ragResults[].scores.mmr - MMR-adjusted score (after diversity)
 * @param {boolean} [props.ragEnabled=false] - Whether RAG is enabled
 * @param {boolean} [props.loading=false] - Show loading state
 * @returns {React.ReactElement}
 *
 * @example
 * <RAGPreview
 *   ragResults={[{ id: 5, type: 'summary', range: 'Jan 15-16', content: '...', tokenCount: 450, scores: { similarity: 0.72, combined: 0.65, mmr: 0.58 }}]}
 *   ragEnabled={true}
 * />
 */

import { useState } from 'react';
import { Database, FileText, TrendingUp, Power, PowerOff, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

/**
 * Get color class based on similarity score (0-1)
 */
function getScoreColor(score: any) {
  if (score >= 0.7) return 'bg-success text-success';
  if (score >= 0.5) return 'bg-emerald-500/70 text-emerald-400';
  if (score >= 0.35) return 'bg-amber-500/70 text-amber-400';
  return 'bg-rose-500/50 text-rose-400';
}

/**
 * Format score as percentage
 */
function formatScore(score: any) {
  return `${Math.round((score || 0) * 100)}%`;
}

/**
 * Single RAG result item with expand/collapse
 */
function RAGItem({ result, isExpanded, onToggle }: any) {
  const { type, id, range, content, tokenCount, scores } = result;
  const Icon = type === 'summary' ? Database : FileText;

  // API returns 'similarity', 'combined', and 'mmr' scores
  // Show similarity (raw cosine) as the main score, combined as secondary
  const similarityScore = scores?.similarity || 0;
  const combinedScore = scores?.combined || 0;
  const mmrScore = scores?.mmr;

  return (
    <div className="bg-depth rounded-md border border-border-subtle hover:border-accent/30 transition-colors">
      {/* Clickable header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-2 text-left group"
      >
        {/* Expand indicator */}
        <div className="text-content-muted group-hover:text-accent transition-colors">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {/* Type icon */}
        <div className={`p-1.5 rounded ${type === 'summary' ? 'bg-accent/10' : 'bg-emerald-500/10'}`}>
          <Icon size={14} className={type === 'summary' ? 'text-accent' : 'text-emerald-400'} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-content-muted">#{id}</span>
            <span className="text-xs text-content-secondary truncate">{range}</span>
          </div>
        </div>

        {/* Token count */}
        {tokenCount && (
          <span className="text-[10px] text-content-muted font-mono">
            {tokenCount.toLocaleString()} tok
          </span>
        )}

        {/* Similarity score bar + value */}
        <div className="flex items-center gap-2">
          {/* Score bar */}
          <div className="w-12 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getScoreColor(similarityScore).split(' ')[0]}`}
              style={{ width: `${Math.min(similarityScore * 100, 100)}%` }}
            />
          </div>

          {/* Score value */}
          <span className={`text-xs font-mono font-medium w-8 ${getScoreColor(similarityScore).split(' ')[1]}`}>
            {formatScore(similarityScore)}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle/50">
          {/* Score breakdown */}
          <div className="flex flex-wrap gap-3 mb-2 text-[10px] text-content-muted">
            <span title="Raw cosine similarity">
              <span className="text-accent">Sim:</span> {formatScore(similarityScore)}
            </span>
            <span title="Weighted score (similarity + recency + importance)">
              <span className="text-amber-400">Combined:</span> {formatScore(combinedScore)}
            </span>
            {mmrScore !== undefined && (
              <span title="MMR-adjusted score (after diversity penalty)">
                <span className="text-emerald-400">MMR:</span> {formatScore(mmrScore)}
              </span>
            )}
            {scores?.recency !== undefined && (
              <span title="Recency score (exponential decay)">
                <span className="text-blue-400">Recency:</span> {formatScore(scores.recency)}
              </span>
            )}
          </div>

          {/* Full content */}
          <div className="text-xs text-content-secondary bg-surface rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {content || <span className="text-content-muted italic">No content available</span>}
          </div>
        </div>
      )}
    </div>
  );
}


interface RAGPreviewProps {
  ragResults?: Array<{
    id: number;
    type: string;
    range?: string;
    content?: string;
    tokenCount?: number;
    scores?: {
      similarity?: number;
      recency?: number;
      importance?: number;
      combined?: number;
      mmr?: number;
    };
  }>;
  ragEnabled?: boolean;
  loading?: boolean;
  mmrLambda?: number;
}

/**
 * Main RAGPreview component - used as sidebar section content
 */
export default function RAGPreview({ ragResults = [], ragEnabled = false, loading = false, mmrLambda = 0.7 }: RAGPreviewProps) {
  // Track which items are expanded
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpanded = (id: any, type: any) => {
    const key = `${type}-${id}`;
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-3 bg-surface rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2 text-content-muted text-sm animate-pulse">
          <Database size={16} />
          <span>Loading RAG status...</span>
        </div>
      </div>
    );
  }

  // RAG disabled state
  if (!ragEnabled) {
    return (
      <div className="p-3 bg-surface rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2 text-content-muted text-sm">
          <PowerOff size={16} className="text-content-muted/50" />
          <span>RAG retrieval is disabled</span>
          <span className="text-[10px] text-content-muted/50 ml-auto">Enable in Settings</span>
        </div>
      </div>
    );
  }

  // No results (RAG enabled but nothing retrieved)
  if (ragResults.length === 0) {
    return (
      <div className="p-3 bg-surface rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2 text-sm">
          <Power size={16} className="text-success" />
          <span className="text-content-secondary">RAG enabled</span>
          <span className="text-content-muted text-xs">— No relevant memories retrieved for current context</span>
        </div>
      </div>
    );
  }

  // Sort by combined score (highest first) - this is the weighted score used for ranking
  const sortedResults = [...ragResults].sort((a, b) =>
    (b.scores?.combined || 0) - (a.scores?.combined || 0)
  );

  // Calculate total tokens from RAG (use actual count if available, else estimate)
  const totalRagTokens = ragResults.reduce((sum, r) => sum + (r.tokenCount || 200), 0);

  return (
    <div className="bg-surface rounded-lg border border-accent/20 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-accent/5 border-b border-accent/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-accent">RAG Retrieved</span>
          <span className="text-xs text-content-muted">
            {ragResults.length} {ragResults.length === 1 ? 'memory' : 'memories'}
          </span>
        </div>
        <div className="text-[10px] text-content-muted font-mono">
          {totalRagTokens.toLocaleString()} tok total
        </div>
      </div>

      {/* Results list */}
      <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto">
        {sortedResults.map((result) => (
          <RAGItem
            key={`${result.type}-${result.id}`}
            result={result}
            isExpanded={expandedIds.has(`${result.type}-${result.id}`)}
            onToggle={() => toggleExpanded(result.id, result.type)}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-depth/50 border-t border-border-subtle">
        <p className="text-[10px] text-content-muted">
          Retrieved via MMR (λ={mmrLambda?.toFixed?.(1) ?? mmrLambda ?? '0.7'}): balances relevance with diversity. Click entries to expand.
        </p>
      </div>
    </div>
  );
}


