/**
 * Media View
 *
 * @module views/MediaView
 * @description Timeline layout grouped by day for media items.
 * - Recent row at top (horizontal, last N items).
 * - Filter chips: All | Art | Photos | Voice | GIFs.
 * - Thumbnails for images, play button for voice/GIF.
 *
 * @antipattern Do NOT fetch data here — store slices handle fetching.
 * @antipattern Do NOT define domain types locally.
 * @antipattern Do NOT use raw hex colors.
 *
 * @upstream Called by: AppShell (when activeView === 'media')
 * @downstream Calls: store (galleryImages, openLightbox)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LoadingSkeleton } from '../components/ui';
import { useAppStore, resolveMediaUrl } from '../store';

/** Filter chip options. */
type MediaFilter = 'all' | 'art' | 'photos' | 'voice' | 'gifs';

const FILTER_CHIPS: { key: MediaFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'art', label: 'Art' },
  { key: 'photos', label: 'Photos' },
  { key: 'voice', label: 'Voice' },
  { key: 'gifs', label: 'GIFs' },
];

/** Group entries by day. */
function groupByDay(items: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Unknown';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(item);
  }
  return groups;
}

/** Filter items by type chip. */
function filterItems(items: any[], filter: MediaFilter): any[] {
  if (filter === 'all') return items;
  return items.filter((item) => {
    const type = (item.type || '').toLowerCase();
    switch (filter) {
      case 'art': return type.includes('art') || type.includes('imagine');
      case 'photos': return type.includes('photo') || type.includes('user_art');
      case 'voice': return type.includes('voice') || type.includes('audio');
      case 'gifs': return type.includes('gif');
      default: return true;
    }
  });
}

export function MediaView() {
  const [filter, setFilter] = useState<MediaFilter>('all');

  const galleryImages = useAppStore((s) => s.galleryImages) as any[];
  const isLoading = useAppStore((s) => s.isLoading) as boolean;
  const openLightbox = useAppStore((s) => s.openLightbox) as (images: any[], index?: number) => void;
  const error = useAppStore((s) => s.error) as string | null;
  const clearError = useAppStore((s) => s.clearError) as (() => void) | undefined;
  const fetchTabData = useAppStore((s) => s.fetchTabData) as (tab: string) => Promise<void>;

  useEffect(() => { fetchTabData('media'); }, [fetchTabData]);

  const filtered = useMemo(() => filterItems(galleryImages, filter), [galleryImages, filter]);
  const recentItems = useMemo(() => filtered.slice(0, 8), [filtered]);
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const lightboxImages = useMemo(
    () =>
      filtered.map((item) => ({
        ...item,
        src: resolveMediaUrl(item.content || item.internal) || '',
        prompt: typeof item.internal === 'string' && item.internal.length > 0 ? item.internal : undefined,
      })),
    [filtered],
  );

  const handleThumbnailClick = useCallback((_item: any, index: number) => {
    openLightbox(lightboxImages, index);
  }, [openLightbox, lightboxImages]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      {/* Filter chips */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-md)',
              borderRadius: '16px',
              border: filter === chip.key ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: filter === chip.key ? 'var(--accent-soft)' : 'transparent',
              color: filter === chip.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              whiteSpace: 'nowrap',
              minHeight: '44px',
              transition: 'all var(--duration-normal) ease-out',
            }}
            aria-pressed={filter === chip.key}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--danger)',
          color: 'var(--danger)',
          fontSize: '0.8125rem',
          flexShrink: 0,
        }}>
          <span>{error}</span>
          {clearError && (
            <button
              onClick={clearError}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 'var(--spacing-xs)',
                minHeight: '44px', minWidth: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md)' }}>
        {/* Loading state */}
        {isLoading && galleryImages.length === 0 && (
          <LoadingSkeleton
            variant="rows"
            count={8}
            rowHeight={100}
            trimLastRow={false}
            containerClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
            itemClassName="aspect-square"
          />
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-xl)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
              No media yet
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Art, photos, voice recordings, and GIFs will appear here.
            </div>
          </div>
        )}

        {/* Recent row */}
        {recentItems.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--spacing-sm)',
            }}>
              Recent
            </div>
            <div style={{
              display: 'flex',
              gap: 'var(--spacing-sm)',
              overflowX: 'auto',
              paddingBottom: 'var(--spacing-sm)',
            }}>
              {recentItems.map((item, idx) => (
                <MediaThumbnail
                  key={item.id ?? idx}
                  item={item}
                  onClick={() => handleThumbnailClick(item, idx)}
                  size={80}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timeline grouped by day */}
        {Array.from(grouped.entries()).map(([day, items]) => (
          <div key={day} style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: 'var(--spacing-sm)',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {day}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 'var(--spacing-sm)',
            }}>
              {items.map((item, idx) => (
                <MediaThumbnail
                  key={item.id ?? idx}
                  item={item}
                  onClick={() => {
                    const globalIdx = filtered.indexOf(item);
                    handleThumbnailClick(item, globalIdx >= 0 ? globalIdx : 0);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Determine if item is a voice/audio type. */
function isVoiceItem(item: any): boolean {
  const type = (item.type || '').toLowerCase();
  return type.includes('voice') || type.includes('audio');
}

/** Determine if item is a GIF type. */
function isGifItem(item: any): boolean {
  const type = (item.type || '').toLowerCase();
  return type.includes('gif');
}

/** Format duration in seconds to mm:ss display. */
function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Media thumbnail component.
 * - Images/Art: actual <img> thumbnail with lazy loading
 * - Voice: play button overlay + duration text
 * - GIFs: animated thumbnail
 * - Broken images: graceful fallback to type label
 */
function MediaThumbnail({
  item, onClick, size,
}: {
  item: any; onClick: () => void; size?: number;
}) {
  const src = resolveMediaUrl(item.content || item.internal);
  const dim = size || 100;
  const [imgError, setImgError] = useState(false);
  const isVoice = isVoiceItem(item);
  const isGif = isGifItem(item);

  return (
    <button
      onClick={onClick}
      style={{
        width: size ? `${dim}px` : '100%',
        minWidth: size ? `${dim}px` : undefined,
        aspectRatio: '1',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface)',
        cursor: 'pointer',
        padding: 0,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Voice items: play button + duration */}
      {isVoice && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          gap: 'var(--spacing-xs)',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: 'var(--text-primary)',
          }}>
            ▶
          </div>
          <span style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {formatDuration(item.duration)}
          </span>
        </div>
      )}

      {/* Image / GIF / Art thumbnails */}
      {!isVoice && src && !imgError && (
        <img
          src={src}
          alt={item.alt || ''}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: item.blurred ? 'blur(12px)' : 'none',
          }}
        />
      )}

      {/* Fallback for missing/broken images (non-voice) */}
      {!isVoice && (!src || imgError) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
        }}>
          {item.type || '?'}
        </div>
      )}

      {/* GIF badge — distinct from other type badges */}
      {isGif && !imgError && src && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          fontSize: '0.5625rem',
          fontWeight: 700,
          backgroundColor: 'var(--accent)',
          color: 'var(--text-primary)',
          padding: '1px 5px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          GIF
        </div>
      )}

      {/* Type badge */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
        right: '4px',
        fontSize: '0.625rem',
        backgroundColor: 'var(--scrim-heavy)',
        color: 'var(--text-primary)',
        padding: '1px 4px',
        borderRadius: '4px',
      }}>
        {item.type || ''}
      </div>
    </button>
  );
}

export default MediaView;
