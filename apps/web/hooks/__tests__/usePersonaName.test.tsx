/**
 * Persona name hook tests — the name comes from the data
 *
 * @module hooks/__tests__/usePersonaName.test
 * @description Executable spec for `usePersonaName` and friends: the persona's
 * display name is read from the active persona record the worker serves
 * (`GET /personas/active` → data slice `activePersona`), falls back to a
 * generic noun when nothing is hydrated, and drives `document.title`.
 *
 * The wiring case matters as much as the unit cases: it proves a real surface
 * (the TTS "Set for …" button) renders whatever name the DATA carries, which
 * is why the demo can still say the specimen's name without any literal in the
 * component.
 *
 * Targets: `apps/web/hooks/usePersonaName.ts`,
 *   `apps/web/components/tabs/VoiceTab/components/TTSConfig.tsx`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { useAppStore } from '../../store';
import {
  DEFAULT_PERSONA_NAME,
  APP_TITLE,
  usePersonaName,
  usePersonaNameOrNull,
  usePersonaDocumentTitle,
} from '../usePersonaName';
import TTSConfig from '../../components/tabs/VoiceTab/components/TTSConfig';

/** Put a persona record on the store the way fetchActivePersona would. */
function setActivePersona(name: string | null): void {
  useAppStore.setState({
    activePersona: name === null ? null : { id: 1, name },
  });
}

beforeEach(() => {
  setActivePersona(null);
  document.title = APP_TITLE;
});

describe('usePersonaName', () => {
  it('returns the active persona name from the store', () => {
    setActivePersona('Ada');
    const { result } = renderHook(() => usePersonaName());
    expect(result.current).toBe('Ada');
  });

  it('falls back to the generic noun when no persona is hydrated', () => {
    const { result } = renderHook(() => usePersonaName());
    expect(result.current).toBe(DEFAULT_PERSONA_NAME);
  });

  it('treats a blank name as unknown rather than printing whitespace', () => {
    setActivePersona('   ');
    const { result } = renderHook(() => usePersonaNameOrNull());
    expect(result.current).toBeNull();
  });
});

describe('usePersonaDocumentTitle', () => {
  it('leaves the neutral title alone until a persona is known', () => {
    renderHook(() => usePersonaDocumentTitle());
    expect(document.title).toBe(APP_TITLE);
  });

  it('names the persona once the record hydrates', () => {
    setActivePersona('Ada');
    renderHook(() => usePersonaDocumentTitle());
    expect(document.title).toBe(`Ada - ${APP_TITLE}`);
  });
});

describe('a real surface reads the name from persona data', () => {
  const props = {
    model: 'v2',
    onModelChange: () => {},
    stability: 0.5,
    onStabilityChange: () => {},
    speed: 1.0,
    onSpeedChange: () => {},
    saving: false,
    saveSuccess: false,
    onSave: () => {},
  };

  it('labels the TTS save button with whatever name the store carries', () => {
    setActivePersona('Ada');
    render(<TTSConfig {...props} />);
    expect(screen.getByText(/Set for Ada/)).toBeTruthy();
    expect(screen.getByText(/Persists model for Ada/)).toBeTruthy();
  });

  it('degrades to the generic noun rather than a borrowed name', () => {
    render(<TTSConfig {...props} />);
    expect(screen.getByText(new RegExp(`Set for ${DEFAULT_PERSONA_NAME}`))).toBeTruthy();
  });
});
