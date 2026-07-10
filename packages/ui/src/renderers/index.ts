/**
 * @module packages/ui/renderers
 * @description Barrel export for domain renderer components.
 * Each renderer accepts @persistence/* types and returns JSX.
 *
 * @antipattern Do NOT add generic UI primitives here (Button, Card, etc.).
 *   This is for domain-specific renderers only.
 *
 * @upstream Consumed by: apps/web views
 * @downstream Re-exports from: individual renderer modules
 */

export { ChatBubble } from './ChatBubble.js';
export type { ChatBubbleProps } from './ChatBubble.js';

export { ChatBubbleView } from './ChatBubbleView.js';
export type { ChatBubbleViewProps } from './ChatBubbleView.js';

export { ExpandedThinking } from './ExpandedThinking.js';
export type { ExpandedThinkingProps, ToolCall } from './ExpandedThinking.js';

export { MeterPills } from './MeterPills.js';
export type { MeterPillsProps } from './MeterPills.js';
