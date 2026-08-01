/**
 * Tool Registry Panel (Settings Tab)
 *
 * @module components/tabs/SettingsTab/ToolRegistryPanel
 * @description Displays the canonical tool registry snapshot so operators can
 * confirm prompt/UI/Telegram help are in sync.
 *
 * @upstream Called by: SettingsTab/index.jsx
 * @downstream Calls: useToolRegistry() hook
 */

import { useToolRegistry } from "../../../hooks/useToolRegistry";

/**
 * @description Settings tab panel that surfaces the tool registry snapshot.
 *
 * @returns Registry cards and refresh control
 */
export default function ToolRegistryPanel() {
  const { tools, loading, error, refresh } = useToolRegistry();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-content-primary">
            Canonical Tool Catalog
          </p>
          <p className="text-xs text-content-muted">
            Same recipe cards injected into the system prompt and `/tools`.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-content-secondary">Loading registry…</p>
      ) : error ? (
        <p className="text-xs text-warning">Failed to load registry: {error}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {(
            tools as Array<{
              id: string;
              category?: string;
              description?: string;
              prompt?: Record<string, any>;
            }>
          ).map((tool) => (
            <div
              key={tool.id}
              className="border border-surface rounded-md p-2 bg-surface"
            >
              <p className="text-xs font-semibold text-content-primary">
                {tool.id}
                {tool.category ? (
                  <span className="text-content-muted"> · {tool.category}</span>
                ) : null}
              </p>
              {tool.prompt?.summary ? (
                <p className="text-xs text-content-secondary">
                  {tool.prompt.summary}
                </p>
              ) : null}
              {tool.prompt?.usage ? (
                <p className="text-xs text-content-muted mt-1">
                  Usage: {tool.prompt.usage}
                </p>
              ) : null}
              {tool.prompt?.examples?.length ? (
                <p className="text-xs text-content-muted">
                  Example: {tool.prompt.examples[0]}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
