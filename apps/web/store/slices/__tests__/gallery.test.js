/**
 * Unit tests for gallery slice
 *
 * @module tests/store/slices/gallery
 * @description Tests for createGallerySlice - image generation, gallery management,
 * blur/vault toggles, deletion, and profile picture setting.
 *
 * @covers apps/web/store/slices/gallery.js
 *   - generateImage() - prompt validation, fallback, API success/error
 *   - saveGeneratedImage() - validation, base64/image format handling, form reset
 *   - toggleImageBlur() - blur/unblur, error recovery with refetch
 *   - toggleImageVault() - vault/unvault, error recovery with refetch
 *   - deleteGalleryImage() - password validation, success/error
 *   - setAsProfilePicture() - profile update with success/error
 *
 * When gallery.js changes, validate:
 * - Image generation with multiple provider fallbacks
 * - Proper state cleanup after save operations
 * - Error recovery refetches gallery on toggle failures
 * - Password requirement for destructive operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createGallerySlice } from '../gallery';

// Mock API client
vi.mock('../../../api/client', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../../api/client';

// Create a test store with gallery slice and mock dependencies
const createTestStore = () => create((set, get) => ({
  ...createGallerySlice(set, get),
  // Mock cross-slice dependencies
  addLog: vi.fn(),
  fetchGalleryImages: vi.fn(),
  fetchProfilePicture: vi.fn(),
}));

describe('Gallery Slice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  // =========================================================================
  // IMAGE GENERATION
  // =========================================================================

  describe('generateImage', () => {
    it('rejects empty prompt with log', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: '' });

      await generateImage();

      expect(addLog).toHaveBeenCalledWith('❌ Please enter a prompt');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('uses provided prompt over state imagePrompt', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: 'fallback prompt' });

      api.post.mockResolvedValue({ image: 'generated-data' });

      await generateImage('explicit prompt');

      expect(api.post).toHaveBeenCalledWith('/imagine', { prompt: 'explicit prompt' });
      expect(addLog).toHaveBeenCalledWith('🎨 Generating image: explicit prompt...');
    });

    it('falls back to imagePrompt state if no parameter', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: 'state prompt' });

      api.post.mockResolvedValue({ image: 'generated-data' });

      await generateImage();

      expect(api.post).toHaveBeenCalledWith('/imagine', { prompt: 'state prompt' });
    });

    it('sets loading state during generation', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: 'test prompt' });

      let resolvePromise;
      api.post.mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const generatePromise = generateImage();

      // Check loading state is true during generation
      expect(getState().isGenerating).toBe(true);

      resolvePromise({ image: 'data' });
      await generatePromise;

      // Check loading state is false after completion
      expect(getState().isGenerating).toBe(false);
    });

    it('updates state on success', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: 'sunset' });

      const responseData = { image: 'base64-data', metadata: 'info' };
      api.post.mockResolvedValue(responseData);

      await generateImage();

      expect(getState().generatedImage).toEqual(responseData);
      expect(getState().editedPrompt).toBe('sunset');
      expect(addLog).toHaveBeenCalledWith('✅ Image generated');
    });

    it('handles API errors gracefully', async () => {
      const { getState } = store;
      const { generateImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, imagePrompt: 'fail prompt' });

      api.post.mockRejectedValue(new Error('Network timeout'));

      await generateImage();

      expect(addLog).toHaveBeenCalledWith('❌ Image generation failed: Network timeout');
      expect(getState().isGenerating).toBe(false);
    });
  });

  // =========================================================================
  // SAVE GENERATED IMAGE
  // =========================================================================

  describe('saveGeneratedImage', () => {
    it('rejects when no generatedImage with log', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog, generatedImage: null });

      await saveGeneratedImage();

      expect(addLog).toHaveBeenCalledWith('❌ No image to save');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('extracts base64 from generatedImage.base64', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({
        addLog,
        fetchGalleryImages,
        generatedImage: { base64: 'base64-data', other: 'field' },
        editedPrompt: 'test prompt',
        saveAsClioArt: true,
      });

      api.post.mockResolvedValue({});

      await saveGeneratedImage();

      expect(api.post).toHaveBeenCalledWith('/save-art', {
        image: 'base64-data',
        prompt: 'test prompt',
        type: 'art_result',
      });
    });

    it('falls back to generatedImage.image if no base64', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({
        addLog,
        fetchGalleryImages,
        generatedImage: { image: 'image-data' },
        editedPrompt: 'prompt',
        saveAsClioArt: false,
      });

      api.post.mockResolvedValue({});

      await saveGeneratedImage();

      expect(api.post).toHaveBeenCalledWith('/save-art', {
        image: 'image-data',
        prompt: 'prompt',
        type: 'user_art',
      });
    });

    it('uses entire generatedImage if neither base64 nor image', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({
        addLog,
        fetchGalleryImages,
        generatedImage: 'raw-image-data',
        editedPrompt: 'prompt',
        saveAsClioArt: true,
      });

      api.post.mockResolvedValue({});

      await saveGeneratedImage();

      expect(api.post).toHaveBeenCalledWith('/save-art', {
        image: 'raw-image-data',
        prompt: 'prompt',
        type: 'art_result',
      });
    });

    it('clears form after successful save', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({
        addLog,
        fetchGalleryImages,
        generatedImage: { base64: 'data' },
        imagePrompt: 'original prompt',
        editedPrompt: 'edited',
        saveAsClioArt: true,
      });

      api.post.mockResolvedValue({});

      await saveGeneratedImage();

      expect(getState().generatedImage).toBeNull();
      expect(getState().imagePrompt).toBe('');
      expect(addLog).toHaveBeenCalledWith('✅ Saved to gallery');
      expect(fetchGalleryImages).toHaveBeenCalled();
    });

    it('handles save errors', async () => {
      const { getState } = store;
      const { saveGeneratedImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({
        addLog,
        fetchGalleryImages,
        generatedImage: { base64: 'data' },
        editedPrompt: 'test',
      });

      api.post.mockRejectedValue(new Error('Storage full'));

      await saveGeneratedImage();

      expect(addLog).toHaveBeenCalledWith('❌ Save failed: Storage full');
      expect(getState().isSavingToGallery).toBe(false);
    });
  });

  // =========================================================================
  // BLUR TOGGLE
  // =========================================================================

  describe('toggleImageBlur', () => {
    it('calls API with blur state', async () => {
      const { getState } = store;
      const { toggleImageBlur } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.post.mockResolvedValue({});

      await toggleImageBlur(42, true);

      expect(api.post).toHaveBeenCalledWith('/gallery/42/blur', { blurred: true });
      expect(addLog).toHaveBeenCalledWith('🔒 Image blurred');
      expect(fetchGalleryImages).toHaveBeenCalled();
    });

    it('logs unblur message', async () => {
      const { getState } = store;
      const { toggleImageBlur } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.post.mockResolvedValue({});

      await toggleImageBlur(42, false);

      expect(addLog).toHaveBeenCalledWith('🔓 Image unblurred');
    });

    it('refetches gallery on error and re-throws', async () => {
      const { getState } = store;
      const { toggleImageBlur } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      const error = new Error('API error');
      api.post.mockRejectedValue(error);

      await expect(toggleImageBlur(42, true)).rejects.toThrow('API error');

      expect(addLog).toHaveBeenCalledWith('❌ Blur toggle failed: API error');
      expect(fetchGalleryImages).toHaveBeenCalled(); // Error recovery
    });
  });

  // =========================================================================
  // VAULT TOGGLE
  // =========================================================================

  describe('toggleImageVault', () => {
    it('calls API with vault state', async () => {
      const { getState } = store;
      const { toggleImageVault } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.post.mockResolvedValue({});

      await toggleImageVault(42, true);

      expect(api.post).toHaveBeenCalledWith('/gallery/42/vault', { vaulted: true });
      expect(addLog).toHaveBeenCalledWith('🔐 Image added to vault');
      expect(fetchGalleryImages).toHaveBeenCalled();
    });

    it('logs unvault message', async () => {
      const { getState } = store;
      const { toggleImageVault } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.post.mockResolvedValue({});

      await toggleImageVault(42, false);

      expect(addLog).toHaveBeenCalledWith('🔓 Image removed from vault');
    });

    it('refetches gallery on error and re-throws', async () => {
      const { getState } = store;
      const { toggleImageVault } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      const error = new Error('Vault error');
      api.post.mockRejectedValue(error);

      await expect(toggleImageVault(42, true)).rejects.toThrow('Vault error');

      expect(addLog).toHaveBeenCalledWith('❌ Vault toggle failed: Vault error');
      expect(fetchGalleryImages).toHaveBeenCalled(); // Error recovery
    });
  });

  // =========================================================================
  // DELETE IMAGE
  // =========================================================================

  describe('deleteGalleryImage', () => {
    it('rejects without password', async () => {
      const { getState } = store;
      const { deleteGalleryImage } = getState();
      const addLog = vi.fn();
      store.setState({ addLog });

      await deleteGalleryImage(42, '');

      expect(addLog).toHaveBeenCalledWith('❌ Password required for delete');
      expect(api.delete).not.toHaveBeenCalled();
    });

    it('calls API with password', async () => {
      const { getState } = store;
      const { deleteGalleryImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.delete.mockResolvedValue({});

      await deleteGalleryImage(42, 'admin-password');

      expect(api.delete).toHaveBeenCalledWith('/gallery/42', { password: 'admin-password' });
      expect(addLog).toHaveBeenCalledWith('🗑️ Image deleted');
      expect(fetchGalleryImages).toHaveBeenCalled();
    });

    it('handles delete errors', async () => {
      const { getState } = store;
      const { deleteGalleryImage } = getState();
      const addLog = vi.fn();
      const fetchGalleryImages = vi.fn();
      store.setState({ addLog, fetchGalleryImages });

      api.delete.mockRejectedValue(new Error('Wrong password'));

      await deleteGalleryImage(42, 'wrong');

      expect(addLog).toHaveBeenCalledWith('❌ Delete failed: Wrong password');
    });
  });

  // =========================================================================
  // PROFILE PICTURE
  // =========================================================================

  describe('setAsProfilePicture', () => {
    it('calls API and refreshes profile', async () => {
      const { getState } = store;
      const { setAsProfilePicture } = getState();
      const addLog = vi.fn();
      const fetchProfilePicture = vi.fn();
      store.setState({ addLog, fetchProfilePicture });

      api.post.mockResolvedValue({});

      await setAsProfilePicture('data:image/png;base64,...');

      expect(api.post).toHaveBeenCalledWith('/profile-picture', { picture: 'data:image/png;base64,...' });
      expect(addLog).toHaveBeenCalledWith('🖼️ Setting profile picture...');
      expect(addLog).toHaveBeenCalledWith('✅ Profile picture updated');
      expect(fetchProfilePicture).toHaveBeenCalled();
    });

    it('handles profile update errors', async () => {
      const { getState } = store;
      const { setAsProfilePicture } = getState();
      const addLog = vi.fn();
      const fetchProfilePicture = vi.fn();
      store.setState({ addLog, fetchProfilePicture });

      api.post.mockRejectedValue(new Error('Invalid image'));

      await setAsProfilePicture('invalid-data');

      expect(addLog).toHaveBeenCalledWith('❌ Profile pic update failed: Invalid image');
    });
  });
});
