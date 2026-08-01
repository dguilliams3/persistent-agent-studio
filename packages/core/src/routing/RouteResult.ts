/**
 * Route result — the standardized output every route handler returns.
 *
 * @module routing/RouteResult
 * @description What a handler gives back to the dispatcher, which then
 * translates it into an HTTP Response. Handlers return data, not Responses —
 * the dispatcher owns the HTTP translation.
 *
 * @upstream Returned by: route handler functions registered in RouteMap
 * @downstream Consumed by: dispatcher.ts (wraps into HTTP Response via JSON.stringify)
 *
 * @pattern parse-call-format — handlers parse HTTP inputs, call a domain
 * function, then return a RouteResult. They do NOT construct Response objects.
 * Separating result shape from HTTP serialization keeps handlers testable
 * without a real HTTP stack.
 *
 * @antipattern Handlers should NOT construct Response objects directly.
 * Return a RouteResult and let the dispatcher handle serialization, status
 * codes, and header injection (CORS, cache, etc.). The exception is
 * HandlerReturn — use a raw Response only for non-JSON payloads
 * (binary, HTML, streaming).
 *
 * @example
 * // Typical handler return
 * async function getPersona(context: AppContext): Promise<RouteResult> {
 *   const persona = await fetchPersona(context.db, context.params.id);
 *   if (!persona) return { status: 404, data: { error: 'not found' } };
 *   return { data: persona };
 * }
 */

/**
 * Standardized handler return value.
 *
 * @description The dispatcher converts this into an HTTP Response:
 * - `data` is JSON.stringify'd as the response body
 * - `status` becomes the HTTP status code (default: 200)
 * - `headers` are merged with platform-level headers (CORS, cache)
 */
export interface RouteResult {
  /** HTTP status code. Defaults to 200 if omitted. */
  status?: number;

  /** Response payload — will be JSON-serialized by the dispatcher. */
  data: unknown;

  /** Additional response headers to merge with platform defaults. */
  headers?: Record<string, string>;
}

/**
 * A raw Response that bypasses RouteResult serialization.
 *
 * @description Some handlers need to return non-JSON responses (binary audio,
 * HTML, streaming). They can return a Response directly and the dispatcher
 * will pass it through without wrapping.
 *
 * @example
 * // Handler returning a binary audio response
 * async function getAudioClip(context: AppContext): Promise<HandlerReturn> {
 *   const audioBuffer = await fetchAudioBuffer(context.params.id);
 *   return new Response(audioBuffer, {
 *     headers: { 'Content-Type': 'audio/mpeg' },
 *   });
 * }
 */
export type HandlerReturn = RouteResult | Response;
