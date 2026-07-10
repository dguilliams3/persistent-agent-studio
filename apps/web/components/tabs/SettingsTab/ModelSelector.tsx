/**
 * Model Selector Component
 *
 * @module components/tabs/SettingsTab/ModelSelector
 * @description Card-based model picker with visual descriptions and pricing hints.
 * Shows all available Claude models with selection state and characteristics.
 *
 * Neural Observatory Design:
 * - Card layout with cyan glow on selected
 * - Model characteristics (speed, intelligence, cost) as badges
 * - Hover lift effect
 *
 * @upstream Called by: SettingsTab/index.jsx via ModelSettingsSection
 * @downstream Calls: None (pure presentational)
 *
 * @param {Object} props
 * @param {Array} props.options - Model options [{id, label}]
 * @param {string} props.value - Currently selected model ID
 * @param {Function} props.onChange - Callback when selection changes
 * @returns {React.ReactElement}
 *
 * @example
 * <ModelSelector
 *   options={MODEL_OPTIONS}
 *   value={selectedModel}
 *   onChange={setSelectedModel}
 * />
 */

import { Zap, Brain, Sparkles, DollarSign } from 'lucide-react';

/**
 * Model metadata - characteristics and descriptions
 * Keys match MODEL_OPTIONS ids
 */
const MODEL_METADATA = {
  'claude-haiku-4-5-20251001': {
    icon: Zap,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Fastest, most cost-effective',
    traits: [
      { label: 'Speed', level: 3, color: 'bg-emerald-500' },
      { label: 'Cost', level: 1, color: 'bg-emerald-500' },
      { label: 'Intelligence', level: 2, color: 'bg-amber-500' },
    ],
    costHint: '~$1/MTok',
  },
  'claude-sonnet-4-6-20250514': {
    icon: Brain,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Balanced performance',
    traits: [
      { label: 'Speed', level: 2, color: 'bg-cyan-500' },
      { label: 'Cost', level: 2, color: 'bg-amber-500' },
      { label: 'Intelligence', level: 3, color: 'bg-cyan-500' },
    ],
    costHint: '~$3/MTok',
  },
  'claude-opus-4-6': {
    icon: Sparkles,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    description: 'Most capable, highest quality',
    traits: [
      { label: 'Speed', level: 1, color: 'bg-amber-500' },
      { label: 'Cost', level: 3, color: 'bg-rose-500' },
      { label: 'Intelligence', level: 3, color: 'bg-violet-500' },
    ],
    costHint: '~$5/MTok',
  },
};

/**
 * Trait bar - visual indicator for model characteristics
 */
function TraitBar({ label, level, color }: { label: string; level: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-content-muted">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-1.5 rounded-full ${
              i <= level ? color : 'bg-surface'
            }`}
          />
        ))}
      </div>
    </div>
  );
}


/**
 * Single model card
 */
type ModelMetadata = (typeof MODEL_METADATA)[keyof typeof MODEL_METADATA];

function ModelCard({ option, metadata, isSelected, onSelect }: {
  option: { id: string; label: string };
  metadata: ModelMetadata | undefined;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = metadata?.icon || Brain;

  return (
    <button
      onClick={() => onSelect(option.id)}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200
        ${isSelected
          ? `${metadata?.borderColor || 'border-accent'} ${metadata?.bgColor || 'bg-accent/10'} glow-subtle`
          : 'border-border-subtle bg-surface hover:border-border hover:bg-depth'
        }
        group
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon
            size={20}
            className={isSelected ? metadata?.color : 'text-content-muted group-hover:text-content-secondary'}
          />
          <div>
            <h4 className={`font-semibold text-sm ${isSelected ? metadata?.color : 'text-content-primary'}`}>
              {option.label}
            </h4>
            <p className="text-xs text-content-muted">
              {metadata?.description || 'Claude model'}
            </p>
          </div>
        </div>

        {/* Selection indicator */}
        <div className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center
          transition-colors
          ${isSelected
            ? `${metadata?.borderColor || 'border-accent'} ${metadata?.bgColor || 'bg-accent/20'}`
            : 'border-border-subtle'
          }
        `}>
          {isSelected && (
            <div className={`w-2.5 h-2.5 rounded-full ${metadata?.color?.replace('text-', 'bg-') || 'bg-accent'}`} />
          )}
        </div>
      </div>

      {/* Trait bars */}
      {metadata?.traits && (
        <div className="space-y-1.5 mb-3">
          {metadata.traits.map((trait: { label: string; level: number; color: string }) => (
            <TraitBar key={trait.label} {...trait} />
          ))}
        </div>
      )}

      {/* Cost hint */}
      {metadata?.costHint && (
        <div className="flex items-center gap-1 text-xs text-content-muted">
          <DollarSign size={12} />
          <span>{metadata.costHint}</span>
        </div>
      )}
    </button>
  );
}


interface ModelSelectorProps {
  options: Array<{ id: string; label: string }>;
  value?: string;
  onChange: (modelId: string) => void;
}

/**
 * Main ModelSelector component
 */
export default function ModelSelector({ options, value, onChange }: ModelSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((option) => (
        <ModelCard
          key={option.id}
          option={option}
          metadata={MODEL_METADATA[option.id as keyof typeof MODEL_METADATA]}
          isSelected={value === option.id}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}


