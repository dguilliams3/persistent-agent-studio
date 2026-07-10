/**
 * Entry Content — text, images, and media rendering for history entries
 *
 * @module ui/EntryContent
 * @description Renders the main content of a history entry: text, art previews,
 * the user's images/videos, internal reasoning, and parse error expandables.
 *
 * @upstream Called by: ui/HistoryEntryRow
 * @downstream Calls: ui/BlurReveal, store/resolveMediaUrl
 * @pattern Decomposed sub-component — extracted from HistoryEntryRow (Wave 2C)
 */

import { useState } from 'react';
import { resolveMediaUrl } from '../../store';
import { Icon } from './Icon';
import { BlurReveal } from './BlurReveal';

interface EntryContentProps {
  entry: Record<string, any>;
  isArtResult: boolean;
  isUserArt: boolean;
  isUserImage: boolean;
  isUserVideo: boolean;
  isParseError: boolean;
  showImages?: boolean;
  blurImages?: boolean;
  getAllImages?: () => Array<{ src: string; prompt: string }>;
  openLightbox?: (images: Array<{ src: string; prompt: string }>, index: number) => void;
}

export function EntryContent({
  entry: h,
  isArtResult,
  isUserArt,
  isUserImage,
  isUserVideo,
  isParseError,
  showImages = false,
  blurImages = false,
  getAllImages,
  openLightbox,
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
        ) : isUserImage ? (
          (h.content as string) || '[sent image]'
        ) : isUserVideo ? (
          (h.content as string) || '[sent video]'
        ) : (
          (h.content as string) || (h.internal as string) || '...'
        )}
      </span>

      {/* Internal reasoning subthought */}
      {h.internal &&
        !isArtResult &&
        !isUserImage &&
        !isUserVideo &&
        h.type !== 'exist' &&
        h.content && (
          <div className="ml-6 mt-1 text-xs text-content-muted italic">
            ↳ {h.internal as string}
          </div>
        )}

      {/* Art preview (Claude's or the user's) */}
      {isArtResult && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.content as string) || ''}
            alt={isUserArt ? "User's art" : "Claude's art"}
            blurImages={blurImages}
            onClick={() => handleLightboxOpen(resolveMediaUrl(h.content as string) || '')}
            className={`max-w-xs rounded border border-border-subtle ${
              isUserArt ? 'hover:border-success' : 'hover:border-accent'
            }`}
          />
          {h.internal && (
            <div className="text-content-muted text-xs mt-1">
              Prompt:{' '}
              {isUserArt
                ? (h.internal as string).replace("User's prompt: ", '')
                : (h.internal as string).replace('Generated: ', '')}
            </div>
          )}
        </div>
      )}

      {/* The user's image preview */}
      {isUserImage && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.internal as string) || ''}
            alt="User's image"
            blurImages={blurImages}
            onClick={() => handleLightboxOpen(resolveMediaUrl(h.internal as string) || '')}
            className="max-w-xs rounded border border-border-subtle hover:border-success"
          />
        </div>
      )}

      {/* The user's video GIF preview */}
      {isUserVideo && showImages && getAllImages && openLightbox && (
        <div className="mt-2 ml-6">
          <BlurReveal
            src={resolveMediaUrl(h.internal as string) || ''}
            alt="User's video"
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
