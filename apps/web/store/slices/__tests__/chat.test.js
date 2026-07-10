/**
 * Unit tests for chat messaging slice
 *
 * @module tests/store/slices/chat
 * @description Tests for createChatSlice - message sending, image/video attachment
 * handling, and file selection.
 *
 * @covers apps/web/store/slices/chat.js
 *   - sendMessage() - send text/image messages
 *   - handleImageSelect() - image and video file selection
 *   - clearImage() - clear attachment
 *
 * When chat.js changes, validate:
 * - Message sent only when text or image present
 * - Image size limits enforced (5MB)
 * - Video conversion to GIF works
 * - Video size limit enforced (10MB)
 * - State cleared after successful send
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { create } from 'zustand';
import { createChatSlice } from '../chat';

// Mock the api client and WORKER_URL
vi.mock('../../../api/client', () => ({
  default: {
    post: vi.fn(),
    fetchRaw: vi.fn(),
  },
  WORKER_URL: 'http://test.worker.dev',
}));

import api, { WORKER_URL } from '../../../api/client';

// Create test store with chat slice + dependencies
const createTestStore = () => create((set, get) => ({
  ...createChatSlice(set, get),
  // Mock dependencies from other slices
  userInput: 'Test message',
  selectedImage: null,
  addLog: vi.fn(),
  setUserInput: vi.fn(),
  setSelectedImage: vi.fn(),
  setImagePreview: vi.fn(),
  fetchHistory: vi.fn(),
}));

describe('Chat Messaging Slice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SEND MESSAGE
  // =========================================================================

  describe('sendMessage', () => {
    it('sends text-only message', async () => {
      const { getState } = store;

      // Setup: message in input
      store.setState({ userInput: 'Hello Claude' });

      // Mock dependencies
      const mockAddLog = vi.fn();
      const mockSetUserInput = vi.fn();
      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();
      const mockFetchHistory = vi.fn().mockResolvedValue(undefined);

      store.setState({
        addLog: mockAddLog,
        setUserInput: mockSetUserInput,
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
        fetchHistory: mockFetchHistory,
      });

      api.post.mockResolvedValueOnce({ success: true });

      // Action
      await getState().sendMessage();

      // Verify
      expect(api.post).toHaveBeenCalledWith('/message', {
        content: 'Hello Claude',
        image: null,
      });
      expect(mockAddLog).toHaveBeenCalledWith('📤 Sending...');
      expect(mockAddLog).toHaveBeenCalledWith('✅ Sent');
      expect(mockSetUserInput).toHaveBeenCalledWith('');
      expect(mockSetSelectedImage).toHaveBeenCalledWith(null);
      expect(mockSetImagePreview).toHaveBeenCalledWith(null);
      expect(mockFetchHistory).toHaveBeenCalled();
    });

    it('sends message with image', async () => {
      const { getState } = store;

      const imageData = 'data:image/png;base64,abc123';
      store.setState({
        userInput: 'Check this out',
        selectedImage: imageData,
      });

      const mockAddLog = vi.fn();
      const mockSetUserInput = vi.fn();
      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();
      const mockFetchHistory = vi.fn().mockResolvedValue(undefined);

      store.setState({
        addLog: mockAddLog,
        setUserInput: mockSetUserInput,
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
        fetchHistory: mockFetchHistory,
      });

      api.post.mockResolvedValueOnce({ success: true });

      // Action
      await getState().sendMessage();

      // Verify
      expect(api.post).toHaveBeenCalledWith('/message', {
        content: 'Check this out',
        image: imageData,
      });
      expect(mockAddLog).toHaveBeenCalledWith('📤 Sending with image...');
      expect(mockAddLog).toHaveBeenCalledWith('✅ Sent');
      expect(mockSetSelectedImage).toHaveBeenCalledWith(null);
    });

    it('sends image-only message (no text)', async () => {
      const { getState } = store;

      const imageData = 'data:image/png;base64,def456';
      store.setState({
        userInput: '', // No text
        selectedImage: imageData,
      });

      const mockAddLog = vi.fn();
      const mockFetchHistory = vi.fn().mockResolvedValue(undefined);
      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();

      store.setState({
        addLog: mockAddLog,
        fetchHistory: mockFetchHistory,
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
      });

      api.post.mockResolvedValueOnce({ success: true });

      // Action
      await getState().sendMessage();

      // Verify
      expect(api.post).toHaveBeenCalledWith('/message', {
        content: '',
        image: imageData,
      });
    });

    it('requires message or image', async () => {
      const { getState } = store;

      store.setState({
        userInput: '',
        selectedImage: null,
      });

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      // Action
      await getState().sendMessage();

      // Verify - no send
      expect(api.post).not.toHaveBeenCalled();
      expect(mockAddLog).not.toHaveBeenCalled();
    });

    it('handles send errors', async () => {
      const { getState } = store;

      store.setState({ userInput: 'Test' });

      const mockAddLog = vi.fn();
      const mockFetchHistory = vi.fn().mockResolvedValue(undefined);

      store.setState({
        addLog: mockAddLog,
        fetchHistory: mockFetchHistory,
      });

      api.post.mockRejectedValueOnce(new Error('Network timeout'));

      // Action
      await getState().sendMessage();

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith('📤 Sending...');
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Send failed: Network timeout'
      );
      expect(mockFetchHistory).not.toHaveBeenCalled(); // No fetch on error
    });

    it('trims whitespace from message', async () => {
      const { getState } = store;

      store.setState({ userInput: '  Hello  \n\t' });

      const mockAddLog = vi.fn();
      const mockFetchHistory = vi.fn().mockResolvedValue(undefined);
      const mockSetUserInput = vi.fn();

      store.setState({
        addLog: mockAddLog,
        fetchHistory: mockFetchHistory,
        setUserInput: mockSetUserInput,
      });

      api.post.mockResolvedValueOnce({ success: true });

      // Action
      await getState().sendMessage();

      // Verify
      expect(api.post).toHaveBeenCalledWith('/message', {
        content: 'Hello',
        image: null,
      });
    });
  });

  // =========================================================================
  // HANDLE IMAGE SELECT
  // =========================================================================

  describe('handleImageSelect', () => {
    it('loads image as base64', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();

      store.setState({
        addLog: mockAddLog,
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
      });

      const imageData = 'data:image/png;base64,abc123';
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
      };

      // Mock FileReader (must be a regular function, not arrow, to support `new`)
      global.FileReader = function() { return mockFileReader; };

      // Create mock file
      const mockFile = {
        type: 'image/png',
        size: 1000, // 1KB
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      // Action
      await getState().handleImageSelect(mockEvent);

      // Trigger onload callback
      mockFileReader.onload({ target: { result: imageData } });

      // Verify
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);
      expect(mockSetSelectedImage).toHaveBeenCalledWith(imageData);
      expect(mockSetImagePreview).toHaveBeenCalledWith(imageData);
    });

    it('rejects image > 5MB', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockFile = {
        type: 'image/png',
        size: 6 * 1024 * 1024, // 6MB
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith('❌ Image too large (max 5MB)');
    });

    it('converts video to GIF', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();

      store.setState({
        addLog: mockAddLog,
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
      });

      const mockFile = {
        type: 'video/mp4',
        size: 5 * 1024 * 1024, // 5MB
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      const gifDataUrl = 'data:image/gif;base64,xyz789';
      api.fetchRaw.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({
          success: true,
          gifDataUrl,
          metadata: '(100KB)',
        }),
      });

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith('🔄 Converting video to GIF...');
      expect(api.fetchRaw).toHaveBeenCalledWith(
        '/video-to-gif',
        {
          method: 'POST',
          headers: { 'Content-Type': 'video/mp4' },
          body: expect.any(ArrayBuffer),
        }
      );
      expect(mockSetSelectedImage).toHaveBeenCalledWith(gifDataUrl);
      expect(mockSetImagePreview).toHaveBeenCalledWith(gifDataUrl);
      expect(mockAddLog).toHaveBeenCalledWith('✅ GIF ready (100KB)');
    });

    it('rejects video > 10MB', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockFile = {
        type: 'video/mp4',
        size: 11 * 1024 * 1024, // 11MB
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith('❌ Video too large (max 10MB)');
      expect(api.fetchRaw).not.toHaveBeenCalled();
    });

    it('handles video conversion failure', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockFile = {
        type: 'video/mp4',
        size: 5 * 1024 * 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      api.fetchRaw.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({
          success: false,
          error: 'Unsupported codec',
        }),
      });

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Conversion failed: Unsupported codec'
      );
    });

    it('handles video conversion network error', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockFile = {
        type: 'video/mp4',
        size: 5 * 1024 * 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      api.fetchRaw.mockRejectedValueOnce(new Error('Network error'));

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Video conversion error: Network error'
      );
    });

    it('clears converting state on error', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockFile = {
        type: 'video/mp4',
        size: 5 * 1024 * 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };

      const mockEvent = {
        target: { files: [mockFile] },
      };

      api.fetchRaw.mockRejectedValueOnce(new Error('Failed'));

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify
      expect(getState().isConvertingVideo).toBe(false);
    });

    it('cancels if no file selected', async () => {
      const { getState } = store;

      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const mockEvent = {
        target: { files: [] },
      };

      // Action
      await getState().handleImageSelect(mockEvent);

      // Verify - nothing happens
      expect(mockAddLog).not.toHaveBeenCalled();
      expect(api.fetchRaw).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CLEAR IMAGE
  // =========================================================================

  describe('clearImage', () => {
    it('clears selectedImage and imagePreview', () => {
      const { getState } = store;

      const mockSetSelectedImage = vi.fn();
      const mockSetImagePreview = vi.fn();

      store.setState({
        setSelectedImage: mockSetSelectedImage,
        setImagePreview: mockSetImagePreview,
      });

      // Action
      getState().clearImage();

      // Verify
      expect(mockSetSelectedImage).toHaveBeenCalledWith(null);
      expect(mockSetImagePreview).toHaveBeenCalledWith(null);
    });
  });
});
