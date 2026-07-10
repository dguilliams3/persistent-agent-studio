const formatValue = (value: unknown, precision = 3) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return value.toFixed(precision);
};

const getZScoreColor = (zScore: unknown) => {
  const magnitude = typeof zScore === 'number' ? Math.abs(zScore) : Infinity;
  if (!Number.isFinite(magnitude)) return 'text-content-secondary';
  if (magnitude < 1) return 'text-success';
  if (magnitude < 2) return 'text-warning';
  return 'text-danger';
};

const getTrendLabel = (trend: unknown) => {
  switch (trend) {
    case 'drifting_outward':
      return { icon: '↗️', label: 'Drifting outward' };
    case 'converging':
      return { icon: '↘️', label: 'Converging' };
    case 'insufficient_data':
      return { icon: '…', label: 'Need more samples' };
    default:
      return { icon: '⟲', label: 'Stable' };
  }
};

interface BasinMetricsCardProps {
  basinData?: {
    global?: {
      meanDistance?: number;
      stdDistance?: number;
      outlierThreshold?: number;
      sampleCount?: number;
      computedAt?: string;
    };
    latestByType?: Record<string, {
      entryId?: number | string;
      entryTable?: string;
      entryType?: string;
      timestamp?: string;
      distance?: number;
      zScore?: number;
      isOutlier?: boolean;
    }>;
    recentTrend?: {
      last10Mean?: number;
      last10Std?: number;
      trend?: string;
    };
    outlierCount?: number;
  } | null;
  loading?: boolean;
  error?: string | null;
  onRecompute?: () => void;
}

export default function BasinMetricsCard({ basinData, loading, error, onRecompute }: BasinMetricsCardProps & { onRecompute?: () => void }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border-subtle bg-depth p-4">
        <p className="text-sm text-content-secondary">Loading basin metrics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/50 bg-danger/10 p-4">
        <p className="text-sm text-danger">Failed to load basin metrics: {error}</p>
        {onRecompute && (
          <button onClick={onRecompute} className="mt-2 text-sm underline">Retry Recompute</button>
        )}
      </div>
    );
  }

  if (!basinData || !basinData.global) {
    return (
      <div className="rounded-lg border border-border-subtle bg-depth p-4">
        <h3 className="text-base font-semibold text-content-primary mb-2">Basin Metrics</h3>
        <p className="text-sm text-content-secondary">
          Basin metrics have not been computed yet. Run a compute cycle to establish the centroid and thresholds.
        </p>
        {onRecompute && (
          <button onClick={onRecompute} className="mt-2 px-3 py-1.5 text-sm bg-accent text-white rounded">Recompute</button>
        )}
      </div>
    );
  }

  const { global, latestByType, recentTrend } = basinData;
  // Use latestByType (latest removed per contract); take first available type's latest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latest = latestByType ? Object.values(latestByType)[0] as any : null;
  const threshold = global.outlierThreshold || 1;
  const distanceRatio = latest?.distance ? Math.min(100, (latest.distance / threshold) * 100) : 0;
  const trendMeta = getTrendLabel(recentTrend?.trend);

  const computedAt = global.computedAt;
  const isStale = computedAt && (Date.now() - new Date(computedAt).getTime() > 7 * 24 * 60 * 60 * 1000);
  const stalenessText = computedAt 
    ? `computed ${new Date(computedAt).toLocaleDateString()} ${isStale ? '(STALE >7d)' : ''}`
    : '';

  return (
    <div className="rounded-lg border border-border-subtle bg-depth p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-content-primary">Basin Metrics</h3>
        <div className="flex items-center gap-2">
          {computedAt && (
            <span className={`text-xs font-medium ${isStale ? 'text-warning' : 'text-content-muted'}`}>
              {stalenessText}
            </span>
          )}
          {onRecompute && (
            <button
              onClick={onRecompute}
              className="text-xs px-2 py-1 border border-accent/50 rounded hover:bg-accent/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Recompute basin now"
            >
              Recompute
            </button>
          )}
        </div>
      </div>

      {latest ? (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-content-secondary mb-1">
            <span>Distance from centroid</span>
            <span>{formatValue(latest.distance)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-depth overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${distanceRatio}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-content-muted mt-1">
            <span>Centroid</span>
            <span>Threshold {formatValue(global.outlierThreshold)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-content-secondary mb-4">
          No embedded entries available to chart current distance.
        </p>
      )}

      {latest && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-content-secondary">Current z-score</div>
          <div className={`font-mono text-lg font-semibold ${getZScoreColor(latest.zScore)}`}>
            {Number.isFinite(latest.zScore) ? `${latest.zScore! >= 0 ? '+' : ''}${latest.zScore!.toFixed(2)}σ` : '--'}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-content-secondary">Trend</div>
        <div className="flex items-center gap-2 text-sm">
          <span>{trendMeta.icon}</span>
          <span>{trendMeta.label}</span>
        </div>
      </div>

      {recentTrend?.last10Mean && (
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <div className="text-content-muted text-xs uppercase">Last 10 mean</div>
            <div className="font-semibold text-content-primary">{formatValue(recentTrend.last10Mean)}</div>
          </div>
          <div>
            <div className="text-content-muted text-xs uppercase">Last 10 σ</div>
            <div className="font-semibold text-content-primary">{formatValue(recentTrend.last10Std)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded border border-border-subtle p-2">
          <div className="text-content-muted uppercase mb-1">Mean distance</div>
          <div className="text-base font-semibold text-content-primary">{formatValue(global.meanDistance)}</div>
        </div>
        <div className="rounded border border-border-subtle p-2">
          <div className="text-content-muted uppercase mb-1">Std dev</div>
          <div className="text-base font-semibold text-content-primary">{formatValue(global.stdDistance)}</div>
        </div>
        <div className="rounded border border-border-subtle p-2">
          <div className="text-content-muted uppercase mb-1">Samples</div>
          <div className="text-base font-semibold text-content-primary">{global.sampleCount ?? '--'}</div>
        </div>
      </div>

      {latest?.isOutlier && (
        <div className="mt-4 rounded border border-danger/80 bg-danger/10 p-3 text-sm text-danger">
          Latest entry exceeded the 2σ threshold. Review content in <span className="font-semibold">{latest.entryTable}</span> (ID #{latest.entryId}).
        </div>
      )}
    </div>
  );
}


