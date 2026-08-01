/**
 * Settings Tab Section Components
 *
 * @module components/tabs/SettingsTab/SettingsSections
 * @description Individual section content components for the Settings tab:
 * Controls, CostToggles, Status.
 *
 * @upstream Called by: SettingsTab index
 * @downstream Calls: Store action handlers via props
 */

import { Icon } from "../../ui";
import type { SleepStatus } from "../../../store/slices/loop";

import { parseDbTimestamp } from '../../ui/historyUtils';
// =============================================================================
// CONTROLS SECTION
// =============================================================================

interface ControlsSectionContentProps {
  state: Record<string, any>;
  isThinking: boolean;
  startLoop: () => void;
  stopLoop: () => void;
  triggerThinkNow: () => void;
  cycleStats: Record<string, any> | null;
}

/**
 * @description Loop control buttons (start/stop, think now, test)
 *
 * @upstream Called by: SettingsTab via SettingsSection wrapper
 * @downstream Calls: Props handlers
 */
export function ControlsSectionContent({
  state,
  isThinking,
  startLoop,
  stopLoop,
  triggerThinkNow,
  cycleStats,
}: ControlsSectionContentProps) {
  const formatLastWake = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = parseDbTimestamp(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={state.isRunning ? stopLoop : startLoop}
          className={state.isRunning ? "btn-danger" : "btn-success"}
        >
          {state.isRunning ? "Pause" : "Start"}
        </button>
        <button
          onClick={triggerThinkNow}
          disabled={isThinking}
          className="btn-secondary disabled:opacity-50"
        >
          Think Now
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-content-muted flex-wrap">
        <span>
          Loop:{" "}
          <span className="text-content-primary">#{state.loopCount || 0}</span>
        </span>
        <span>
          Last cycle:{" "}
          <span className="text-content-primary">
            {formatLastWake(state.lastWakeTime)}
          </span>
        </span>
        <span>
          Interval:{" "}
          <span className="text-content-primary">
            {state.cycleIntervalSeconds || 60}s
          </span>
        </span>
        <span
          className={
            state.isRunning ? "text-success" : "text-warning"
          }
        >
          {state.isRunning ? "● Running" : "○ Paused"}
        </span>
        {cycleStats?.cycles?.[0] && (
          <>
            <span className="border-l border-border-subtle pl-4">
              in:{" "}
              <span className="text-content-secondary font-mono">
                {cycleStats.cycles[0].input_tokens?.toLocaleString() || "—"}
              </span>
            </span>
            <span>
              out:{" "}
              <span className="text-content-secondary font-mono">
                {cycleStats.cycles[0].output_tokens?.toLocaleString() || "—"}
              </span>
            </span>
            <span>
              cache:{" "}
              <span className="text-content-secondary font-mono">
                {cycleStats.stats?.cacheHitRate?.toFixed(0) || "0"}%
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COST & TOGGLES SECTION
// =============================================================================

interface CostTogglesSectionProps {
  cycleStatsLimit: number;
  setCycleStatsLimit: (n: number) => void;
  fetchCycleStats: () => void;
  cycleStats: Record<string, any> | null;
  formatTimeShort: (time: string) => string;
  batchEnabled: boolean;
  batchMinutes: number;
  setBatchMinutes: (v: number) => void;
  toggleBatchWithTimer: (enabled: boolean) => void;
  streamingEnabled: boolean;
  toggleStreaming: (enabled: boolean) => void;
  showProfilePic: boolean;
  setShowProfilePic: (v: boolean) => void;
}

/**
 * @description Cycle cost stats and feature toggles
 *
 * @upstream Called by: SettingsTab via SettingsSection wrapper
 */
export function CostTogglesSection({
  cycleStatsLimit,
  setCycleStatsLimit,
  fetchCycleStats,
  cycleStats,
  formatTimeShort,
  batchEnabled,
  batchMinutes,
  setBatchMinutes,
  toggleBatchWithTimer,
  streamingEnabled,
  toggleStreaming,
  showProfilePic,
  setShowProfilePic,
}: CostTogglesSectionProps) {
  return (
    <div className="card flex items-center gap-4 text-sm p-3 flex-wrap">
      <span className="text-content-muted">Cost (last</span>
      <input
        type="number"
        value={cycleStatsLimit}
        onChange={(e) => setCycleStatsLimit(parseInt(e.target.value) || 10)}
        onBlur={() => fetchCycleStats()}
        onKeyDown={(e) => e.key === "Enter" && fetchCycleStats()}
        className="input-sm w-14 text-center text-xs"
        min="1"
      />
      <span className="text-content-muted">cycles):</span>
      {cycleStats?.stats ? (
        <span className="text-success">
          {cycleStats.cycles?.[0]?.estimated_cost_cents?.toFixed(3) || "0"}c
          last
          {cycleStats.cycles?.[0]?.created_at
            ? ` @ ${formatTimeShort(cycleStats.cycles[0].created_at)}`
            : ""}{" "}
          - {cycleStats.stats.totalCostCents?.toFixed(2)}c total -{" "}
          {cycleStats.stats.avgCostCents?.toFixed(3)}c avg -{" "}
          {cycleStats.stats.cacheHitRate?.toFixed(0)}% cache
        </span>
      ) : (
        <span className="text-content-muted">loading...</span>
      )}

      <div className="border-l border-border-subtle h-4 mx-1" />
      <label
        className="flex items-center gap-2 cursor-pointer"
        title="50% cost savings for cycles between 12AM-9AM Eastern"
      >
        <input
          type="checkbox"
          checked={batchEnabled}
          onChange={(e) => toggleBatchWithTimer(e.target.checked)}
          className="w-5 h-5 sm:w-4 sm:h-4 rounded bg-depth border-border-subtle text-accent focus:ring-accent"
        />
        <span className="text-content-secondary">Batch</span>
      </label>
      <input
        type="number"
        value={batchMinutes}
        onChange={(e) => setBatchMinutes(parseInt(e.target.value) || 0)}
        onKeyDown={(e) =>
          e.key === "Enter" && batchMinutes && toggleBatchWithTimer(true)
        }
        placeholder="min"
        className="input-sm w-12 text-center text-xs"
        min="1"
        title="Batch for X minutes"
      />

      <div className="border-l border-border-subtle h-4 mx-1" />
      <label
        className="flex items-center gap-2 cursor-pointer"
        title="Stream actions to Telegram in real-time"
      >
        <input
          type="checkbox"
          checked={streamingEnabled}
          onChange={(e) => toggleStreaming(e.target.checked)}
          className="w-5 h-5 sm:w-4 sm:h-4 rounded bg-depth border-border-subtle text-accent focus:ring-accent"
        />
        <span className="text-content-secondary">Stream</span>
      </label>

      <div className="border-l border-border-subtle h-4 mx-1" />
      <label
        className="flex items-center gap-2 cursor-pointer"
        title="Show Claude's profile picture"
      >
        <input
          type="checkbox"
          checked={showProfilePic}
          onChange={(e) => setShowProfilePic(e.target.checked)}
          className="w-5 h-5 sm:w-4 sm:h-4 rounded bg-depth border-border-subtle text-pink-500 focus:ring-pink-500"
        />
        <span className="text-content-secondary">Profile</span>
      </label>
    </div>
  );
}

// =============================================================================
// STATUS SECTION
// =============================================================================

interface StatusSectionProps {
  userStatusInput: string;
  setUserStatusInput: (v: string) => void;
  userStatus: string | null;
  updateUserStatus: (status: string | null) => void;
  sleepStatus: SleepStatus;
  wakeUp: () => void;
  maxTokensInput: string;
  setMaxTokensInput: (v: string) => void;
  updateMaxTokens: () => void;
}

/**
 * @description The user's status, sleep status, and max tokens settings
 *
 * @upstream Called by: SettingsTab via SettingsSection wrapper
 */
export function StatusSection({
  userStatusInput,
  setUserStatusInput,
  userStatus,
  updateUserStatus,
  sleepStatus,
  wakeUp,
  maxTokensInput,
  setMaxTokensInput,
  updateMaxTokens,
}: StatusSectionProps) {
  return (
    <div className="card flex items-center gap-4 text-sm p-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-content-muted">Status:</span>
        <input
          type="text"
          value={userStatusInput}
          onChange={(e) => setUserStatusInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && updateUserStatus(userStatusInput)
          }
          placeholder={userStatus || "What's up?"}
          className="input-sm w-32 text-xs"
        />
        <button
          onClick={() => updateUserStatus(userStatusInput)}
          disabled={!userStatusInput}
          className="btn-success px-2 py-1 text-xs disabled:opacity-50"
        >
          Set
        </button>
        {userStatus && (
          <button
            onClick={() => {
              updateUserStatus(null);
              setUserStatusInput("");
            }}
            className="btn-ghost px-2 py-1 text-xs"
            title="Clear status"
          >
            X
          </button>
        )}
      </div>
      {userStatus && (
        <span className="text-success text-xs">"{userStatus}"</span>
      )}

      <div className="border-l border-border-subtle h-4 mx-1" />

      {sleepStatus?.sleeping ? (
        <div className="flex items-center gap-2">
          <span className="text-accent text-xs">
            Sleeping until{" "}
            {new Date(sleepStatus.sleepUntil!).toLocaleTimeString()}
          </span>
          <button
            onClick={wakeUp}
            className="btn-primary bg-warning hover:bg-warning/90 px-2 py-1 text-xs"
          >
            Wake
          </button>
        </div>
      ) : (
        <span className="text-content-muted text-xs">Awake</span>
      )}

      <div className="border-l border-border-subtle h-4 mx-1" />

      <div className="flex items-center gap-2">
        <span className="text-content-muted">Tokens:</span>
        <input
          type="number"
          value={maxTokensInput}
          onChange={(e) => setMaxTokensInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && updateMaxTokens()}
          className="input-sm w-16 text-center text-xs"
          min="500"
          max="16000"
        />
        <button
          onClick={updateMaxTokens}
          className="btn-primary px-2 py-1 text-xs"
        >
          Set
        </button>
      </div>
    </div>
  );
}
