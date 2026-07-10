/**
 * Lightbox Modal — full-screen image viewer
 *
 * @module components/layout/Lightbox
 * @description Full-screen overlay for viewing images with navigation,
 * blur/vault/delete controls, and keyboard shortcuts.
 * Reads all state from Zustand store.
 *
 * @upstream Called by: ClaudeExistenceLoop (rendered at root level for z-index)
 * @downstream Calls: store lightbox actions, Icon
 * @pattern Layout component — full-screen overlay, keyboard navigation (arrows, Escape)
 */

import { useEffect, useCallback } from "react";
import { useAppStore } from "../../store";
import { Icon } from "../ui";

interface LightboxProps {
  formatTime: (_dateStr: string) => string;
  toggleImageBlur: (_imageId: number) => Promise<void>;
  toggleImageVault: (_imageId: number) => Promise<void>;
  // delete now receives the un-narrowed store action; caller must supply password
  deleteGalleryImage: (_imageId: number, _password: string) => Promise<void>;
}

export function Lightbox({
  formatTime,
  toggleImageBlur,
  toggleImageVault,
  deleteGalleryImage,
}: LightboxProps) {
  const lightbox = useAppStore((s) => s.lightbox);
  const closeLightbox = useAppStore((s) => s.closeLightbox);
  const navigateLightbox = useAppStore((s) => s.navigateLightbox);

  const lightboxPrev = useCallback(
    () => navigateLightbox(-1),
    [navigateLightbox],
  );
  const lightboxNext = useCallback(
    () => navigateLightbox(1),
    [navigateLightbox],
  );

  // Keyboard handler
  useEffect(() => {
    if (!lightbox.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox.isOpen, closeLightbox, lightboxPrev, lightboxNext]);

  if (!lightbox.isOpen || lightbox.images.length === 0) return null;

  const current = lightbox.images[lightbox.currentIndex];

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={closeLightbox}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl font-light z-10 w-12 h-12 flex items-center justify-center"
        onClick={closeLightbox}
        aria-label="Close lightbox"
      >
        <Icon name="X" size={32} />
      </button>

      {/* Image counter */}
      <div className="absolute top-4 left-4 text-white/70 text-sm">
        {lightbox.currentIndex + 1} / {lightbox.images.length}
      </div>

      {/* Previous button */}
      {lightbox.images.length > 1 && (
        <button
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 sm:p-4 w-12 h-16 flex items-center justify-center bg-black/30 rounded-lg"
          onClick={(e) => {
            e.stopPropagation();
            lightboxPrev();
          }}
        >
          <Icon name="ChevronLeft" size={32} />
        </button>
      )}

      {/* Main image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current?.src}
          alt={current?.prompt || "Image"}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="mt-4 text-center max-w-2xl">
          <div className="text-white text-sm">{current?.prompt}</div>
          <div className="text-white/50 text-xs mt-1">
            {current?.time && formatTime(current.time)}
            {current?.type === "user" && " • From you"}
            {current?.type === "art" && " • Generated"}
          </div>

          {/* Management buttons — only for gallery images with ID */}
          {current?.id && (
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImageBlur(current.id!);
                }}
                className="px-4 py-3 sm:py-2 min-h-[44px] bg-gray-700/80 hover:bg-gray-600 rounded-lg text-white text-sm flex items-center gap-2"
                title={current?.blurred ? "Unblur image" : "Blur image"}
              >
                {current?.blurred ? "🔓 Unblur" : "🔒 Blur"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImageVault(current.id!);
                  closeLightbox();
                }}
                className="px-4 py-3 sm:py-2 min-h-[44px] bg-amber-700/80 hover:bg-amber-600 rounded-lg text-white text-sm flex items-center gap-2"
                title="Move to vault"
              >
                🔐 Vault
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Obtain admin password using established codebase pattern (see data.ts deleteLearning)
                  // then pass through the un-narrowed signature. Only call if password provided.
                  const password = prompt("Enter admin password to delete image:");
                  if (password) {
                    deleteGalleryImage(current.id!, password);
                    closeLightbox();
                  }
                }}
                className="px-4 py-3 sm:py-2 min-h-[44px] bg-red-700/80 hover:bg-red-600 rounded-lg text-white text-sm flex items-center gap-2"
                title="Delete image"
              >
                🗑️ Delete
              </button>
            </div>
          )}

          <div className="text-white/40 text-xs mt-3">
            ← → to navigate • ESC to close • Right-click to save
          </div>
        </div>
      </div>

      {/* Next button */}
      {lightbox.images.length > 1 && (
        <button
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 sm:p-4 w-12 h-16 flex items-center justify-center bg-black/30 rounded-lg"
          onClick={(e) => {
            e.stopPropagation();
            lightboxNext();
          }}
        >
          <Icon name="ChevronRight" size={32} />
        </button>
      )}
    </div>
  );
}

export default Lightbox;
