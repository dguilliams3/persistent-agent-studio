/**
 * Authentication Routes
 *
 * Provides secure login, logout, and token verification endpoints.
 * Uses JWT tokens with server-side validation and rate limiting.
 *
 * @module routes/auth
 * @upstream Called by: index.js handleRequest() for /auth/* routes
 * @downstream Calls: jwt.js, auth.js utilities
 */

import { generateToken, verifyToken, extractToken } from '../utils/jwt.js';
import type { Env } from '../bootstrap.js';
import {
  validateCredentials,
  isRateLimited,
  recordFailedAttempt,
  clearRateLimit,
  createRateLimitResponse,
  createAuthErrorResponse,
  createAuthSuccessResponse,
  createLogoutResponse,
  getClientIP
} from '../utils/auth.js';

type AuthBody = {
  username?: string;
  password?: string;
};

/**
 * @description POST /auth/login - Authenticates user and returns JWT token
 *
 * Validates credentials, implements rate limiting, and returns JWT token on success.
 * Rate limiting: 5 failed attempts per IP per hour.
 *
 * @param {D1Database} db - Database instance
 * @param {Object} body - Request body with username and password
 * @param {string} body.username - Username for authentication
 * @param {string} body.password - Password for authentication
 * @param {Request} request - HTTP request object (for IP detection)
 * @returns {Promise<Response>} Authentication response or error
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: validateCredentials(), isRateLimited(), generateToken()
 */
export async function handleAuthLogin(db: D1Database, body: AuthBody, request: Request, corsHeaders: HeadersInit = {}, env: Env) {
  const responseHeaders = corsHeaders as Record<string, string>;
  const jwtSecret = env.JWT_SECRET as string;
  const { username, password } = body;
  const ip = getClientIP(request);

  // Validate input
  if (!username || !password) {
    return createAuthErrorResponse('Username and password are required', responseHeaders);
  }

  // Check rate limiting
  if (await isRateLimited(db, ip, env)) {
    return createRateLimitResponse(ip, responseHeaders);
  }

  // Validate credentials
  if (!validateCredentials(username, password, env)) {
    await recordFailedAttempt(db, ip);
    return createAuthErrorResponse('Invalid username or password', responseHeaders);
  }

  // Success - clear rate limiting and generate token
  await clearRateLimit(db, ip);

  try {
    const token = await generateToken(
      { sub: username, jti: crypto.randomUUID() },
      jwtSecret
    );

    return createAuthSuccessResponse(token, undefined, responseHeaders);
  } catch (error: unknown) {
    console.error('Token generation error:', error instanceof Error ? error.message : String(error));
    return createAuthErrorResponse('Authentication failed', responseHeaders);
  }
}

/**
 * @description POST /auth/verify - Verifies JWT token validity
 *
 * Validates a JWT token and returns user information if valid.
 * Used by frontend to check authentication status.
 *
 * @param {D1Database} db - Database instance
 * @param {Object} body - Request body (unused, token from header)
 * @param {Request} request - HTTP request object (for token extraction)
 * @returns {Promise<Response>} Token verification response
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: extractToken(), verifyToken()
 */
export async function handleAuthVerify(db: D1Database, body: unknown, request: Request, corsHeaders: HeadersInit = {}, env: Env) {
  const jwtSecret = env.JWT_SECRET as string;
  const token = extractToken(request);

  if (!token) {
    return new Response(
      JSON.stringify({ valid: false, error: 'No token provided' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  const payload = await verifyToken(token, jwtSecret);

  if (!payload) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid or expired token' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  return new Response(
    JSON.stringify({
      valid: true,
      user: { username: payload.sub },
      expires: payload.exp
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}

/**
 * @description POST /auth/logout - Invalidates the current session
 *
 * Logs out the user by clearing client-side token storage.
 * Note: Since JWTs are stateless, server-side invalidation would require
 * a token blacklist, which is not implemented for simplicity.
 *
 * @param {D1Database} db - Database instance
 * @param {Object} body - Request body (unused)
 * @param {Request} request - HTTP request object
 * @returns {Promise<Response>} Logout confirmation response
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: createLogoutResponse()
 */
export async function handleAuthLogout(db: D1Database, body: unknown, request: Request, corsHeaders: HeadersInit = {}, _env: Env) {
  // In a stateless JWT system, logout is primarily client-side
  // For enhanced security, you could implement token blacklisting here
  // by storing invalidated token IDs in the database

  return createLogoutResponse(corsHeaders as Record<string, string>);
}

/**
 * @description GET /auth/status - Returns current authentication status
 *
 * Provides authentication status without requiring credentials.
 * Useful for checking if a user is logged in.
 *
 * @param {D1Database} db - Database instance
 * @param {Request} request - HTTP request object (for token extraction)
 * @returns {Promise<Response>} Authentication status response
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: extractToken(), verifyToken()
 */
export async function handleAuthStatus(db: D1Database, request: Request, corsHeaders: HeadersInit = {}, env: Env) {
  const jwtSecret = env.JWT_SECRET as string;
  const token = extractToken(request);

  if (!token) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: 'No authentication token provided'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  const payload = await verifyToken(token, jwtSecret);

  if (!payload) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: 'Invalid or expired token'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: { username: payload.sub },
      expires: payload.exp
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}
