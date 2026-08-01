/**
 * @module PersonaSelectorItem
 * @description Shape of a persona item passed to the PersonaSelector component.
 * Extracted as a shared contract — consumers must map their persona data to this shape.
 *
 * Anti-pattern: Do NOT add platform-specific fields here.
 *   This type is the minimal contract for display purposes only.
 *
 * @upstream Consumed by: PersonaSelector component, apps/web wrapper
 */

/** Minimal persona shape required by the PersonaSelector for display and selection */
export interface PersonaSelectorItem {
  id: number;
  name: string;
}
