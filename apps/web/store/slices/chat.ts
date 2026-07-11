/**
 * Chat Messaging Slice
 *
 * @module store/slices/chat
 * @description Zustand store slice for chat messaging: sending messages to Claude,
 * handling image/video file attachments.
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createChatSlice()
 * @downstream Calls:
 *   - api/client.js - POST /message, fetchRaw('/video-to-gif') for binary input
 */

import api from "../../api/client";
import type { StateCreator } from "zustand";
import type { AppState } from "../types";

export interface ChatSlice {
  sendMessage: () => Promise<void>;
  handleImageSelect: (e: unknown) => Promise<void>;
  clearImage: () => void;
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  /**
   * @description Send a message from the user to Claude
   *
   * Posts message (with optional image attachment) to /message endpoint.
   * Validates that message or image exists. Clears input after sending.
   * Fetches updated history on success.
   *
   * @upstream Called by: ChatTab send button, Enter key handler
   * @downstream Calls: api.post('/message'), addLog, setUserInput, setSelectedImage, setImagePreview, fetchHistory
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/chat.test.js
   *   - "sendMessage - sends text only"
   *   - "sendMessage - sends text with image"
   *   - "sendMessage - clears input on success"
   *   - "sendMessage - fetches history after send"
   *   - "sendMessage - requires text or image"
   *   - "sendMessage - error handling"
   *
   * @example
   * // User types "Hello" and clicks send
   * sendMessage();  // Posts to /message, clears input, fetches history
   *
   * @note Requires either userInput text OR selectedImage to send
   * @note Always clears selectedImage and imagePreview after send
   */
  sendMessage: async () => {
    const {
      userInput,
      selectedImage,
      addLog,
      setUserInput,
      setSelectedImage,
      setImagePreview,
      fetchHistory,
      history,
      setHistory,
    } = get();

    if (!userInput.trim() && !selectedImage) return;

    const text = userInput.trim();
    const imagePayload = selectedImage;
    const hasImage = !!imagePayload;

    // Optimistic echo: the bubble appears INSTANTLY (negative temp id so it
    // can never collide with a real row). fetchHistory() replaces the whole
    // array on success, swapping the temp row for the real server row. On
    // failure we remove the temp row and restore the composer text.
    const optimisticId = -Date.now();
    if (Array.isArray(history)) {
      setHistory([
        ...history,
        {
          id: optimisticId,
          type: "user_message",
          content: text || "📷 image",
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setUserInput("");
    setSelectedImage(null);
    setImagePreview(null);
    addLog(`📤 Sending${hasImage ? " with image" : ""}...`);

    try {
      await api.post("/message", {
        content: text,
        image: imagePayload,
      });
      addLog("✅ Sent");
      await fetchHistory();
    } catch (err: unknown) {
      // Roll back the optimistic bubble and give the user their text back
      const current = get().history;
      if (Array.isArray(current)) {
        setHistory(
          (current as Array<{ id: number }>).filter(
            (entry) => entry.id !== optimisticId,
          ),
        );
      }
      setUserInput(text);
      addLog(
        `❌ Send failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Handle media file selection (image or video) for message attachment
   *
   * Processes both image and video files:
   * - Images: Reads as base64 data URL (max 5MB), directly usable in message
   * - Videos: Sends to /video-to-gif endpoint for conversion (max 10MB), produces GIF data URL
   *
   * Video conversion uses Modal backend via api.fetchRaw for async processing.
   * Updates selectedImage and imagePreview with file data on success.
   *
   * @upstream Called by: ChatTab file input onChange event
   * @downstream Calls: addLog, setSelectedImage, setImagePreview, set(isConvertingVideo), fetch(/video-to-gif)
   *
   * @param {Event} e - HTML file input change event (e.target.files contains selected file)
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/chat.test.js
   *   - "handleImageSelect - loads image as base64"
   *   - "handleImageSelect - converts video to GIF"
   *   - "handleImageSelect - rejects image > 5MB"
   *   - "handleImageSelect - rejects video > 10MB"
   *   - "handleImageSelect - handles conversion failure"
   *   - "handleImageSelect - clears isConvertingVideo on error"
   *   - "handleImageSelect - cancels if no file selected"
   *
   * @note Image limit: 5MB, Video limit: 10MB
   * @note Video conversion is async (shows loading state during conversion)
   * @note Uses FileReader for images, fetch for video conversion
   *
   * @antipattern
   * // WRONG: Assuming synchronous conversion
   * const gif = await convertVideo(file); // No such API
   * // Conversion happens server-side via fetch, takes variable time
   */
  handleImageSelect: async (e: unknown) => {
    const { addLog, setSelectedImage, setImagePreview } = get();
    const file = (e as { target: { files?: FileList } }).target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      if (file.size > 10 * 1024 * 1024) {
        addLog("❌ Video too large (max 10MB)");
        return;
      }

      addLog("🔄 Converting video to GIF...");
      set({ isConvertingVideo: true });

      try {
        const buffer = await file.arrayBuffer();

        const response = await api.fetchRaw("/video-to-gif", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: buffer,
        });

        const result = await response.json();

        if (!result.success) {
          addLog(`❌ Conversion failed: ${result.error}`);
          return;
        }

        setSelectedImage(result.gifDataUrl);
        setImagePreview(result.gifDataUrl);
        addLog(`✅ GIF ready ${result.metadata}`);
      } catch (err: unknown) {
        addLog(
          `❌ Video conversion error: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        set({ isConvertingVideo: false });
      }
    } else {
      if (file.size > 5 * 1024 * 1024) {
        addLog("❌ Image too large (max 5MB)");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        setSelectedImage(event.target?.result);
        setImagePreview(event.target?.result as string | null);
      };
      reader.readAsDataURL(file);
    }
  },

  /**
   * @description Clear selected image attachment
   *
   * Resets both selectedImage and imagePreview to null, typically called
   * when user clicks "clear" button or cancels attachment.
   *
   * @upstream Called by: ChatTab clear/cancel button
   * @downstream Calls: setSelectedImage, setImagePreview
   *
   * @returns {void}
   *
   * @tests apps/web/store/slices/__tests__/chat.test.js
   *   - "clearImage - clears selectedImage"
   *   - "clearImage - clears imagePreview"
   *
   * @example
   * // User clicks "clear attachment" button
   * clearImage();  // Sets both to null, removes preview from UI
   */
  clearImage: () => {
    const { setSelectedImage, setImagePreview } = get();
    setSelectedImage(null);
    setImagePreview(null);
  },
});
