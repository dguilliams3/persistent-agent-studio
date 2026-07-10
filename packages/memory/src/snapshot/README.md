# @persistence/memory/snapshot

Personality snapshot import/export utilities for Clio's memory system.

## What This Does

Handles serialization and validation of Clio's complete personality state:
- History entries, cold storage, notebook, observations
- State settings (loop_count, current_status, etc.)
- Memory branches and overrides
- Image references for gallery export/import

## Usage

```typescript
import {
  validateSnapshotFormat,
  calculateChecksum,
  verifyChecksum,
  SNAPSHOT_VERSION,
  EXPORTABLE_STATE_KEYS,
} from '@persistence/memory';

// Validate a snapshot before import
const result = validateSnapshotFormat(incomingData);
if (!result.valid) {
  console.error('Invalid snapshot:', result.errors);
}

// Verify integrity
const isValid = await verifyChecksum(snapshot);

// Check version compatibility
if (snapshot.meta.version !== SNAPSHOT_VERSION) {
  console.warn('Version mismatch');
}
```

## Files

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces for PersonalitySnapshot, ImageRef, GalleryExport |
| `constants.ts` | SNAPSHOT_VERSION, EXPORTABLE_STATE_KEYS, size limits |
| `checksum.ts` | SHA-256 checksum calculation and verification |
| `validation.ts` | Structure validation for import safety |
| `index.ts` | Public exports |

## Snapshot Format (v2.0)

```typescript
interface PersonalitySnapshot {
  meta: {
    version: '2.0';
    exportedAt: string;      // ISO timestamp
    sourceHost: string;      // Worker URL
    checksum: string;        // SHA-256 of content
  };
  state: Record<string, string | number>;  // Key-value settings
  memories: {
    history: HistoryExportEntry[];
    coldStorage: ColdStorageExportEntry[];
    notebook: NotebookExportEntry[];
    observations: ObservationExportEntry[];
    summaries: SummaryExportEntry[];
    reminders: ReminderExportEntry[];
  };
  media: {
    imageRefs: ImageRef[];   // References to images (not data)
  };
  branches: {
    branches: BranchExportEntry[];
    overrides: OverrideExportEntry[];
    syntheticMemories: SyntheticExportEntry[];
  };
  systemPrompt: {
    customInstructions: string | null;
  };
}
```

## Platform Integration

The platform (`routes/personality.js`) imports these utilities and handles:
- HTTP request/response
- Database reads for export
- Database writes for import
- Image data handling (separate gallery export)

This package contains only **pure functions** - no HTTP, no D1, no Cloudflare bindings.
