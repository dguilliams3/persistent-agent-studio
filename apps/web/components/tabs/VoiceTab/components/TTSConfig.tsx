/**
 * TTS Configuration Panel Component
 *
 * @module components/tabs/VoiceTab/components/TTSConfig
 * @description Configuration panel for ElevenLabs TTS settings including
 * model selection, stability (v3 only), and speed controls.
 *
 * Controlled component - all state passed via props from parent.
 *
 * @upstream Called by:
 *   - VoiceTab/index.jsx - Renders in voice testing interface
 * @downstream Calls:
 *   - Select component (from ui/)
 */

import { useState } from 'react';
import { Accordion, Select } from '../../../ui';

/** TTS Model options */
const MODEL_OPTIONS = [
  { value: 'v2', label: 'v2 - Multilingual (Stable)' },
  { value: 'v3', label: 'v3 - Most Expressive (Alpha)' },
  { value: 'flash', label: 'Flash - Ultra-Low Latency' },
  { value: 'turbo', label: 'Turbo - Fast & Balanced' },
];

/** Stability options for v3 */
const STABILITY_OPTIONS = [
  { value: 0, label: 'Creative', hint: 'Varied, expressive' },
  { value: 0.5, label: 'Natural', hint: 'Balanced' },
  { value: 1, label: 'Robust', hint: 'Consistent' },
];

/** Speed presets */
const SPEED_PRESETS = [
  { value: 0.8, label: 'Slow' },
  { value: 1.0, label: 'Normal' },
  { value: 1.15, label: 'Fast' },
];

/**
 * @description TTS configuration panel with model, stability, and speed controls
 *
 * @upstream Called by: VoiceTab/index.jsx
 * @downstream Calls: Select component
 *
 * @param {Object} props
 * @param {string} props.model - Current TTS model ('v2'|'v3'|'flash'|'turbo')
 * @param {Function} props.onModelChange - Model change handler
 * @param {number} props.stability - Stability value (0|0.5|1) for v3
 * @param {Function} props.onStabilityChange - Stability change handler
 * @param {number} props.speed - Speed multiplier (0.7-1.2)
 * @param {Function} props.onSpeedChange - Speed change handler
 * @param {boolean} props.saving - Whether save is in progress
 * @param {boolean} props.saveSuccess - Whether save just succeeded
 * @param {Function} props.onSave - Save handler
 * @returns {JSX.Element} TTS configuration panel
 *
 * @example
 * <TTSConfig
 *   model="v3"
 *   onModelChange={setModel}
 *   stability={0.5}
 *   onStabilityChange={setStability}
 *   speed={1.0}
 *   onSpeedChange={setSpeed}
 *   saving={false}
 *   saveSuccess={false}
 *   onSave={handleSave}
 * />
 */
export default function TTSConfig({ model,
  onModelChange,
  stability,
  onStabilityChange,
  speed,
  onSpeedChange,
  saving,
  saveSuccess,
  onSave, }: any) {
  // Collapsible state - expanded by default since this is a config panel
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Accordion
      title="TTS Configuration"
      variant="card"
      isOpen={isExpanded}
      onToggle={setIsExpanded}
    >
      <div className="space-y-4 pt-2">

      {/* Model Selector */}
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          TTS Model
        </label>
        <Select
          value={model}
          onChange={onModelChange}
          options={MODEL_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          size="sm"
        />
      </div>

      {/* Stability Control (v3 only) */}
      {model === 'v3' && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Voice Style
          </label>
          <div className="flex gap-2">
            {STABILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStabilityChange(opt.value)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  stability === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-depth text-content-secondary hover:bg-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-content-muted mt-1">
            Creative = varied - Natural = balanced - Robust = consistent
          </div>
        </div>
      )}

      {/* Speed Control */}
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Speed: <span className="text-accent">{speed.toFixed(2)}x</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm">Slow</span>
          <input
            type="range"
            min="0.7"
            max="1.2"
            step="0.05"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-sm">Fast</span>
        </div>
        <div className="flex gap-2 mt-2">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onSpeedChange(preset.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                Math.abs(speed - preset.value) < 0.03
                  ? 'bg-accent text-white'
                  : 'bg-depth text-content-secondary hover:bg-surface'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save for Clio button | Phase 7b: More prominent styling */}
      <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-primary text-sm px-4 py-2 glow-accent disabled:opacity-50"
        >
          {saving ? 'Saving...' : '✨ Set for Clio'}
        </button>
        {saveSuccess && (
          <span className="text-sm text-success">
            Clio uses: {model.toUpperCase()}
            {model === 'v3'
              ? ` (${STABILITY_OPTIONS.find((o) => o.value === stability)?.label || 'Natural'})`
              : ''}
            {speed !== 1.0 ? ` @ ${speed.toFixed(2)}x` : ''}
          </span>
        )}
        {!saveSuccess && (
          <span className="text-xs text-content-muted">
            Persists model for Clio's voice messages
          </span>
        )}
      </div>
      </div>
    </Accordion>
  );
}

// Export constants for use by parent or other components
export { MODEL_OPTIONS, STABILITY_OPTIONS, SPEED_PRESETS };
