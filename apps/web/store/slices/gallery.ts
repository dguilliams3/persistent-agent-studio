/**
 * Gallery Slice
 *
 * @module store/slices/gallery
 * @description Zustand store slice for image generation, gallery management,
 * blur/vault toggles, deletion, and profile picture setting.
 *
 * Manages:
 * - Image generation with fallback providers (Cloudflare → Replicate → SDXL)
 * - Gallery image storage and retrieval
 * - Safety controls (blur toggle for sensitive content, vault for private images)
 * - Image deletion with password protection
 * - Profile picture selection and updates
 * - UI state for generation forms, pagination, and display preferences
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createGallerySlice()
 *   - React components: GalleryTab (generation, save, display), ProfileTab (profile picture)
 * @downstream Calls:
 *   - api/client.js - /imagine, /save-art, /gallery/:id/blur, /gallery/:id/vault, /gallery/:id (DELETE),
 *     /profile-picture
 *   - Other slices via get(): addLog (core), fetchGalleryImages (data), fetchProfilePicture (settings)
 *
 * @tests apps/web/store/slices/__tests__/gallery.test.js
 *   - "generateImage - validation and API call"
 *   - "generateImage - error handling"
 *   - "saveGeneratedImage - successful save flow"
 *   - "toggleImageBlur - state toggle and error recovery"
 *   - "toggleImageVault - state toggle and error recovery"
 *   - "deleteGalleryImage - password validation and deletion"
 *   - "setAsProfilePicture - profile update"
 */

import api from "../../api/client";
import type { StateCreator } from "zustand";
import type { AppState } from "../types";

export interface GallerySlice {
  // State
  imagePrompt: string;
  generatedImage: unknown;
  isGenerating: boolean;
  isSavingToGallery: boolean;
  saveAsClioArt: boolean;
  editedPrompt: string;
  showOriginalPrompts: boolean;
  galleryPage: number;
  galleryPageSize: number;

  // Setters
  setImagePrompt: (prompt: string) => void;
  setGeneratedImage: (image: unknown) => void;
  setIsGenerating: (generating: boolean) => void;
  setIsSavingToGallery: (saving: boolean) => void;
  setSaveAsClioArt: (asClioArt: boolean) => void;
  setEditedPrompt: (prompt: string) => void;
  setShowOriginalPrompts: (show: boolean) => void;
  setGalleryPage: (page: number) => void;
  setGalleryPageSize: (size: number) => void;

  // Actions
  generateImage: (prompt?: string) => Promise<void>;
  saveGeneratedImage: () => Promise<void>;
  toggleImageBlur: (id: number, blur: boolean) => Promise<void>;
  toggleImageVault: (id: number, vault: boolean) => Promise<void>;
  deleteGalleryImage: (id: number, password: string) => Promise<void>;
  setAsProfilePicture: (imageData: string) => Promise<void>;
}

export const createGallerySlice: StateCreator<
  AppState,
  [],
  [],
  GallerySlice
> = (set, get) => ({
  // ===========================================================================
  // STATE
  // ===========================================================================

  /** @type {string} Image generation prompt input */
  imagePrompt: "",

  /** @type {Object|null} Currently generated image data (base64 or image field) */
  generatedImage: null,

  /** @type {boolean} Image generation in progress */
  isGenerating: false,

  /** @type {boolean} Saving generated image to gallery in progress */
  isSavingToGallery: false,

  /** @type {boolean} Save generated image as Clio's art (true) or the user's art (false) */
  saveAsClioArt: true,

  /** @type {string} Edited prompt for regeneration (may differ from imagePrompt) */
  editedPrompt: "",

  /** @type {boolean} Show original prompts in gallery display */
  showOriginalPrompts: false,

  /** @type {number} Current gallery page index (0-based) */
  galleryPage: 0,

  /** @type {number} Number of images per gallery page */
  galleryPageSize: 12,

  // ===========================================================================
  // SETTERS
  // ===========================================================================

  /**
   * @description Set image generation prompt input
   * @upstream Called by: Prompt input field onChange
   * @downstream Calls: setState (Zustand)
   * @param {string} prompt - User's image prompt text
   */
  setImagePrompt: (prompt: string) => set({ imagePrompt: prompt }),

  /**
   * @description Set generated image data
   * @upstream Called by: generateImage action
   * @downstream Calls: setState (Zustand)
   * @param {Object|null} image - Generated image data or null
   */
  setGeneratedImage: (image: unknown) => set({ generatedImage: image }),

  /**
   * @description Set image generation loading state
   * @upstream Called by: generateImage action
   * @downstream Calls: setState (Zustand)
   * @param {boolean} generating - True if generation in progress
   */
  setIsGenerating: (generating: boolean) => set({ isGenerating: generating }),

  /**
   * @description Set save-to-gallery loading state
   * @upstream Called by: saveGeneratedImage action
   * @downstream Calls: setState (Zustand)
   * @param {boolean} saving - True if save in progress
   */
  setIsSavingToGallery: (saving: boolean) => set({ isSavingToGallery: saving }),

  /**
   * @description Set save-type toggle (Clio art vs user art)
   * @upstream Called by: Toggle button in generation UI
   * @downstream Calls: setState (Zustand)
   * @param {boolean} asClioArt - True to save as Clio's art, false for the user's art
   */
  setSaveAsClioArt: (asClioArt: boolean) => set({ saveAsClioArt: asClioArt }),

  /**
   * @description Set edited prompt for regeneration
   * @upstream Called by: generateImage action, prompt edit input
   * @downstream Calls: setState (Zustand)
   * @param {string} prompt - Edited prompt text
   */
  setEditedPrompt: (prompt: string) => set({ editedPrompt: prompt }),

  /**
   * @description Toggle original prompt visibility in gallery
   * @upstream Called by: Display preferences toggle
   * @downstream Calls: setState (Zustand)
   * @param {boolean} show - True to show original prompts
   */
  setShowOriginalPrompts: (show: boolean) => set({ showOriginalPrompts: show }),

  /**
   * @description Set current gallery page (pagination)
   * @upstream Called by: Pagination controls
   * @downstream Calls: setState (Zustand)
   * @param {number} page - Page index (0-based)
   */
  setGalleryPage: (page: number) => set({ galleryPage: page }),

  /**
   * @description Set items per gallery page
   * @upstream Called by: Page size selector
   * @downstream Calls: setState (Zustand)
   * @param {number} size - Items per page
   */
  setGalleryPageSize: (size: number) => set({ galleryPageSize: size }),

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * @description Generate image from text prompt via multiple fallback providers
   *
   * Providers (in order of preference):
   * 1. Cloudflare AI (default, free, content-filtered)
   * 2. Replicate FLUX (if Cloudflare fails, ~$0.01)
   * 3. SDXL (if Replicate fails, ~$0.01, safety off)
   *
   * Validation:
   * - Requires non-empty prompt (whitespace-only rejected with log)
   * - Uses provided prompt OR falls back to imagePrompt state
   *
   * State transition:
   * - Sets isGenerating = true
   * - Logs progress message
   * - Updates generatedImage with response data
   * - Updates editedPrompt to match generated prompt
   * - Sets isGenerating = false in finally block
   *
   * @upstream Called by: GalleryTab generate button, prompt input enter key
   * @downstream Calls: api.post('/imagine'), addLog (core), setIsGenerating, setGeneratedImage, setEditedPrompt
   *
   * @param {string} [prompt] - Optional prompt to override imagePrompt state
   *
   * @returns {Promise<void>} No return value; state updated via store
   *
   * @example
   * // Use prompt from state (imagePrompt)
   * await store.generateImage();
   * // Use specific prompt
   * await store.generateImage('a sunset over mountains');
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "generateImage - validation and API call" - prompt validation, API success
   *   - "generateImage - error handling" - API error logging
   *
   * @note Prompt is limited to first 50 chars in log message (truncation for readability)
   * @note Error handling does NOT throw; failures logged only
   * @antipattern
   * // WRONG: Assuming success without checking generatedImage
   * generateImage('a cat'); // Image may fail silently
   * // CORRECT: Check state or listen to logs
   * await generateImage('a cat'); // Logs indicate success/failure
   */
  generateImage: async (prompt?: string) => {
    const {
      addLog,
      imagePrompt,
      setIsGenerating,
      setGeneratedImage,
      setEditedPrompt,
    } = get();
    const actualPrompt = prompt || imagePrompt;
    if (!actualPrompt.trim()) {
      addLog("❌ Please enter a prompt");
      return;
    }
    setIsGenerating(true);
    addLog(`🎨 Generating image: ${actualPrompt.slice(0, 50)}...`);
    try {
      const data = await api.post("/imagine", { prompt: actualPrompt });
      setGeneratedImage(data);
      setEditedPrompt(actualPrompt);
      addLog("✅ Image generated");
    } catch (err: unknown) {
      addLog(
        `❌ Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsGenerating(false);
    }
  },

  /**
   * @description Save currently generated image to gallery
   *
   * Persists the generatedImage to database history as either:
   * - 'art_result' (Clio's creative output, saveAsClioArt = true)
   * - 'user_art' (the user's UI-generated art, saveAsClioArt = false)
   *
   * Validation:
   * - Requires generatedImage to be non-null, otherwise logs error and returns
   *
   * Image extraction:
   * - Tries generatedImage.base64 first (Replicate/SDXL format)
   * - Falls back to generatedImage.image (Cloudflare format)
   * - Falls back to entire generatedImage object if neither key exists
   *
   * State transition:
   * - Sets isSavingToGallery = true
   * - Makes API call with image data + editedPrompt + type
   * - Clears generatedImage and imagePrompt on success
   * - Refreshes gallery images
   * - Sets isSavingToGallery = false in finally block
   *
   * @upstream Called by: Save button in GalleryTab
   * @downstream Calls: api.post('/save-art'), addLog (core), setIsSavingToGallery, setGeneratedImage,
   *   setImagePrompt, fetchGalleryImages (data)
   *
   * @returns {Promise<void>} No return value; state updated via store
   *
   * @example
   * await store.generateImage('a mountain landscape');
   * await store.saveGeneratedImage();
   * // Image saved, generatedImage cleared, gallery refreshed
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "saveGeneratedImage - successful save flow" - validation, API call, state reset
   *
   * @note Error handling does NOT throw; failures logged only
   * @note Form is cleared after successful save (generatedImage + imagePrompt reset)
   */
  saveGeneratedImage: async () => {
    const {
      addLog,
      generatedImage,
      editedPrompt,
      saveAsClioArt,
      setIsSavingToGallery,
      setGeneratedImage,
      setImagePrompt,
      fetchGalleryImages,
    } = get();
    if (!generatedImage) {
      addLog("❌ No image to save");
      return;
    }
    setIsSavingToGallery(true);
    addLog("💾 Saving to gallery...");
    try {
      const imageData =
        (generatedImage as any).base64 ||
        (generatedImage as any).image ||
        generatedImage;
      await api.post("/save-art", {
        image: imageData,
        prompt: editedPrompt,
        type: saveAsClioArt ? "art_result" : "user_art",
      });
      addLog("✅ Saved to gallery");
      setGeneratedImage(null);
      setImagePrompt("");
      await fetchGalleryImages();
    } catch (err: unknown) {
      addLog(
        `❌ Save failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSavingToGallery(false);
    }
  },

  /**
   * @description Toggle blur safety toggle on gallery image
   *
   * Blurred images are marked as sensitive content and displayed with visual
   * blur filter in the gallery. User can toggle blur on/off per image.
   *
   * Error recovery:
   * - On API failure, refetches gallery to restore UI state to database state
   * - Logs error and re-throws for caller to handle
   *
   * @upstream Called by: Image context menu blur toggle button
   * @downstream Calls: api.post('/gallery/:id/blur'), addLog (core), fetchGalleryImages (data)
   *
   * @param {number} id - Gallery image ID
   * @param {boolean} blur - True to blur, false to unblur
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.toggleImageBlur(42, true);
   * // Logs: "🔒 Image blurred"
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "toggleImageBlur - state toggle and error recovery" - API call, error rollback
   *
   * @note Throws error to caller; caller should handle or ignore
   * @note Gallery is refreshed on error to ensure UI state matches database
   * @antipattern
   * // WRONG: Fire and forget without error handling
   * toggleImageBlur(id, true); // Errors silent, UI may be out of sync
   * // CORRECT: Await or handle rejection
   * await toggleImageBlur(id, true).catch(err => console.error(err));
   */
  toggleImageBlur: async (id: number, blur: boolean) => {
    const { addLog, fetchGalleryImages } = get();
    try {
      await api.post(`/gallery/${id}/blur`, { blurred: blur });
      addLog(`${blur ? "🔒" : "🔓"} Image ${blur ? "blurred" : "unblurred"}`);
      await fetchGalleryImages();
    } catch (err: unknown) {
      console.error("Blur toggle error:", err);
      addLog(
        `❌ Blur toggle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      await fetchGalleryImages();
      throw err;
    }
  },

  /**
   * @description Toggle vault status on gallery image (private storage)
   *
   * Vaulted images are marked as private and hidden from normal gallery view.
   * User can toggle vault on/off per image for selective privacy.
   *
   * Error recovery:
   * - On API failure, refetches gallery to restore UI state to database state
   * - Logs error and re-throws for caller to handle
   *
   * @upstream Called by: Image context menu vault toggle button
   * @downstream Calls: api.post('/gallery/:id/vault'), addLog (core), fetchGalleryImages (data)
   *
   * @param {number} id - Gallery image ID
   * @param {boolean} vault - True to vault (hide), false to unvault (show)
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.toggleImageVault(42, true);
   * // Logs: "🔐 Image added to vault"
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "toggleImageVault - state toggle and error recovery" - API call, error rollback
   *
   * @note Throws error to caller; caller should handle or ignore
   * @note Gallery is refreshed on error to ensure UI state matches database
   * @note Vaulted images remain in database but are filtered from normal view
   */
  toggleImageVault: async (id: number, vault: boolean) => {
    const { addLog, fetchGalleryImages } = get();
    try {
      await api.post(`/gallery/${id}/vault`, { vaulted: vault });
      addLog(
        `${vault ? "🔐" : "🔓"} Image ${vault ? "added to" : "removed from"} vault`,
      );
      await fetchGalleryImages();
    } catch (err: unknown) {
      console.error("Vault toggle error:", err);
      addLog(
        `❌ Vault toggle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      await fetchGalleryImages();
      throw err;
    }
  },

  /**
   * @description Delete gallery image (destructive, requires password)
   *
   * Permanently removes image from database. Requires admin password to prevent
   * accidental deletion.
   *
   * Validation:
   * - Requires password to be provided, otherwise logs error and returns
   *
   * State transition:
   * - Makes API DELETE call with password
   * - Refreshes gallery on success or error (to sync UI with DB)
   *
   * @upstream Called by: Image context menu delete button
   * @downstream Calls: api.delete('/gallery/:id'), addLog (core), fetchGalleryImages (data)
   *
   * @param {number} id - Gallery image ID to delete
   * @param {string} password - Admin password for authorization
   *
   * @returns {Promise<void>} No return value; state updated via store
   *
   * @example
   * await store.deleteGalleryImage(42, 'admin-password');
   * // Logs: "🗑️ Image deleted" on success
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "deleteGalleryImage - password validation and deletion" - password check, API call
   *
   * @note Error handling does NOT throw; failures logged only
   * @note Password validation is client-side; server validates again
   * @note Gallery is refreshed regardless of success/failure to sync state
   */
  deleteGalleryImage: async (id: number, password: string) => {
    const { addLog, fetchGalleryImages } = get();
    if (!password) {
      addLog("❌ Password required for delete");
      return;
    }
    try {
      await api.delete(`/gallery/${id}`, { password });
      addLog("🗑️ Image deleted");
      await fetchGalleryImages();
    } catch (err: unknown) {
      addLog(
        `❌ Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Set image as Clio's profile picture
   *
   * Updates the profile picture displayed in the UI and on worker endpoints
   * (e.g., Telegram, API responses).
   *
   * State transition:
   * - Makes API call with image data
   * - Refreshes profile picture from database on success
   *
   * @upstream Called by: Image context menu "Set as Profile Pic" button, ProfileTab
   * @downstream Calls: api.post('/profile-picture'), addLog (core), fetchProfilePicture (settings)
   *
   * @param {string} imageData - Image data (base64 or URL)
   *
   * @returns {Promise<void>} No return value; state updated via store
   *
   * @example
   * const imageBase64 = 'data:image/png;base64,...';
   * await store.setAsProfilePicture(imageBase64);
   * // Logs: "✅ Profile picture updated"
   *
   * @tests apps/web/store/slices/__tests__/gallery.test.js
   *   - "setAsProfilePicture - profile update" - API call, refresh
   *
   * @note Error handling does NOT throw; failures logged only
   * @note Image is persisted to database and reflected on worker-generated assets
   */
  setAsProfilePicture: async (imageData: string) => {
    const { addLog, fetchProfilePicture } = get();
    addLog("🖼️ Setting profile picture...");
    try {
      await api.post("/profile-picture", { picture: imageData });
      addLog("✅ Profile picture updated");
      await fetchProfilePicture();
    } catch (err: unknown) {
      addLog(
        `❌ Profile pic update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
});
