/**
 * Data Export Panel
 *
 * @module tabs/SemanticMonitorTab/views/DataExportPanel
 * @description Provides data export functionality for SIM research data.
 * Exports axis scores, basin metrics, trajectory, and anomalies in JSON or CSV.
 * Critical for publishability — researchers need to analyze in Python/R.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab orchestrator
 * @downstream Calls:
 *   - ../hooks/useSIMData.js - Data access hook
 *   - ../../../ui/Icon.jsx - Lucide icons
 */

import { useState, useCallback } from 'react';
import { Icon } from '../../../ui';
import { useSIMData } from '../hooks/useSIMData';

type ExportFormat = 'json' | 'csv';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataExportPanel() {
  const { exportSIMData, error } = useSIMData();

  const [format, setFormat] = useState<ExportFormat>('json');
  const [includeEmbeddings, setIncludeEmbeddings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setLastExport(null);

    try {
      await exportSIMData({ format, includeEmbeddings });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      setLastExport(`sim-export-${timestamp}.${format} (downloaded)`);
    } finally {
      setExporting(false);
    }
  }, [exportSIMData, format, includeEmbeddings]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
          <Icon name="Download" size={20} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-content-primary">
            Data Export
          </h2>
          <p className="text-xs text-content-muted">
            Export SIM data for analysis in Python, R, or other tools
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-danger/50 bg-danger/10 p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Export options */}
      <div className="rounded-lg border border-border-subtle bg-surface p-4 space-y-4">
        <h3 className="text-sm font-semibold text-content-primary">Export Options</h3>

        {/* Format selection */}
        <div>
          <label className="text-xs text-content-muted uppercase mb-2 block">Format</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === 'json'}
                onChange={() => setFormat('json')}
                className="text-accent"
              />
              <span className="text-sm text-content-secondary">
                JSON (full export: axes, scores, trajectory, anomalies)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                className="text-accent"
              />
              <span className="text-sm text-content-secondary">
                CSV (trajectory only, for spreadsheets)
              </span>
            </label>
          </div>
        </div>

        {/* Options */}
        {format === 'json' && (
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEmbeddings}
                onChange={(e) => setIncludeEmbeddings(e.target.checked)}
                className="rounded text-accent"
              />
              <span className="text-sm text-content-secondary">
                Include raw embedding vectors
              </span>
              <span className="text-[10px] text-content-muted">
                (768-dim per entry, significantly increases file size)
              </span>
            </label>
          </div>
        )}

        {/* What's included */}
        <div className="rounded border border-border-subtle bg-surface p-3">
          <h4 className="text-xs font-medium text-content-muted uppercase mb-2">
            {format === 'json' ? 'JSON Export Includes' : 'CSV Export Includes'}
          </h4>
          {format === 'json' ? (
            <ul className="space-y-1 text-xs text-content-secondary">
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Basin metrics (centroid stats, sample count, thresholds)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Concept axes (names, descriptions, examples)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Axis scores (per-entry projections)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Trajectory (timestamps, distances, z-scores, content)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Anomaly flags (outliers, verdicts)
              </li>
              {includeEmbeddings && (
                <li className="flex items-center gap-2">
                  <Icon name="Check" size={12} className="text-warning" />
                  Raw embeddings (768-dim Float32 arrays)
                </li>
              )}
            </ul>
          ) : (
            <ul className="space-y-1 text-xs text-content-secondary">
              <li className="flex items-center gap-2">
                <Icon name="Check" size={12} className="text-success" />
                Trajectory points: id, table, type, timestamp, distance, zScore, isOutlier, content
              </li>
            </ul>
          )}
        </div>

        {/* Export button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       rounded bg-emerald-500 text-white hover:bg-emerald-600
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {exporting ? (
              <>
                <Icon name="Loader2" size={16} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Icon name="Download" size={16} />
                Export {format.toUpperCase()}
              </>
            )}
          </button>

          {lastExport && (
            <span className="text-xs text-content-muted flex items-center gap-1">
              <Icon name="Check" size={12} className="text-success" />
              Downloaded: {lastExport}
            </span>
          )}
        </div>
      </div>

      {/* Format documentation */}
      <div className="rounded-lg border border-border-subtle bg-surface p-4">
        <h3 className="text-sm font-semibold text-content-primary mb-2">Export Format</h3>
        <p className="text-xs text-content-muted mb-3">
          The JSON export follows the <code className="bg-surface px-1 rounded">sim-export-v1</code> format.
          Load in Python with:
        </p>
        <pre className="text-xs text-content-secondary bg-surface rounded p-3 overflow-x-auto">
{`import json
import pandas as pd

with open('sim-export-*.json') as f:
    data = json.load(f)

# Trajectory as DataFrame
df = pd.DataFrame(data['trajectory'])
df['timestamp'] = pd.to_datetime(df['timestamp'])

# Basin metrics
print(f"Mean distance: {data['basinMetrics']['meanDistance']}")
print(f"Std distance: {data['basinMetrics']['stdDistance']}")
print(f"Sample count: {data['basinMetrics']['sampleCount']}")`}
        </pre>
      </div>
    </div>
  );
}

export default DataExportPanel;
