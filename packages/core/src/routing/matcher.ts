/**
 * URL pattern matching — pure path comparison functions.
 *
 * @module routing/matcher
 * @description Matches request paths against route patterns and extracts
 * path parameters. Supports exact paths and parameterized segments
 * (`:id`, `:name`). All functions are pure with no side effects.
 *
 * @upstream Called by: route-index.ts (findRoute)
 * @downstream Calls: None
 */

/**
 * Strip trailing slash from a path, preserving root "/".
 *
 * @param path - URL path (e.g., '/history/' or '/')
 * @returns Normalized path (e.g., '/history' or '/')
 */
export function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

/**
 * Safely decode a URI component, returning null on malformed encoding.
 *
 * Malformed percent-encoding (e.g., `%E0%A4%A`) causes decodeURIComponent
 * to throw URIError. This wrapper treats invalid encoding as a non-match
 * rather than crashing the dispatch loop.
 *
 * @param segment - URL path segment to decode
 * @returns Decoded string, or null if encoding is malformed
 */
function safeDecodeURIComponent(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Match a request path against a route pattern, extracting path parameters.
 *
 * Parameters are denoted with `:` prefix (e.g., `:id`, `:name`).
 * Returns extracted params on match, null on mismatch. Malformed
 * percent-encoding in path segments is treated as a non-match.
 *
 * @param pattern - Route pattern (e.g., '/branches/:name/activate')
 * @param requestPath - Actual request path (e.g., '/branches/main/activate')
 * @returns Extracted params object, or null if no match
 */
export function matchPath(
  pattern: string,
  requestPath: string,
): Record<string, string> | null {
  if (!pattern.includes(':')) {
    return pattern === requestPath ? {} : null;
  }

  const patternParts = pattern.split('/');
  const pathParts = requestPath.split('/');

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let segmentIndex = 0; segmentIndex < patternParts.length; segmentIndex++) {
    const patternSegment = patternParts[segmentIndex];
    const pathSegment = pathParts[segmentIndex];

    if (patternSegment.startsWith(':')) {
      const decoded = safeDecodeURIComponent(pathSegment);
      if (decoded === null) {
        return null;
      }
      const paramName = patternSegment.slice(1);
      params[paramName] = decoded;
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}
