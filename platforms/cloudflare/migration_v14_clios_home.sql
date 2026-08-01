-- Migration v14: Clio's Home - Image Wall & View Images
-- Date: 2026-01-13
-- Description: Adds pinned image slots and temporary image viewing

-- Pinned Images: 5 slots for Clio's curated image wall
-- Slots 1-5 are fixed positions, each can hold one image_id
CREATE TABLE IF NOT EXISTS pinned_images (
  slot INTEGER PRIMARY KEY CHECK (slot >= 1 AND slot <= 5),
  image_id INTEGER NOT NULL,
  pinned_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (image_id) REFERENCES history(id) ON DELETE CASCADE
);

-- Pending View Images: Images Clio has requested to see
-- Auto-cleared after one cycle (cycle_id tracks when requested)
CREATE TABLE IF NOT EXISTS pending_view_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  requested_at TEXT DEFAULT (datetime('now')),
  cycle_id INTEGER,
  viewed INTEGER DEFAULT 0,
  FOREIGN KEY (image_id) REFERENCES history(id) ON DELETE CASCADE
);

-- Index for quick lookup of unviewed images
CREATE INDEX IF NOT EXISTS idx_pending_view_unviewed ON pending_view_images(viewed) WHERE viewed = 0;
