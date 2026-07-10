import type { StaticImage } from './StaticImage';

/**
 * AI-generated art image — a static image created by an AI model.
 *
 * Intrinsic to what the artifact IS: the prompt, model, and decay window are
 * properties of the art itself, not of the client that requested it.
 *
 * @downstream apps/web — art gallery, prompt display panels, freshness/decay UI
 * @downstream packages/services — art tool handler that creates and stores ArtImage values
 * @upstream packages/media/src/image/static/StaticImage — ArtImage extends StaticImage
 * @pattern domain-ownership — generation metadata (prompt, model, provider) belongs on the type itself
 * @antipattern DO NOT create new "generated image" types — extend or compose this one.
 *   Import from @persistence/media for gallery views, prompt display, freshness checks.
 * @tested_by packages/media/__tests__/image.test.ts
 * @invariant prompt and generationModel must be non-empty; decayWindowHours, if present, must be positive
 */
export interface ArtImage extends StaticImage {
  /** The prompt used to generate this art */
  prompt: string;
  /** Model used for generation */
  generationModel: string;
  /** Provider (e.g., 'anthropic', 'openai') */
  generationProvider: string;
  /** Decay window — time in hours before art becomes less prominent */
  decayWindowHours?: number;
  /** Whether art is currently within its fresh window */
  isFresh?: boolean;
}
