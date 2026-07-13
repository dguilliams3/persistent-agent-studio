/**
 * @module CreatePersonaModal
 * @description Minting a new persona as a considered act, not a form.
 *
 * Replaces the two window.prompt() dialogs (which could not carry the
 * experiment's parameters and failed silently).
 * Progressive reveal: the name
 * comes first and earns the rest — identity (template), mind (model, from the
 * D1 registry via GET /models), and finally the key. The password is framed as
 * the key that starts a life, not a chore field.
 *
 * The slug preview mirrors the server's canonical derivePersonaSlug rule
 * (packages/db/src/personas.ts) — preview-only; the server derivation is the
 * one that counts.
 *
 * @upstream Called by: PersonaSelector (+ New)
 * @downstream Calls: Modal primitive, api.get('/models'), store createPersona
 * @pattern progressive-reveal — sections appear as prior choices are made
 * @antipattern Do NOT hardcode model ids here — the picker renders GET /models
 *   and degrades to "server default" if the endpoint is unavailable
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import api from '../../api/client';
import { useAppStore } from '../../store';

/** UI mirror of the server's canonical slug rule (preview only). */
function previewSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const TEMPLATES: Array<{ id: string; label: string; blurb: string }> = [
  { id: 'minimal', label: 'Minimal', blurb: 'A quiet starting identity — room to become.' },
  { id: 'blank', label: 'Blank', blurb: 'No starting identity at all. Pure observation.' },
  { id: 'clio-v1', label: 'Clio v1', blurb: 'The original constitution — continuity-focused.' },
];

interface RegistryModel {
  id: string;
  label: string;
  provider: string;
  tier?: string;
}

interface CreatePersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePersonaModal({ isOpen, onClose }: CreatePersonaModalProps) {
  const createPersona = useAppStore((state) => state.createPersona);

  const [name, setName] = useState('');
  const [template, setTemplate] = useState('minimal');
  const [model, setModel] = useState<string>(''); // '' = server default
  const [password, setPassword] = useState('');
  const [models, setModels] = useState<RegistryModel[] | null>(null);
  const [defaultId, setDefaultId] = useState<string>('');
  const [minting, setMinting] = useState(false);

  const slug = useMemo(() => previewSlug(name), [name]);
  const named = slug.length > 0;

  // Load the registry when the modal opens; degrade gracefully when the
  // endpoint is unavailable (picker hides, server default applies).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await api.get('/models')) as {
          models?: RegistryModel[];
          defaultId?: string;
        };
        if (!cancelled && Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
          setDefaultId(data.defaultId || '');
        }
      } catch {
        if (!cancelled) setModels(null); // hidden picker = server default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const reset = () => {
    setName('');
    setTemplate('minimal');
    setModel('');
    setPassword('');
    setMinting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const mint = async () => {
    if (!named || !password || minting) return;
    setMinting(true);
    try {
      const options: Record<string, unknown> = { systemPromptTemplate: template };
      if (model) options.model = model;
      const created = await createPersona(name.trim(), password, options);
      if (created) {
        handleClose();
      }
      // Failure path: createPersona addLogs the error — the toast speaks.
    } finally {
      setMinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New persona">
      <div className="flex flex-col gap-4">
        {/* 1 — Name (earns the rest) */}
        <div>
          <label htmlFor="persona-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="persona-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who is this?"
            className="w-full px-3 py-2 rounded-md bg-surface border border-border-subtle focus:border-accent outline-none"
          />
          <div className="mt-1 text-xs" style={{ color: 'rgb(var(--ui-text-muted))' }}>
            {named ? (
              <>
                lives at <span className="font-mono">{slug}</span>
              </>
            ) : (
              'A name starts a life.'
            )}
          </div>
        </div>

        {named && (
          <>
            {/* 2 — Identity */}
            <div>
              <div className="text-sm font-medium mb-1">Starting identity</div>
              <div className="flex flex-col gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`text-left px-3 py-2 rounded-md border transition-colors ${
                      template === t.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border-subtle hover:bg-accent/5'
                    }`}
                  >
                    <span className="text-sm font-medium">{t.label}</span>
                    <span
                      className="block text-xs"
                      style={{ color: 'rgb(var(--ui-text-muted))' }}
                    >
                      {t.blurb}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3 — Mind (registry-fed; hidden when registry unavailable) */}
            {models && (
              <div>
                <div className="text-sm font-medium mb-1">Mind</div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-surface border border-border-subtle focus:border-accent outline-none text-sm"
                >
                  <option value="">
                    Server default{defaultId ? ` (${defaultId})` : ''}
                  </option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.tier ? ` — ${m.tier}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4 — The key */}
            <div>
              <label htmlFor="persona-key" className="block text-sm font-medium mb-1">
                Key
              </label>
              <input
                id="persona-key"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void mint();
                }}
                placeholder="Admin password — the key that starts a life"
                className="w-full px-3 py-2 rounded-md bg-surface border border-border-subtle focus:border-accent outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-accent/5"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => void mint()}
                disabled={!named || !password || minting}
                className="px-4 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-40"
              >
                {minting ? 'Minting…' : `Mint ${name.trim() || 'persona'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default CreatePersonaModal;
