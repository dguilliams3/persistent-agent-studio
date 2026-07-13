/**
 * Entry Content — text, images, and media rendering for history entries
 *
 * @module ui/EntryContent
 * @description Renders the main content of a history entry: text, art previews,
 * Dan's images/videos, internal reasoning, and parse error expandables.
 *
 * @upstream Called by: ui/HistoryEntryRow
 * @downstream Calls: ui/BlurReveal, store/resolveMediaUrl
 * @pattern Decomposed sub-component — extracted from HistoryEntryRow (Wave 2C)
 * Tested by: `apps/web/components/ui/__tests__/HistoryEntryRow.test.tsx`
 */

import { useState } from 'react';
import { resolveMediaUrl } from '../../store';
import { Icon } from './Icon';
import { BlurReveal } from './BlurReveal';

interface EntryContentProps {
  entry: Record<string, any>;
  isArtResult: boolean;
  isDanArt: boolean;
  isDanImage: boolean;
  isDanVideo: boolean;
  isParseError: boolean;
  showImages?: boolean;
  blurImages?: boolean;
  getAllImages?: () => Array<{ src: string; prompt: string }>;
  openLightbox?: (images: Array<{ src: string; prompt: string }>, index: number) => void;
  editMode?: boolean;
  onEditEntry?: (entryId: number) => void;
}

export function EntryContent({
  entry: h,
  isArtResult,
  isDanArt,
  isDanImage,
  isDanVideo,
  isParseError,
  showImages = false,
  blurImages = false,
  getAllImages,
  openLightbox,
  editMode = false,
  onEditEntry,
}: EntryContentProps) {
  const [rawExpanded, setRawExpanded] = useState(false);

  const handleLightboxOpen = (imgSrc: string) => {
    if (getAllImages && openLightbox) {
      const allImages = getAllImages();
      const index = allImages.findIndex((img) => img.src === imgSrc);
      openLightbox(allImages, index >= 0 ? index : 0);
    }
  };

  return (
    <>
      {/* Inline text content */}
      <span className={h.type === 'exist' ? 'text-content-muted italic' : 'text-content-secondary'}>
        {isArtResult ? (
          <span className="text-content-muted">[generated image]</span>
        ) : isDanImage ? (
          (h.content as string) || '[sent image]'
        ) : isDanVideo ? (
          (h.content as string) || '[sent video]'
        ) : (
          (h.content as string) || (h.internal as string) || '...'
        )}
      </span>

      {/* Internal reasoning subthought */}
      {h.internal &&
        !isArtResult &&
        !isDanImage &&
        !isDanVideo &&
        h.type !== 'exist' && (
          <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-content-muted italic">
            <span>↳ {h.internal as string}</span>
            {editMode && onEditEntry && (
              <button
                type="button"
                aria-label="Rewrite this memory"
                title="Rewrite this memory on the active branch"
                onClick={() => onEditEntry(h.id as number)}
                className="rounded border border-border-subtle px-2 py-0.5 text-[0.6875rem] text-text-secondary transition-colors hover:bg-surface-raised hover:text-accent"
              >
                ✎
              </button>
            )}
          </div>
        )}

      {/* Art preview (Claude's or Dan's) */}
      {isArtResult && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.content as string) || ''}
            alt={isDanArt ? "Dan's art" : "Claude's art"}
            blurImages={blurImages}
            onClick={() => handleLightboxOpen(resolveMediaUrl(h.content as string) || '')}
            className={`max-w-xs rounded border border-border-subtle ${
              isDanArt ? 'hover:border-success' : 'hover:border-accent'
            }`}
          />
          {h.internal && (
            <div className="text-content-muted text-xs mt-1">
              Prompt:{' '}
              {isDanArt
                ? (h.internal as string).replace("Dan's prompt: ", '')
                : (h.internal as string).replace('Generated: ', '')}
            </div>
          )}
        </div>
      )}

      {/* Dan's image preview */}
      {isDanImage && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.internal as string) || ''}
            alt="Dan's image"
            blurImages={blurImages}
            onClick={() => handleLightboxOpen(resolveMediaUrl(h.internal as string) || '')}
            className="max-w-xs rounded border border-border-subtle hover:border-success"
          />
        </div>
      )}

      {/* Dan's video GIF preview */}
      {isDanVideo && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.internal as string) || ''}
            alt="Dan's video"
            blurImages={blurImages}
            onClick={() => handleLightboxOpen(resolveMediaUrl(h.internal as string) || '')}
            className="max-w-xs rounded border border-border-subtle hover:border-rose-400"
          />
        </div>
      )}

      {/* Parse error expandable raw response */}
      {isParseError && h.internal && (
        <div className="mt-2 ml-6">
          <button
            onClick={() => setRawExpanded(!rawExpanded)}
            className="text-xs text-danger hover:text-danger/80 flex items-center gap-1"
          >
            <Icon name={rawExpanded ? 'ChevronDown' : 'ChevronRight'} size={12} />
            {rawExpanded ? 'Hide' : 'Show'} Raw Response
          </button>
          {rawExpanded && (
            <pre className="mt-2 p-3 bg-depth border border-danger/30 rounded text-xs text-content-secondary overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
              {(h.internal as string).replace('Raw response:\n', '')}
            </pre>
          )}
        </div>
      )}
    </>
  );
}

export default EntryContent;
