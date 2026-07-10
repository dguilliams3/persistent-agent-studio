/**
 * Server-side Authentication Utilities
 *
 * Provides secure credential validation, rate limiting, and authentication helpers.
 * Credentials are stored securely via environment variables (wrangler secrets).
 *
 * @module auth
 * @upstream Called by: routes/auth.js
 * @downstream Calls: D1 database for rate limiting
 */

import { getState, setState } from '../db/index.js';
import type { Env } from '../bootstrap.js';

/**
 * Get client IP address from request
 *
 * Handles Cloudflare-specific headers for IP detection
 *
 * @param {Request} request - HTTP request object
 * @returns {string} Client IP address
 *
 * @upstream Called by: rate limiting functions, auth routes
 * @downstream None
 */
export function getClientIP(request: Request): string {
  // Cloudflare headers (in order of preference)
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

/**
 * Secure constant-time string comparison
 *
 * Prevents timing attacks by comparing strings in constant time
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 *
 * @upstream Called by: validateCredentials()
 * @downstream None
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate user credentials
 *
 * Compares provided credentials against securely stored values.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {string} username - Provided username
 * @param {string} password - Provided password
 * @param {Object} env - Cloudflare Worker environment variables
 * @returns {boolean} True if credentials are valid
 *
 * @upstream Called by: auth.js login endpoint
 * @downstream Calls: secureCompare()
 */
export function validateCredentials(username: string, password: string, env: Env): boolean {
  const expectedUsername = env.ADMIN_USERNAME;
  const expectedPassword = env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    console.error('Authentication error: ADMIN_USERNAME or ADMIN_PASSWORD not configured');
    return false;
  }

  return secureCompare(username, expectedUsername as string) && secureCompare(password, expectedPassword as string);
}

/**
 * Check if IP is rate limited for authentication attempts
 *
 * Implements rate limiting: maximum 5 failed attempts per IP per hour
 * Can be disabled via AUTH_RATE_LIMITING_DISABLED environment variable
 *
 * @param {any} db - D1 database instance
 * @param {string} ip - Client IP address
 * @param {Object} env - Cloudflare Worker environment variables
 * @returns {Promise<boolean>} True if rate limited (should block)
 *
 * @upstream Called by: auth.js login endpoint
 * @downstream Calls: getState(), setState()
 */
export async function isRateLimited(db: D1Database, ip: string, env: Env): Promise<boolean> {
  // Allow disabling rate limiting via environment variable
  if (env.AUTH_RATE_LIMITING_DISABLED === 'true') {
    return false;
  }
  const key = `auth_attempts_${ip}`;
  const windowKey = `auth_window_${ip}`;

  try {
    const attempts = parseInt(await getState(db, key) as string) || 0;
    const windowStart = parseInt(await getState(db, windowKey) as string) || 0;

    const now = Date.now();
    const hourMs = 60 * 60 * 1000; // 1 hour

    // Reset window if it's been more than an hour
    if (now - windowStart > hourMs) {
      await setState(db, key, '0');
      await setState(db, windowKey, now.toString());
      return false;
    }

    // Check if over limit
    return attempts >= 5;
  } catch (error) {
    console.error('Rate limiting error:', (error as Error).message);
    // Allow request on error to avoid blocking legitimate users
    return false;
  }
}

/**
 * Record a failed authentication attempt
 *
 * Increments the attempt counter for rate limiting
 *
 * @param {any} db - D1 database instance
 * @param {string} ip - Client IP address
 * @returns {Promise<void>}
 *
 * @upstream Called by: auth.js login endpoint on failure
 * @downstream Calls: getState(), setState()
 */
export async function recordFailedAttempt(db: D1Database, ip: string): Promise<void> {
  const key = `auth_attempts_${ip}`;
  const windowKey = `auth_window_${ip}`;

  try {
    const attempts = parseInt(await getState(db, key) as string) || 0;
    const now = Date.now();

    await setState(db, key, (attempts + 1).toString());

    // Set window start if not set
    const windowStart = await getState(db, windowKey);
    if (!windowStart) {
      await setState(db, windowKey, now.toString());
    }
  } catch (error) {
    console.error('Failed to record auth attempt:', (error as Error).message);
  }
}

/**
 * Clear rate limiting data for successful login
 *
 * Resets the attempt counter when authentication succeeds
 *
 * @param {any} db - D1 database instance
 * @param {string} ip - Client IP address
 * @returns {Promise<void>}
 *
 * @upstream Called by: auth.js login endpoint on success
 * @downstream Calls: setState()
 */
export async function clearRateLimit(db: D1Database, ip: string): Promise<void> {
  const key = `auth_attempts_${ip}`;
  const windowKey = `auth_window_${ip}`;

  try {
    await setState(db, key, '0');
    await setState(db, windowKey, '0');
  } catch (error) {
    console.error('Failed to clear rate limit:', (error as Error).message);
  }
}

/**
 * Create rate limit response
 *
 * @param {string} ip - Client IP address
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} HTTP response with rate limit error
 *
 * @upstream Called by: auth.js when rate limited
 * @downstream None
 */
export function createRateLimitResponse(ip: string, corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many failed login attempts',
      message: 'Please try again later',
      retryAfter: 3600 // 1 hour in seconds
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '3600',
        'X-Rate-Limit-IP': ip,
        ...corsHeaders
      }
    }
  );
}

/**
 * Create authentication error response
 *
 * @param {string} message - Error message
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} HTTP response with auth error
 *
 * @upstream Called by: auth.js on auth failures
 * @downstream None
 */
export function createAuthErrorResponse(message = 'Invalid credentials', corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Authentication failed',
      message: message
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer',
        ...corsHeaders
      }
    }
  );
}

/**
 * Create success response with JWT token
 *
 * @param {string} token - JWT token
 * @param {Object} user - User information (without sensitive data)
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} HTTP response with token
 *
 * @upstream Called by: auth.js on successful login
 * @downstream None
 */
export function createAuthSuccessResponse(token: string, user: Record<string, string> = { username: 'admin' }, corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      token: token,
      user: user,
      message: 'Login successful'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

/**
 * Create logout success response
 *
 * @param {Object} corsHeaders - CORS headers to include
 * @returns {Response} HTTP response confirming logout
 *
 * @upstream Called by: auth.js logout endpoint
 * @downstream None
 */
export function createLogoutResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      message: 'Logout successful'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}
