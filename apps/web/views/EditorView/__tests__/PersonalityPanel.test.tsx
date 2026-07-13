import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalityPanel } from '../PersonalityPanel';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: {
    post: mocks.apiPost,
  },
  api: {
    post: mocks.apiPost,
  },
}));

const baseProps = {
  exportName: 'Showcase export',
  exportDescription: 'A short snapshot description',
  exportOptions: {
    includeHistory: true,
    historyLimit: 50,
    includeAllHistory: false,
    includeSummaries: true,
    includeBranches: true,
    includeMedia: false,
    includeGallery: true,
  },
  isExporting: false,
  importFileName: 'snapshot.json',
  importMode: 'merge',
  importPreview: { changes: [] },
  isPreviewing: false,
  isImporting: false,
  setExportName: vi.fn(),
  setExportDescription: vi.fn(),
  setExportOptions: vi.fn(),
  setImportMode: vi.fn(),
  clearImport: vi.fn(),
  handleImportFileChange: vi.fn(),
  readImportFile: vi.fn(),
  exportPersonality: vi.fn(),
  previewImport: vi.fn(),
  importPersonality: vi.fn(),
  addLog: vi.fn(),
};

describe('PersonalityPanel', () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
    vi.mocked(baseProps.readImportFile).mockReset();
    vi.mocked(baseProps.exportPersonality).mockReset();
    vi.mocked(baseProps.previewImport).mockReset();
    vi.mocked(baseProps.importPersonality).mockReset();
    vi.mocked(baseProps.addLog).mockReset();
  });

  it('downloads the export snapshot as JSON', async () => {
    const snapshot = {
      meta: { name: 'Showcase export' },
      memories: { history: [] },
    };
    const createObjectUrl = vi.fn(() => 'blob:showcase');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrl,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrl,
      configurable: true,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    vi.mocked(baseProps.exportPersonality).mockResolvedValue(snapshot);

    render(
      <PersonalityPanel
        {...baseProps}
        exportPersonality={baseProps.exportPersonality}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export json/i }));

    await waitFor(() => expect(baseProps.exportPersonality).toHaveBeenCalled());
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:showcase');

    clickSpy.mockRestore();
  });

  it('validates, previews, and imports a selected snapshot', async () => {
    const snapshot = {
      meta: { name: 'Showcase export' },
      memories: { history: [{ id: 1 }] },
      branches: { list: [] },
    };
    vi.mocked(baseProps.readImportFile).mockResolvedValue(snapshot);
    vi.mocked(baseProps.previewImport).mockResolvedValue(undefined);
    vi.mocked(baseProps.importPersonality).mockResolvedValue(undefined);
    mocks.apiPost.mockResolvedValue({
      valid: true,
      errors: [],
      stats: { historyCount: 1 },
    });

    render(<PersonalityPanel {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /validate \+ preview/i }));

    await waitFor(() =>
      expect(mocks.apiPost).toHaveBeenCalledWith('/personality/validate', snapshot),
    );
    expect(baseProps.previewImport).toHaveBeenCalledWith(snapshot);

    fireEvent.click(screen.getByRole('button', { name: /confirm import/i }));

    await waitFor(() =>
      expect(baseProps.importPersonality).toHaveBeenCalledWith(snapshot),
    );
  });
});
