/**
 * @module ui
 * @description Barrel export for UI primitive components.
 *
 * This module exports reusable UI components that form the foundation of the application's
 * design system. These components replace native browser elements with styled, accessible,
 * and animated alternatives.
 *
 * @upstream Called by: All tab components, layout components, ClaudeExistenceLoop
 * @downstream Calls: Individual component modules
 * @pattern Barrel export — single import point for all UI primitives
 *
 * Primitives (no domain logic):
 * - Button: Styled button with variant/size support
 * - Card: Container with optional severity border
 * - Badge: Status/severity pill label
 * - Input: Text input with label and error state
 * - Modal: Overlay dialog with close handler
 * - Spinner: Loading indicator
 * - Icon: Lucide icon wrapper
 * - Select: Custom dropdown
 * - Textarea: Multiline text input
 * - Toggle: On/off switch
 * - Accordion: Animated disclosure
 *
 * Composed components (domain-aware):
 * - HistoryEntryRow, EntryContent, EntryMetadata, EntryActions
 * - BlurReveal, MetersDisplay, MeterPills, MessageInput, TypeFilterDropdown
 *
 * Visual/atmospheric:
 * - GradientMesh, BreathingDots (via visual/ submodule)
 *
 * Charts are intentionally NOT re-exported here. Plotly.js is multi-megabyte,
 * and a barrel re-export put it in every importer's chunk — chat-only visitors
 * paid for SIM charting (RUN-20260731-1953). Import charts from './charts'
 * directly: import { TimeSeriesChart } from '../ui/charts';
 *
 * @example
 * import { Button, Card, Badge, Icon, Spinner } from '../components/ui';
 */

// Design system primitives
export { Button } from './Button';
export { Card } from './Card';
export { Badge } from './Badge';
export { Input } from './Input';
export { Modal } from './Modal';
export { Spinner } from './Spinner';
export { LoadingSkeleton } from './LoadingSkeleton';
export { Icon } from './Icon';
export { Select } from './Select';
export { Accordion } from './Accordion';
export { Textarea } from './Textarea';
export { Toggle } from './Toggle';
export { HistoryEntryRow } from './HistoryEntryRow';
export { BlurReveal } from './BlurReveal';
export { EntryMetadata } from './EntryMetadata';
export { EntryContent } from './EntryContent';
export { VoicePlayback, SelectionCheckbox, PoleIndicator } from './EntryActions';
export { MetersDisplay } from './MetersDisplay';
export { MeterPills } from './MeterPills';
export { MessageInput } from './MessageInput';
export { TypeFilterDropdown } from './TypeFilterDropdown';

// Chart components live in their own submodule and are NOT re-exported:
// import { TimeSeriesChart } from '../ui/charts';  (see docstring above)

// Visual/atmospheric components
export * from './visual';
