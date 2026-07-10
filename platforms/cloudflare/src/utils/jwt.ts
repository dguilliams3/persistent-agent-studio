/**
 * JWT Token Utilities for Authentication
 *
 * Provides secure token generation and validation for the authentication system.
 * Uses Cloudflare Worker's Web Crypto API for HMAC-SHA256 signing.
 *
 * @module jwt
 * @upstream Called by: routes/auth.js
 * @downstream Calls: Web Crypto API
 */

import { webcrypto } from 'crypto';

interface VerifiedTokenPayload extends Record<string, unknown> {
  exp?: number;
}

/**
 * JWT Header structure
 * @typedef {Object} JWTHeader
 * @property {string} alg - Algorithm (HS256)
 * @property {string} typ - Type (JWT)
 */

/**
 * JWT Payload structure
 * @typedef {Object} JWTPayload
 * @property {string} sub - Subject (user identifier)
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 * @property {string} [jti] - JWT ID for logout tracking
 */

/**
 * Generate HMAC-SHA256 signature for JWT
 *
 * @param {string} data - Data to sign (header.payload)
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} Base64URL-encoded signature
 *
 * @upstream Called by: generateToken()
 * @downstream Calls: Web Crypto API
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await webcrypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Verify HMAC-SHA256 signature for JWT
 *
 * @param {string} data - Data to verify (header.payload)
 * @param {string} signature - Base64URL-encoded signature to verify
 * @param {string} secret - Secret key used for signing
 * @returns {Promise<boolean>} True if signature is valid
 *
 * @upstream Called by: verifyToken()
 * @downstream Calls: Web Crypto API
 */
async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return await webcrypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
}

/**
 * Base64URL encode a string
 *
 * @param {string} str - String to encode
 * @returns {string} Base64URL-encoded string
 *
 * @upstream Called by: generateToken()
 * @downstream None
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode a string
 *
 * @param {string} str - Base64URL-encoded string
 * @returns {string} Decoded string
 *
 * @upstream Called by: verifyToken()
 * @downstream None
 */
function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4);
  return atob(padded);
}

/**
 * Generate a JWT token
 *
 * @param {Object} payload - JWT payload data
 * @param {string} payload.sub - Subject (user identifier)
 * @param {number} [payload.exp] - Expiration timestamp (defaults to 24 hours)
 * @param {string} [payload.jti] - JWT ID for logout tracking
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} Complete JWT token
 *
 * @upstream Called by: auth.js login endpoint
 * @downstream Calls: sign(), base64UrlEncode()
 */
export async function generateToken(payload: { sub: string; exp?: number; jti?: string; [key: string]: unknown }, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Set default expiration (24 hours from now)
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: payload.exp || (now + 24 * 60 * 60) // 24 hours
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(data, secret);

  return `${data}.${signature}`;
}

/**
 * Verify and decode a JWT token
 *
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key used for signing
 * @returns {Promise<Object|null>} Decoded payload if valid, null if invalid
 *
 * @upstream Called by: auth.js verify endpoint, protected routes
 * @downstream Calls: verify(), base64UrlDecode()
 */
export async function verifyToken(token: string, secret: string): Promise<VerifiedTokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const isValid = await verify(data, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as VerifiedTokenPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('JWT verification error:', message);
    return null;
  }
}

/**
 * Extract token from Authorization header
 *
 * @param {Request} request - HTTP request object
 * @returns {string|null} JWT token if present, null otherwise
 *
 * @upstream Called by: auth middleware, protected routes
 * @downstream None
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}



