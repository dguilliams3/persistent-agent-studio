/**
 * Audio Services - Text-to-Speech and Speech-to-Text
 *
 * @module services/media/audio
 * @description Consolidated audio processing module for TTS and STT operations.
 *
 * ## Text-to-Speech (TTS)
 * Uses ElevenLabs API for high-quality voice synthesis.
 * - Multiple models: v2 (stable), v3 (expressive), flash (low-latency), turbo
 * - Configurable voice settings: stability, style, speed
 * - Default voice: Bella (natural, conversational)
 *
 * ## Speech-to-Text (STT)
 * Uses Cloudflare AI Whisper for transcription.
 * - Model: @cf/openai/whisper-large-v3-turbo
 * - Supports: OGG, MP3, WebM, WAV formats
 * - Options: transcribe (same language) or translate (to English)
 *
 * @upstream Called by:
 *   - executeActions() in index.js - MESSAGE_USER with voice:true
 *   - telegram/commands/voice.js - voice message handling
 *   - telegram/commands/operations.js - /tts command
 * @downstream Calls:
 *   - ElevenLabs TTS API (api.elevenlabs.io)
 *   - Cloudflare AI Whisper (env.AI)
 *   - Telegram Bot API (file downloads)
 */

import type { Env } from '../../bootstrap.js';

type TtsOptions = {
  voiceId?: string;
  modelId?: keyof typeof TTS_MODELS | string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
};

type TranscribeOptions = {
  task?: 'transcribe' | 'translate';
};

type TelegramGetFileResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    file_path?: string;
  };
};

// =============================================================================
// TTS CONFIGURATION
// =============================================================================

/**
 * @description Default voice ID for TTS output
 * Bella - natural, conversational female voice
 */
const DEFAULT_VOICE_ID = '4RZ84U1b4WCqpu57LvIq';

/**
 * @description Default model ID for TTS
 * eleven_multilingual_v2 is stable and reliable
 */
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

/**
 * @description Available ElevenLabs TTS models
 * Note: Not all voices support all models. v3 is in alpha and may not work with all pre-made voices.
 */
export const TTS_MODELS = {
  'v3': 'eleven_v3',              // Most expressive, emotion tags (alpha - limited voice support)
  'v2': 'eleven_multilingual_v2', // Stable, reliable, 29 languages (recommended)
  'flash': 'eleven_flash_v2_5',   // Ultra-low latency (<75ms)
  'turbo': 'eleven_turbo_v2_5'    // Fast, balanced
};

// =============================================================================
// TEXT-TO-SPEECH (TTS)
// =============================================================================

/**
 * @description Convert text to speech using ElevenLabs API
 *
 * Takes text content and returns MP3 audio bytes. The audio can then
 * be sent via Telegram's sendVoice API for voice message delivery.
 *
 * @upstream Called by: MESSAGE_USER action handler when voice:true
 * @downstream Calls: ElevenLabs text-to-speech API
 *
 * @param {string} text - The text to convert to speech
 * @param {Object} env - Environment object containing ELEVENLABS_API_KEY
 * @param {Object} [options={}] - Optional configuration
 * @param {string} [options.voiceId] - Override default voice ID
 * @param {string} [options.modelId] - Override default model (v3, v2, flash, turbo)
 * @param {number} [options.stability=0.31] - Voice stability (0-1)
 * @param {number} [options.similarityBoost=0.75] - Voice similarity (0-1)
 * @param {number} [options.style=0.48] - Style exaggeration (0-1)
 * @param {number} [options.speed=1.0] - Speech speed (0.7-1.2, default 1.0)
 *
 * @returns {Promise<{success: boolean, audio?: ArrayBuffer, error?: string}>}
 *   - success: Whether TTS generation succeeded
 *   - audio: MP3 audio data as ArrayBuffer (if success)
 *   - error: Error message (if failed)
 *
 * @example
 * const result = await textToSpeech("Hello!", env);
 * if (result.success) {
 *   await sendTelegramVoice(chatId, result.audio, env);
 * }
 *
 * @note Free tier is 10k chars/month - monitor usage
 * @note Returns MP3 format compatible with Telegram voice messages
 */
export async function textToSpeech(text: string, env: Env, options: TtsOptions = {}) {
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'ELEVENLABS_API_KEY not configured' };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Empty text provided' };
  }

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  // Support both shorthand (v3, v2) and full model IDs
  const modelIdOption = options.modelId || DEFAULT_MODEL_ID;
  const modelId = TTS_MODELS[modelIdOption as keyof typeof TTS_MODELS] || modelIdOption;
  const stability = options.stability ?? 0.31;
  const similarityBoost = options.similarityBoost ?? 0.75;
  const style = options.style ?? 0.48;
  const speed = options.speed ?? 1.0;

  try {
    // Build voice_settings - note: v3 has different requirements
    const voiceSettings: {
      stability: number;
      similarity_boost: number;
      style: number;
      speed: number;
      use_speaker_boost?: boolean;
    } = {
      stability: stability,
      similarity_boost: similarityBoost,
      style: style,
      speed: speed
    };

    // v3-specific settings
    if (modelId === 'eleven_v3') {
      // v3 only accepts stability: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
      // Default to 0.5 (Natural) if not explicitly set to a valid value
      const validV3Stability = [0.0, 0.5, 1.0];
      if (!validV3Stability.includes(stability)) {
        voiceSettings.stability = 0.5; // Natural
      }
      // use_speaker_boost is NOT supported for v3
    } else {
      voiceSettings.use_speaker_boost = true;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: voiceSettings
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);

      // Parse error for user-friendly message
      let errorMsg = `ElevenLabs API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail?.message) {
          errorMsg = errorJson.detail.message;
        } else if (errorJson.detail?.status) {
          // Handle known error types
          if (errorJson.detail.status === 'voice_not_fine_tuned_for_model') {
            errorMsg = `Voice not compatible with ${modelId}. Try v2 or flash model.`;
          } else {
            errorMsg = errorJson.detail.status;
          }
        }
      } catch (e) {
        // Keep generic error message
      }

      return { success: false, error: errorMsg };
    }

    const audioBuffer = await response.arrayBuffer();
    return { success: true, audio: audioBuffer };
  } catch (err) {
    console.error('ElevenLabs TTS error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// =============================================================================
// SPEECH-TO-TEXT (STT)
// =============================================================================

/**
 * @description Transcribe audio to text using Cloudflare AI Whisper
 *
 * Takes raw audio bytes and returns transcribed text. Whisper handles
 * multiple audio formats automatically (OGG, MP3, WebM, WAV).
 *
 * @upstream Called by: handleVoiceMessage(), handleTranscribe()
 * @downstream Calls: env.AI.run('@cf/openai/whisper-large-v3-turbo')
 *
 * @param {ArrayBuffer} audioBytes - Audio data to transcribe
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} env.AI - Cloudflare AI binding
 * @param {Object} [options={}] - Transcription options
 * @param {string} [options.task='transcribe'] - 'transcribe' (same language) or 'translate' (to English)
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 *
 * @example
 * const audioBuffer = await response.arrayBuffer();
 * const result = await transcribeAudio(audioBuffer, env);
 * if (result.success) {
 *   console.log(result.text); // "Hello, this is my message"
 * }
 *
 * @example
 * // With translation (non-English to English)
 * const result = await transcribeAudio(audioBuffer, env, { task: 'translate' });
 *
 * @note Whisper handles audio format detection automatically
 * @note Typical latency: 1-3 seconds for 30-second audio
 */
export async function transcribeAudio(audioBytes: ArrayBuffer, env: Env, options: TranscribeOptions = {}) {
  const { task = 'transcribe' } = options;

  try {
    // Convert ArrayBuffer to Uint8Array for Cloudflare AI
    const audioArray = new Uint8Array(audioBytes);

    const result = await (env.AI as any).run('@cf/openai/whisper-large-v3-turbo', {
      audio: [...audioArray],
      task
    }) as { text?: string } | null;

    // Whisper returns { text: "transcribed text" }
    if (result && result.text !== undefined) {
      return {
        success: true,
        text: result.text.trim()
      };
    }

    return {
      success: false,
      error: 'Whisper returned empty result'
    };
  } catch (err) {
    console.error('Transcription error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown transcription error'
    };
  }
}

// =============================================================================
// TELEGRAM FILE HELPERS
// =============================================================================

/**
 * @description Download a file from Telegram servers
 *
 * Telegram voice messages require two API calls:
 * 1. getFile to get the file_path from file_id
 * 2. Download from https://api.telegram.org/file/bot<token>/<file_path>
 *
 * @upstream Called by: handleVoiceMessage() in telegram/commands/voice.js
 * @downstream Calls: Telegram Bot API (getFile endpoint, file download)
 *
 * @param {string} fileId - Telegram file_id from voice message object
 * @param {Object} env - Environment with TELEGRAM_BOT_TOKEN
 * @param {string} env.TELEGRAM_BOT_TOKEN - Telegram bot token
 * @returns {Promise<{success: boolean, data?: ArrayBuffer, mimeType?: string, error?: string}>}
 *
 * @example
 * // In voice message handler:
 * const file = await downloadTelegramFile(message.voice.file_id, env);
 * if (file.success) {
 *   const transcription = await transcribeAudio(file.data, env);
 * }
 *
 * @note Telegram files are only available for ~1 hour after message is sent
 * @note Max file size for bots is 20MB
 */
export async function downloadTelegramFile(fileId: string, env: Env) {
  const token = env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN not configured'
    };
  }

  try {
    // Step 1: Get file path from Telegram
    const getFileResponse = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );

    if (!getFileResponse.ok) {
      return {
        success: false,
        error: `Telegram getFile failed: ${getFileResponse.status}`
      };
    }

    const getFileData = await getFileResponse.json() as TelegramGetFileResponse;

    if (!getFileData.ok || !getFileData.result?.file_path) {
      return {
        success: false,
        error: getFileData.description || 'Failed to get file path'
      };
    }

    const filePath = getFileData.result.file_path;

    // Step 2: Download the actual file
    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileResponse = await fetch(fileUrl);

    if (!fileResponse.ok) {
      return {
        success: false,
        error: `File download failed: ${fileResponse.status}`
      };
    }

    const audioData = await fileResponse.arrayBuffer();

    // Extract mime type from file path if possible
    let mimeType = 'audio/ogg'; // Default for Telegram voice messages
    if (filePath.endsWith('.mp3')) mimeType = 'audio/mpeg';
    else if (filePath.endsWith('.wav')) mimeType = 'audio/wav';
    else if (filePath.endsWith('.webm')) mimeType = 'audio/webm';

    return {
      success: true,
      data: audioData,
      mimeType
    };
  } catch (err) {
    console.error('Telegram file download error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown download error'
    };
  }
}
