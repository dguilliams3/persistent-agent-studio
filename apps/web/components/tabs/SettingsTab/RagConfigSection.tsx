/**
 * RAG Config Section Component
 *
 * @module components/tabs/SettingsTab/RagConfigSection
 * @description RAG retrieval configuration panel with enable/disable,
 * topK, halflife, similarity, MMR, and scoring weights.
 *
 * @upstream Called by: SettingsTab index
 * @downstream Calls: Props handlers for RAG config updates
 */

interface RagConfigSectionProps {
  ragEnabled: boolean;
  setRagEnabled: (v: boolean) => void;
  ragTopK: number;
  setRagTopK: (v: number) => void;
  ragHalflife: number;
  setRagHalflife: (v: number) => void;
  ragMinSimilarity: number;
  setRagMinSimilarity: (v: number) => void;
  ragMmrLambda: number;
  setRagMmrLambda: (v: number) => void;
  ragWeights: { similarity: number; recency: number; importance: number };
  setRagWeights: (fn: (prev: any) => any) => void;
  ragConfig: Record<string, any> | null;
  isSavingRag: boolean;
  updateRagConfig: (config: Record<string, any>) => void;
}

export default function RagConfigSection({
  ragEnabled, setRagEnabled, ragTopK, setRagTopK, ragHalflife, setRagHalflife,
  ragMinSimilarity, setRagMinSimilarity, ragMmrLambda, setRagMmrLambda,
  ragWeights, setRagWeights, ragConfig, isSavingRag, updateRagConfig,
}: RagConfigSectionProps) {
  const weightsSum = Math.round(
    ((parseFloat(String(ragWeights.similarity)) || 0) +
     (parseFloat(String(ragWeights.recency)) || 0) +
     (parseFloat(String(ragWeights.importance)) || 0)) * 100
  ) / 100;
  const isValidWeights = Math.abs(weightsSum - 1) < 0.05;

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ragEnabled} onChange={(e) => { setRagEnabled(e.target.checked); updateRagConfig({ enabled: e.target.checked }); }} disabled={isSavingRag} className="w-5 h-5 sm:w-4 sm:h-4 rounded bg-depth border-border-subtle text-accent focus:ring-accent" />
          <span className="text-content-primary">Enable RAG Retrieval</span>
          <span className="text-content-muted text-xs">{ragEnabled ? '(active)' : '(disabled)'}</span>
        </label>
      </div>

      {ragEnabled && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* TopK */}
          <div className="space-y-1">
            <label className="text-content-secondary text-sm">Summaries to Retrieve (topK)</label>
            <div className="flex items-center gap-2">
              <input type="range" min="1" max="10" value={ragTopK} onChange={(e) => setRagTopK(parseInt(e.target.value))} onMouseUp={() => updateRagConfig({ topK: ragTopK })} disabled={isSavingRag} className="flex-1 accent-accent" />
              <span className="text-accent w-6 text-center">{ragTopK}</span>
            </div>
          </div>

          {/* Halflife */}
          <div className="space-y-1">
            <label className="text-content-secondary text-sm">Recency Halflife (days)</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="365" value={ragHalflife} onChange={(e) => setRagHalflife(parseInt(e.target.value) || 14)} onBlur={() => updateRagConfig({ recencyHalflifeDays: ragHalflife })} onKeyDown={(e) => e.key === 'Enter' && updateRagConfig({ recencyHalflifeDays: ragHalflife })} disabled={isSavingRag} className="input-sm w-20 text-center" />
              <span className="text-content-muted text-xs">days for 50% decay</span>
            </div>
          </div>

          {/* Min Similarity */}
          <div className="space-y-1">
            <label className="text-content-secondary text-sm">Min Similarity Threshold</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="1" step="0.05" value={ragMinSimilarity} onChange={(e) => setRagMinSimilarity(parseFloat(e.target.value))} onMouseUp={() => updateRagConfig({ minSimilarity: ragMinSimilarity })} disabled={isSavingRag} className="flex-1 accent-accent" />
              <span className="text-accent w-10 text-center">{ragMinSimilarity.toFixed(2)}</span>
            </div>
          </div>

          {/* MMR Lambda */}
          <div className="space-y-1">
            <label className="text-content-secondary text-sm">MMR Diversity (lambda)</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="1" step="0.1" value={ragMmrLambda} onChange={(e) => setRagMmrLambda(parseFloat(e.target.value))} onMouseUp={() => updateRagConfig({ mmrLambda: ragMmrLambda })} disabled={isSavingRag} className="flex-1 accent-accent" />
              <span className="text-accent w-10 text-center">{ragMmrLambda.toFixed(1)}</span>
            </div>
            <div className="text-content-muted text-xs">0 = max diversity, 1 = max relevance</div>
          </div>

          {/* Weights */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-content-secondary text-sm">Scoring Weights (must sum to 1.0)</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-content-muted text-xs">Similarity</span>
                <input type="number" min="0" max="1" step="0.1" value={ragWeights.similarity} onChange={(e) => setRagWeights((prev) => ({ ...prev, similarity: parseFloat(e.target.value) || 0 }))} className="input-sm w-full text-center" />
              </div>
              <div>
                <span className="text-content-muted text-xs">Recency</span>
                <input type="number" min="0" max="1" step="0.1" value={ragWeights.recency} onChange={(e) => setRagWeights((prev) => ({ ...prev, recency: parseFloat(e.target.value) || 0 }))} className="input-sm w-full text-center" />
              </div>
              <div>
                <span className="text-content-muted text-xs">Importance</span>
                <input type="number" min="0" max="1" step="0.1" value={ragWeights.importance} onChange={(e) => setRagWeights((prev) => ({ ...prev, importance: parseFloat(e.target.value) || 0 }))} className="input-sm w-full text-center" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isValidWeights ? 'text-success' : 'text-warning'}`}>Sum: {weightsSum.toFixed(2)}</span>
              <button onClick={() => updateRagConfig({ weights: ragWeights })} disabled={isSavingRag || !isValidWeights} className="bg-accent hover:bg-accent/80 text-white px-3 py-1 text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Apply Weights</button>
            </div>
          </div>
        </div>
      )}

      {ragConfig && (
        <div className="text-xs text-content-muted pt-2 border-t border-border-subtle">
          Current: topK={ragConfig.topK}, halflife={ragConfig.recencyHalflifeDays}d, minSim=
          {ragConfig.minSimilarity}, mmr={ragConfig.mmrLambda}, weights=[
          {ragConfig.weights?.similarity}/{ragConfig.weights?.recency}/
          {ragConfig.weights?.importance}]
        </div>
      )}
    </div>
  );
}
