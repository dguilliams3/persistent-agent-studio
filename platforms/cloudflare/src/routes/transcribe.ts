/**
 * REST API endpoint for audio transcription
 *
 * @module routes/transcribe
 * @description Provides POST /transcribe endpoint for browser-based voice UI.
 *
 * Accepts audio data directly in request body, returns transcription.
 * This enables voice input from browser-based applications that can
 * record audio via MediaRecorder API.
 *
 * Supported audio formats (handled automatically by Whisper):
 * - audio/webm (MediaRecorder default in Chrome)
 * - audio/ogg (MediaRecorder default in Firefox)
 * - audio/mpeg (MP3)
 * - audio/wav
 *
 * @upstream Called by:
 *   - index.js handleRequest() - Routes POST /transcribe here
 *   - React Web UI voice recording
 * @downstream Calls:
 *   - services/media/audio.js transcribeAudio()
 */

import { transcribeAudio } from '../services/media/index.js';
import type { Env } from '../bootstrap.js';

/**
 * @description Handle POST /transcribe requests
 *
 * Accepts raw audio data in request body and returns transcription.
 * The audio format is auto-detected by Whisper.
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: transcribeAudio()
 *
 * @param {Request} request - Incoming request with audio body
 * @param {Object} env - Environment bindings
 * @param {Object} env.AI - Cloudflare AI binding for Whisper
 * @returns {Promise<Response>} JSON response with transcription
 *
 * @example
 * // Request from browser:
 * const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
 * const response = await fetch('/transcribe', {
 *   method: 'POST',
 *   body: audioBlob
 * });
 * const { success, text } = await response.json();
 *
 * @example
 * // Success response:
 * { "success": true, "text": "Hello, this is my message" }
 *
 * @example
 * // Error response:
 * { "success": false, "error": "Transcription failed: ..." }
 *
 * @note Content-Type header is optional - Whisper auto-detects format
 * @note Max recommended audio length: ~5 minutes (longer may timeout)
 */
export async function handleTranscribe(request: Request, env: Env) {
  // Validate request method
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed. Use POST.' },
      { status: 405 }
    );
  }

  try {
    // Get audio data from request body
    const audioBytes = await request.arrayBuffer();

    if (!audioBytes || audioBytes.byteLength === 0) {
      return Response.json(
        { success: false, error: 'No audio data provided' },
        { status: 400 }
      );
    }

    // Log for debugging (can be removed in production)
    console.log(`Transcribe request: ${audioBytes.byteLength} bytes`);

    // Transcribe using Cloudflare AI Whisper
    const result = await transcribeAudio(audioBytes, env);

    if (result.success) {
      return Response.json({
        success: true,
        text: result.text
      });
    } else {
      return Response.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error('Transcribe endpoint error:', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
