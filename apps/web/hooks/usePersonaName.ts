/**
 * Persona naming hooks — the persona names itself
 *
 * @module hooks/usePersonaName
 * @description Single source of truth for the persona's *display* name in the
 * UI. The README's reference persona is only ever an example: whoever deploys
 * this brings their own persona, and nothing in the chrome may assume
 * otherwise.
 *
 * The name the app actually knows at runtime is `activePersona.name`, hydrated
 * from `GET /personas/active` (and `GET /personas`) into the data slice by
 * `fetchPersonas` / `fetchActivePersona`. Demo mode serves the same shape from
 * the specimen fixture, which legitimately names its own specimen — so the
 * demo shows that name because the DATA says so, not because a string literal
 * does.
 *
 * Fallback: `DEFAULT_PERSONA_NAME` ("Persona"), the persona-side analogue of
 * the worker's `human_name` default of "User"
 * (platforms/cloudflare/src/prompts/build-system-prompt.ts). Pre-auth and
 * pre-hydration there is genuinely no name to show, and a generic noun is the
 * honest answer.
 *
 * @upstream Called by: AppShell, ChatView, LoginForm, TTSConfig,
 *   MemoryEditTools, SyntheticMemory, App (document title)
 * @downstream Calls: store (activePersona, read-only)
 *
 * Tested by: `apps/web/hooks/__tests__/usePersonaName.test.tsx` and
 * `apps/web/__tests__/no-hardcoded-persona-name.test.ts`
 */

import { useEffect } from 'react';
import { useAppStore } from '../store';

/**
 * Generic stand-in used wherever the persona's real name is not known yet
 * (pre-auth, pre-hydration, or a deployment with no personas configured).
 * Mirrors the worker's `human_name` default of "User" on the human side.
 */
export const DEFAULT_PERSONA_NAME = 'Persona';

/** Product name of the observatory itself — persona-independent. */
export const APP_TITLE = 'Persistent Agent Studio';

/**
 * @description The active persona's name, or `null` when it is not known yet.
 *
 * Use this when the surface should stay neutral rather than print a generic
 * placeholder (e.g. the document title, the pre-auth login card).
 *
 * @returns {string|null} Trimmed persona name, or null when unhydrated
 */
export function usePersonaNameOrNull(): string | null {
  const name = useAppStore(
    (state) => (state.activePersona as { name?: string } | null)?.name,
  ) as string | undefined;
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @description The active persona's name for user-visible copy, with the
 * generic fallback applied.
 *
 * @returns {string} Persona name, or DEFAULT_PERSONA_NAME when unknown
 */
export function usePersonaName(): string {
  return usePersonaNameOrNull() ?? DEFAULT_PERSONA_NAME;
}

/**
 * @description Compose the document title from a (possibly unknown) name.
 *
 * Exported for tests: the branch that matters is "no name yet" → the neutral
 * observatory title, never someone else's persona in the tab strip.
 *
 * @param {string|null} personaName - Resolved persona name, or null
 * @returns {string} Title for `document.title`
 */
export function personaDocumentTitle(personaName: string | null): string {
  return personaName ? `${personaName} - ${APP_TITLE}` : APP_TITLE;
}

/**
 * @description Keep `document.title` in sync with the active persona.
 *
 * index.html ships the neutral title so a stranger's first paint is never
 * branded with the reference persona; this hook upgrades it once the app
 * knows who lives here.
 *
 * @upstream Called by: App (root, always mounted)
 */
export function usePersonaDocumentTitle(): void {
  const personaName = usePersonaNameOrNull();
  useEffect(() => {
    document.title = personaDocumentTitle(personaName);
  }, [personaName]);
}
