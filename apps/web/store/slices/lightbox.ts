/**
 * Lightbox State Slice
 *
 * @module store/slices/lightbox
 * @description Lightbox open/close/navigate state for the image gallery.
 *
 * Split from ui.ts to keep each slice under the 100-line limit.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: none (pure state)
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";

/** Shape of an image item displayed in the lightbox. */
export interface LightboxImage {
  src: string;
  prompt?: string;
  time?: string;
  type?: string;
  id?: number;
  blurred?: boolean;
  [key: string]: unknown;
}

export interface LightboxState {
  isOpen: boolean;
  images: LightboxImage[];
  currentIndex: number;
}

export interface LightboxSlice {
  lightbox: LightboxState;
  setLightbox: (lightbox: LightboxState) => void;
  openLightbox: (images: LightboxImage[], index?: number) => void;
  closeLightbox: () => void;
  navigateLightbox: (delta: number) => void;
}

export const createLightboxSlice: StateCreator<
  AppState,
  [],
  [],
  LightboxSlice
> = (set) => ({
  lightbox: { isOpen: false, images: [], currentIndex: 0 },

  setLightbox: (lightbox: LightboxState) => set({ lightbox }),

  openLightbox: (images: LightboxImage[], index: number = 0) =>
    set({ lightbox: { isOpen: true, images, currentIndex: index } }),

  closeLightbox: () =>
    set({ lightbox: { isOpen: false, images: [], currentIndex: 0 } }),

  navigateLightbox: (delta: number) =>
    set((s) => {
      const lb = s.lightbox;
      const newIndex =
        (lb.currentIndex + delta + lb.images.length) % lb.images.length;
      return { lightbox: { ...lb, currentIndex: newIndex } };
    }),
});
