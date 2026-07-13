/**
 * Personality Panel
 *
 * @module views/EditorView/PersonalityPanel
 * @description Export/import wiring for the editor tab. The view owns the
 * visible form; the store slice owns the export/import actions.
 *
 * @upstream Called by: EditorView
 * @downstream Calls: api.post('/personality/validate'), store export/import actions
 */

import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { LoadingSkeleton } from '../../components/ui';
import api, { getAdminPassword } from '../../api/client';

type ExportOptions = {
  includeHistory: boolean;
  historyLimit: number;
  includeAllHistory: boolean;
  includeSummaries: boolean;
  includeBranches: boolean;
  includeMedia: boolean;
  includeGallery: boolean;
};

interface ValidateResponse {
  valid?: boolean;
  errors?: string[];
}

interface PersonalityPanelProps {
  exportName: string;
  exportDescription: string;
  exportOptions: ExportOptions;
  isExporting: boolean;
  importFileName: string | null;
  importMode: string;
  importPreview: Record<string, unknown> | null;
  isPreviewing: boolean;
  isImporting: boolean;
  setExportName: (name: string) => void;
  setExportDescription: (description: string) => void;
  setExportOptions: (options: ExportOptions) => void;
  setImportMode: (mode: string) => void;
  clearImport: () => void;
  handleImportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readImportFile: () => Promise<Record<string, unknown> | null>;
  exportPersonality: () => Promise<Record<string, unknown> | null>;
  previewImport: (snapshot: Record<string, unknown>) => Promise<void>;
  importPersonality: (snapshot: Record<string, unknown>) => Promise<void>;
  addLog: (message: string) => void;
}

export function PersonalityPanel({
  exportName,
  exportDescription,
  exportOptions,
  isExporting,
  importFileName,
  importMode,
  importPreview,
  isPreviewing,
  isImporting,
  setExportName,
  setExportDescription,
  setExportOptions,
  setImportMode,
  clearImport,
  handleImportFileChange,
  readImportFile,
  exportPersonality,
  previewImport,
  importPersonality,
  addLog,
}: PersonalityPanelProps) {
  const updateExportOptions = useCallback(
    (patch: Partial<ExportOptions>) => {
      setExportOptions({
        ...exportOptions,
        ...patch,
      });
    },
    [exportOptions, setExportOptions],
  );

  const handleExport = useCallback(async () => {
    const snapshot = await exportPersonality();
    if (!snapshot) {
      return;
    }

    const filename = buildSnapshotFilename(exportName || 'personality');
    triggerJsonDownload(filename, snapshot);
  }, [exportName, exportPersonality]);

  const validateSnapshot = useCallback(
    async (snapshot: Record<string, unknown>) => {
      try {
        const result = await api.post<ValidateResponse>('/personality/validate', snapshot);
        if (!result.valid) {
          addLog(
            `❌ Import validation failed: ${
              result.errors?.[0] || 'snapshot format is not valid'
            }`,
          );
          return false;
        }
        return true;
      } catch (validationError: unknown) {
        addLog(
          `❌ Import validation failed: ${
            validationError instanceof Error
              ? validationError.message
              : String(validationError)
          }`,
        );
        return false;
      }
    },
    [addLog],
  );

  const handlePreview = useCallback(async () => {
    const snapshot = await readImportFile();
    if (!snapshot) {
      return;
    }

    if (!(await validateSnapshot(snapshot))) {
      return;
    }

    await previewImport(snapshot);
  }, [previewImport, readImportFile, validateSnapshot]);

  const handleImport = useCallback(async () => {
    const snapshot = await readImportFile();
    if (!snapshot) {
      return;
    }

    if (!(await validateSnapshot(snapshot))) {
      return;
    }

    const password = importMode === 'replace' ? getAdminPassword() : undefined;
    if (importMode === 'replace' && !password) {
      return;
    }

    if (password) {
      await importPersonality(snapshot, password);
      return;
    }

    await importPersonality(snapshot);
  }, [importMode, importPersonality, readImportFile, validateSnapshot]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>
          Personality export and import
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Export downloads the current snapshot. Import validates first, then previews, then applies.
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gap: 'var(--spacing-md)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600 }}>
            Export snapshot
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Snapshot name</span>
            <input
              type="text"
              value={exportName}
              onChange={(event) => setExportName(event.target.value)}
              placeholder="Showcase export"
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Description</span>
            <textarea
              value={exportDescription}
              onChange={(event) => setExportDescription(event.target.value)}
              placeholder="Why this snapshot exists"
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: '84px' }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gap: 'var(--spacing-xs)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            }}
          >
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeHistory}
                onChange={(event) => updateExportOptions({ includeHistory: event.target.checked })}
              />
              <span>History</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeSummaries}
                onChange={(event) => updateExportOptions({ includeSummaries: event.target.checked })}
              />
              <span>Summaries</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeBranches}
                onChange={(event) => updateExportOptions({ includeBranches: event.target.checked })}
              />
              <span>Branches</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeMedia}
                onChange={(event) => updateExportOptions({ includeMedia: event.target.checked })}
              />
              <span>Media</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeGallery}
                onChange={(event) => updateExportOptions({ includeGallery: event.target.checked })}
              />
              <span>Gallery</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={exportOptions.includeAllHistory}
                onChange={(event) => updateExportOptions({ includeAllHistory: event.target.checked })}
              />
              <span>All history</span>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>History limit</span>
            <input
              type="number"
              min={0}
              value={exportOptions.historyLimit}
              onChange={(event) =>
                updateExportOptions({
                  historyLimit: Number(event.target.value) || 0,
                })
              }
              style={fieldStyle}
            />
          </label>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || !exportName.trim()}
            style={primaryButtonStyle}
          >
            {isExporting ? 'Exporting…' : 'Export JSON'}
          </button>
        </section>

        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600 }}>
            Import snapshot
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Snapshot file</span>
            <input type="file" accept="application/json" onChange={handleImportFileChange} />
          </label>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {importFileName ? `Selected file: ${importFileName}` : 'Choose a snapshot file to begin.'}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Mode</span>
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value)}
              style={fieldStyle}
            >
              <option value="merge">Merge</option>
              <option value="branch">Branch</option>
              <option value="replace">Replace</option>
            </select>
          </label>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Replace mode prompts for the admin password on confirm.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={isPreviewing || !importFileName}
              style={secondaryButtonStyle}
            >
              {isPreviewing ? 'Previewing…' : 'Validate + preview'}
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isImporting || !importPreview}
              style={primaryButtonStyle}
            >
              {isImporting ? 'Importing…' : 'Confirm import'}
            </button>
            <button
              type="button"
              onClick={clearImport}
              disabled={!importFileName && !importPreview}
              style={secondaryButtonStyle}
            >
              Clear
            </button>
          </div>

          <div
            style={{
              minHeight: '120px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-raised)',
              padding: 'var(--spacing-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            {isPreviewing ? (
              <LoadingSkeleton variant="rows" count={2} rowHeight={36} />
            ) : importPreview ? (
              <pre style={previewStyle}>{JSON.stringify(importPreview, null, 2)}</pre>
            ) : (
              <div>Preview output appears here after validation.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function buildSnapshotFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'personality-snapshot'}.json`;
}

function triggerJsonDownload(filename: string, snapshot: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const fieldStyle = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  minHeight: '40px',
  padding: '0 var(--spacing-sm)',
};

const checkboxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
};

const primaryButtonStyle = {
  minHeight: '40px',
  padding: '0 var(--spacing-md)',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  backgroundColor: 'var(--accent)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  minHeight: '40px',
  padding: '0 var(--spacing-md)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const previewStyle = {
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  color: 'var(--text-secondary)',
};
