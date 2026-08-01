/**
 * Danger Zone Component
 *
 * @module components/tabs/SettingsTab/DangerZone
 * @description Isolated section for destructive operations with confirmation.
 * Red-tinted styling clearly indicates irreversible actions.
 *
 * Neural Observatory Design:
 * - Red accent borders and backgrounds
 * - Warning icon and text
 * - Confirmation required before destructive actions
 * - Clear explanation of consequences
 *
 * @upstream Called by: SettingsTab/index.jsx
 * @downstream Calls: resetAll, resetRagConfig from Zustand store
 *
 * @param {Object} props
 * @param {Function} props.onResetAll - Full system reset handler
 * @param {Function} props.onResetRag - Reset RAG to defaults handler
 * @returns {React.ReactElement}
 *
 * @example
 * <DangerZone onResetAll={resetAll} onResetRag={resetRagConfig} />
 *
 * @antipattern Don't add non-destructive actions here - this section is for
 * irreversible operations only.
 */

import React, { useState } from 'react';
import { AlertTriangle, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';

/**
 * Single dangerous action with confirmation
 */
function DangerAction({
  icon: Icon,
  title,
  description,
  buttonText,
  confirmText,
  onConfirm,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  buttonText: string;
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClick = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    // Execute the action
    setIsExecuting(true);
    Promise.resolve(onConfirm()).finally(() => {
      setIsExecuting(false);
      setShowConfirm(false);
    });
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-surface/50 border border-rose-500/10">
      {/* Info */}
      <div className="flex items-start gap-3">
        <Icon size={18} className="text-rose-400/70 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-content-primary">{title}</h4>
          <p className="text-xs text-content-muted mt-0.5">{description}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {showConfirm ? (
          <>
            <button
              onClick={handleCancel}
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={isExecuting}
            >
              Cancel
            </button>
            <button
              onClick={handleClick}
              disabled={isExecuting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg
                bg-rose-500 text-white hover:bg-rose-600
                disabled:opacity-50 transition-colors"
            >
              {isExecuting ? 'Executing...' : confirmText || 'Confirm'}
            </button>
          </>
        ) : (
          <button
            onClick={handleClick}
            className="px-3 py-1.5 text-xs font-medium rounded-lg
              bg-rose-500/10 text-rose-400 border border-rose-500/30
              hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors"
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}


interface DangerZoneProps {
  onResetAll: () => void | Promise<void>;
  onResetRag: () => void | Promise<void>;
}

/**
 * Main DangerZone component
 *
 * Phase 7b: Enhanced visual weight with red left border and background tint
 * to make destructive section clearly stand out.
 */
export default function DangerZone({ onResetAll, onResetRag }: DangerZoneProps) {
  return (
    <div className="space-y-4 border-l-4 border-rose-500/70 pl-4 bg-rose-500/5 -ml-4 py-2 rounded-r-lg">
      {/* Warning header */}
      <div className="flex items-center gap-2 text-rose-400">
        <ShieldAlert size={16} />
        <span className="text-xs font-medium uppercase tracking-wider">
          Destructive Actions
        </span>
      </div>

      {/* Warning message */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
        <AlertTriangle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-rose-300/80">
          Actions in this section are <strong>irreversible</strong>. They will permanently
          delete data or reset configurations. Make sure you understand the consequences
          before proceeding.
        </p>
      </div>

      {/* Actions list */}
      <div className="space-y-3">
        <DangerAction
          icon={RotateCcw}
          title="Reset RAG Configuration"
          description="Restore semantic retrieval settings to defaults (topK, halflife, weights)"
          buttonText="Reset RAG"
          confirmText="Reset to Defaults"
          onConfirm={onResetRag}
        />

        <DangerAction
          icon={Trash2}
          title="Reset All State"
          description="Delete ALL data including history, memories, summaries, and configuration. Cannot be undone."
          buttonText="Reset All"
          confirmText="Delete Everything"
          onConfirm={onResetAll}
        />
      </div>
    </div>
  );
}


