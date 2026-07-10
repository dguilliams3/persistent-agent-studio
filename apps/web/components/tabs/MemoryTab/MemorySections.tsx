/**
 * Memory Tab Section Components
 *
 * @module components/tabs/MemoryTab/MemorySections
 * @description Individual section components for the Memory tab: Notebook,
 * Cold Storage, Reminders, Observations, Learnings, Questions.
 *
 * @upstream Called by: MemoryTab index
 * @downstream Calls: SectionCard, estimateTokens, parseJsonArray
 */

import SectionCard from "./SectionCard";
import { estimateTokens, parseJsonArray } from "./constants";

// =============================================================================
// NOTEBOOK SECTION
// =============================================================================

interface NotebookSectionProps {
  notebook: Array<Record<string, any>>;
  formatTime: (time: string) => string;
}

/**
 * @description Saved notes from Claude's notebook
 *
 * @upstream Called by: MemoryTab
 * @downstream Calls: formatTime, estimateTokens
 */
export function NotebookSection({
  notebook,
  formatTime,
}: NotebookSectionProps) {
  const totalTokens = notebook.reduce(
    (sum, n) => sum + estimateTokens(n.content),
    0,
  );
  return (
    <SectionCard
      title={
        <>
          Notebook
          <span className="text-content-secondary font-normal text-sm ml-2">
            {notebook.length} saved notes
            {totalTokens > 0 && ` • ~${totalTokens.toLocaleString()} tok`}
          </span>
        </>
      }
    >
      <div className="h-64 overflow-y-auto resize-y min-h-24">
        {notebook.map((note) => (
          <details
            key={note.id}
            className="border-b border-border-subtle last:border-b-0"
          >
            <summary className="p-3 cursor-pointer text-success/80 text-sm">
              ▼ "{note.title}" —{" "}
              <span className="text-content-secondary">{note.summary}</span>
            </summary>
            <div className="px-3 pb-3">
              <pre className="text-content-primary text-sm whitespace-pre-wrap bg-depth p-3 rounded-md max-h-64 overflow-y-auto">
                {note.content}
              </pre>
              <div className="text-content-muted text-xs mt-2">
                Created: {formatTime(note.created_at)}
              </div>
            </div>
          </details>
        ))}
        {notebook.length === 0 && (
          <div className="p-3 text-content-muted italic">No notes yet</div>
        )}
      </div>
    </SectionCard>
  );
}

// =============================================================================
// COLD STORAGE SECTION
// =============================================================================

interface ColdStorageSectionProps {
  coldStorage: Array<Record<string, any>>;
}

/**
 * @description Permanent frozen memories
 *
 * @upstream Called by: MemoryTab (conditionally)
 */
export function ColdStorageSection({ coldStorage }: ColdStorageSectionProps) {
  const totalTokens = coldStorage.reduce(
    (sum, c) => sum + estimateTokens(c.content),
    0,
  );
  return (
    <SectionCard
      title={
        <>
          Cold Storage
          <span className="text-content-secondary font-normal text-sm ml-2">
            {coldStorage.length} frozen memories
            {totalTokens > 0 && ` • ~${totalTokens.toLocaleString()} tok`}
          </span>
        </>
      }
    >
      <div className="space-y-2 p-3 h-48 overflow-y-auto resize-y min-h-24">
        {coldStorage.map((item) => (
          <div key={item.id} className="bg-depth rounded-md p-2 text-sm">
            <div className="text-accent/90">{item.content}</div>
            {item.reason && (
              <div className="text-content-muted text-xs mt-1">
                Why: {item.reason}
              </div>
            )}
          </div>
        ))}
        {coldStorage.length === 0 && (
          <div className="text-content-muted italic">No frozen memories</div>
        )}
      </div>
    </SectionCard>
  );
}

// =============================================================================
// REMINDERS SECTION
// =============================================================================

interface RemindersSectionProps {
  reminders: Array<Record<string, any>>;
}

/**
 * @description Active reminders
 *
 * @upstream Called by: MemoryTab (conditionally)
 */
export function RemindersSection({ reminders }: RemindersSectionProps) {
  const totalTokens = reminders.reduce(
    (sum, r) => sum + estimateTokens(r.content),
    0,
  );
  return (
    <SectionCard
      title={
        <>
          Reminders
          <span className="text-content-secondary font-normal text-sm ml-2">
            {reminders.length} active
            {totalTokens > 0 && ` • ~${totalTokens.toLocaleString()} tok`}
          </span>
        </>
      }
    >
      <div className="space-y-2 p-3 h-48 overflow-y-auto resize-y min-h-24">
        {reminders.map((r) => (
          <div key={r.id} className="bg-depth rounded-md p-2 text-sm">
            <div className="text-warning/90">{r.content}</div>
            <div className="text-content-muted text-xs mt-1">
              {r.condition || "persistent"}
            </div>
          </div>
        ))}
        {reminders.length === 0 && (
          <div className="text-content-muted italic">No active reminders</div>
        )}
      </div>
    </SectionCard>
  );
}

// =============================================================================
// OBSERVATIONS SECTION
// =============================================================================

interface ObservationsSectionProps {
  observations: Array<Record<string, any>>;
  formatTime: (time: string) => string;
}

/**
 * @description Claude's observations about the user
 *
 * @upstream Called by: MemoryTab
 * @downstream Calls: formatTime
 */
export function ObservationsSection({
  observations,
  formatTime,
}: ObservationsSectionProps) {
  return (
    <SectionCard
      title={`Observations About the User (${observations.length} entries)`}
    >
      <div className="h-64 overflow-y-auto resize-y min-h-24">
        {observations.map((obs) => (
          <details
            key={obs.id}
            className="border-b border-border-subtle last:border-b-0"
          >
            <summary className="p-3 cursor-pointer text-accent/80 text-sm">
              <span className="font-medium">"{obs.title}"</span>
              <span className="text-content-secondary ml-2">
                — {obs.summary || "(no summary)"}
              </span>
              <div className="text-content-muted text-xs mt-1">
                Created: {formatTime(obs.created_at)}
                {obs.updated_at !== obs.created_at &&
                  ` | Updated: ${formatTime(obs.updated_at)}`}
                {obs.deleted_at && (
                  <span className="text-danger ml-2">
                    (deleted: {formatTime(obs.deleted_at)})
                  </span>
                )}
              </div>
            </summary>
            <div className="px-3 pb-3">
              <pre className="text-content-primary text-sm whitespace-pre-wrap bg-depth p-3 rounded-md max-h-64 overflow-y-auto">
                {obs.content}
              </pre>
            </div>
          </details>
        ))}
        {observations.length === 0 && (
          <div className="p-3 text-content-muted italic">
            No observations yet
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// =============================================================================
// LEARNINGS SECTION
// =============================================================================

interface LearningsSectionProps {
  learned: Array<Record<string, any>>;
  formatTime: (time: string) => string;
  onDelete: (id: string) => Promise<boolean>;
}

/**
 * @description Verified self-knowledge from experience
 *
 * Displays learnings with confidence levels:
 * - load-bearing: Core stable knowledge
 * - stable: Well-established
 * - tentative: Still being verified
 *
 * @upstream Called by: MemoryTab
 * @downstream Calls: formatTime, parseJsonArray
 */
export function LearningsSection({
  learned,
  formatTime,
  onDelete,
}: LearningsSectionProps) {
  const getConfidenceStyle = (confidence: string) => {
    switch (confidence) {
      case "load-bearing":
        return "bg-success/30 text-success border border-success/40";
      case "stable":
        return "bg-success/20 text-success/90 border border-success/30";
      default:
        return "bg-success/10 text-success/80 border border-success/20";
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case "load-bearing":
        return "🌳";
      case "stable":
        return "🌿";
      default:
        return "🌱";
    }
  };

  const totalTokens = learned.reduce(
    (sum, l) => sum + estimateTokens(l.content),
    0,
  );
  return (
    <SectionCard
      title={
        <>
          Learnings
          <span className="text-content-secondary font-normal text-sm ml-2">
            {learned.length} entries
            {totalTokens > 0 && ` • ~${totalTokens.toLocaleString()} tok`}
          </span>
        </>
      }
    >
      <div className="h-64 overflow-y-auto resize-y min-h-24">
        {learned.map((item) => (
          <details
            key={item.id}
            className="border-b border-border-subtle last:border-b-0"
          >
            <summary className="p-3 cursor-pointer text-success/80 text-sm">
              <span
                className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${getConfidenceStyle(item.confidence)}`}
              >
                {getConfidenceIcon(item.confidence)} {item.confidence}
              </span>
              <span className="text-content-primary">
                {item.content?.substring(0, 80)}
                {item.content?.length > 80 ? "..." : ""}
              </span>
              <div className="text-content-muted text-xs mt-1">
                Created: {formatTime(item.created_at)}
                {item.promoted_to_cold_storage && (
                  <span className="text-accent ml-2">
                    (promoted to cold storage)
                  </span>
                )}
              </div>
            </summary>
            <div className="px-3 pb-3 space-y-3">
              <pre className="text-content-primary text-sm whitespace-pre-wrap bg-depth p-3 rounded-md">
                {item.content}
              </pre>
              {item.supporting_evidence &&
                parseJsonArray(item.supporting_evidence).length > 0 && (
                  <div className="text-xs">
                    <span className="text-success font-medium block mb-1">
                      Supporting Evidence:
                    </span>
                    <ul className="list-disc ml-5 space-y-1">
                      {parseJsonArray(item.supporting_evidence).map(
                        (evidence, i) => (
                          <li key={i} className="text-content-secondary">
                            {evidence}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              {item.challenging_evidence &&
                parseJsonArray(item.challenging_evidence).length > 0 && (
                  <div className="text-xs">
                    <span className="text-warning font-medium block mb-1">
                      Challenging Evidence:
                    </span>
                    <ul className="list-disc ml-5 space-y-1">
                      {parseJsonArray(item.challenging_evidence).map(
                        (evidence, i) => (
                          <li key={i} className="text-content-secondary">
                            {evidence}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              <div className="flex justify-end pt-2 border-t border-border-subtle mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete learning #${item.id}?`)) {
                      onDelete(item.id);
                    }
                  }}
                  className="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded transition-colors"
                  title="Delete this learning (requires admin password)"
                >
                  Delete
                </button>
              </div>
            </div>
          </details>
        ))}
        {learned.length === 0 && (
          <div className="p-3 text-content-muted italic">
            No learnings recorded yet
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// =============================================================================
// QUESTIONS SECTION
// =============================================================================

interface QuestionsSectionProps {
  questions: Array<Record<string, any>>;
  formatTime: (time: string) => string;
}

/**
 * @description Open questions Claude is holding
 *
 * @upstream Called by: MemoryTab
 * @downstream Calls: formatTime, parseJsonArray
 */
export function QuestionsSection({
  questions,
  formatTime,
}: QuestionsSectionProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-success/20 text-success border border-success/30";
      case "dissolved":
        return "bg-depth text-content-muted border border-border-subtle";
      case "exploring":
        return "bg-warning/20 text-warning border border-warning/30";
      default:
        return "bg-accent/20 text-accent border border-accent/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return "✅";
      case "dissolved":
        return "💨";
      case "exploring":
        return "🔍";
      default:
        return "🔓";
    }
  };

  const totalTokens = questions.reduce(
    (sum, q) => sum + estimateTokens(q.content),
    0,
  );
  return (
    <SectionCard
      title={
        <>
          Open Questions
          <span className="text-content-secondary font-normal text-sm ml-2">
            {questions.length} questions
            {totalTokens > 0 && ` • ~${totalTokens.toLocaleString()} tok`}
          </span>
        </>
      }
    >
      <div className="h-64 overflow-y-auto resize-y min-h-24">
        {questions.map((q) => (
          <details
            key={q.id}
            className="border-b border-border-subtle last:border-b-0"
          >
            <summary className="p-3 cursor-pointer text-accent/80 text-sm">
              <span
                className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${getStatusStyle(q.status)}`}
              >
                {getStatusIcon(q.status)} {q.status}
              </span>
              <span className="inline-block text-xs px-1.5 py-0.5 rounded mr-2 bg-depth text-content-secondary border border-border-subtle">
                {q.domain}
              </span>
              <span className="text-content-primary">
                {q.content?.substring(0, 60)}
                {q.content?.length > 60 ? "..." : ""}
              </span>
              <div className="text-content-muted text-xs mt-1">
                Created: {formatTime(q.created_at)}
              </div>
            </summary>
            <div className="px-3 pb-3 space-y-3">
              <pre className="text-content-primary text-sm whitespace-pre-wrap bg-depth p-3 rounded-md">
                {q.content}
              </pre>
              {q.notes && parseJsonArray(q.notes).length > 0 && (
                <div className="text-xs">
                  <span className="text-accent font-medium block mb-1">
                    Notes & Observations:
                  </span>
                  <ul className="list-disc ml-5 space-y-1">
                    {parseJsonArray(q.notes).map((note, i) => (
                      <li key={i} className="text-content-secondary">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {q.resolved_into && (
                <div className="text-xs mt-2">
                  <span className="text-success font-medium">
                    Resolved into:
                  </span>
                  <span className="text-content-primary ml-2">
                    {q.resolved_into}
                  </span>
                </div>
              )}
            </div>
          </details>
        ))}
        {questions.length === 0 && (
          <div className="p-3 text-content-muted italic">
            No open questions yet
          </div>
        )}
      </div>
    </SectionCard>
  );
}
