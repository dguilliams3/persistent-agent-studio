/**
 * Blur-to-reveal image component
 *
 * @module ui/BlurReveal
 * @description Image with optional blur effect and click-to-reveal.
 * First click reveals the image, second click triggers the provided action (e.g., open lightbox).
 *
 * @upstream Called by:
 *   - ui/HistoryEntryRow (art previews, the user's images/videos)
 *   - tabs/ChatTab/ChatBubble (message image attachments)
 * @downstream Calls:
 *   - ui/Icon
 * @pattern UI Primitive — extracted shared behavior (was duplicated in HistoryEntryRow and ChatBubble)
 */

import { useState } from 'react';
import { Icon } from './Icon';

interface BlurRevealProps {
  src: string;
  alt?: string;
  onClick?: (e: React.MouseEvent) => void;
  blurImages?: boolean;
  className?: string;
}

/**
 * @description Image with optional blur effect and click-to-reveal
 *
 * When blurImages is true, the image is blurred until the user clicks once to reveal.
 * A second click triggers the onClick handler (typically opening a lightbox).
 * When blurImages is false, clicks go directly to onClick.
 *
 * @antipattern Do NOT duplicate this logic — both HistoryEntryRow and ChatBubble
 * previously had their own blur-reveal implementations.
 */
export function BlurReveal({ src, alt, onClick, blurImages, className = '' }: BlurRevealProps) {
  const [revealed, setRevealed] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (blurImages && !revealed) {
      e.stopPropagation();
      setRevealed(true);
    } else {
      onClick?.(e);
    }
  };

  const isBlurred = blurImages && !revealed;

  return (
    <div className="relative inline-block">
      <img
        src={src}
        alt={alt}
        onClick={handleClick}
        className={`${className} ${isBlurred ? 'blur-xl' : ''} transition-all duration-200 cursor-pointer`}
        title={isBlurred ? 'Click to reveal' : 'Click to enlarge'}
      />
      {isBlurred && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 rounded cursor-pointer"
          onClick={handleClick}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-depth/90 rounded-full text-xs text-content-secondary">
            <Icon name="Eye" size={14} />
            <span>Click to reveal</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlurReveal;
