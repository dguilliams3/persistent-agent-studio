/**
 * Tests for SecretNotFoundError type
 *
 * @module @persistence/core/secrets/__tests__/types.test
 * @description Validates error class behavior and interface contracts
 *
 * @covers SecretNotFoundError - Error thrown when required secrets are missing
 */

import { describe, it, expect } from 'vitest';
import { SecretNotFoundError } from '../types.js';

describe('SecretNotFoundError', () => {
  it('creates error with correct message format', () => {
    const key = 'MY_API_KEY';
    const error = new SecretNotFoundError(key);

    expect(error.message).toBe(`Secret not found: ${key}`);
  });

  it('sets correct error name', () => {
    const error = new SecretNotFoundError('TEST_KEY');
    expect(error.name).toBe('SecretNotFoundError');
  });

  it('is instance of Error', () => {
    const error = new SecretNotFoundError('KEY');
    expect(error).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const error = new SecretNotFoundError('STACK_TEST');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('SecretNotFoundError');
  });

  it('works with various key formats', () => {
    const keys = [
      'SIMPLE_KEY',
      'key_with_underscores',
      'KeyWithMixedCase',
      'KEY-WITH-DASHES',
      'KEY.WITH.DOTS',
      '123_NUMERIC_START',
    ];

    keys.forEach((key) => {
      const error = new SecretNotFoundError(key);
      expect(error.message).toBe(`Secret not found: ${key}`);
    });
  });

  it('can be thrown and caught', () => {
    expect(() => {
      throw new SecretNotFoundError('CATCHABLE_KEY');
    }).toThrow(SecretNotFoundError);
  });

  it('can be caught as generic Error', () => {
    expect(() => {
      throw new SecretNotFoundError('GENERIC_CATCH');
    }).toThrow(Error);
  });

  it('preserves key information for error handling', () => {
    const key = 'CRITICAL_KEY';
    const error = new SecretNotFoundError(key);

    // Extract key from message for downstream error handling
    const extractedKey = error.message.replace('Secret not found: ', '');
    expect(extractedKey).toBe(key);
  });
});
