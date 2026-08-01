/**
 * @module @persistence/core/__tests__/constants.test
 * @description Unit tests for shared constants
 *
 * Tests cover:
 * - MODEL_PRICING - structure and values
 * - CACHE_PRICING - multipliers and discounts
 * - CACHE_TTL - timing values
 * - API limits - image, telegram, token limits
 * - HISTORY_TYPES and HISTORY_ICONS - mapping consistency
 * - ACTION_TYPES and ACTION_CATEGORIES - mapping consistency
 *
 * @covers ../constants.ts
 */

import { describe, it, expect } from 'vitest';
import {
  MODEL_PRICING,
  CACHE_PRICING,
  CACHE_TTL,
  CACHE_SAFETY_MARGIN,
  CACHE_THRESHOLD_SECONDS,
  SHORT_TTL_THRESHOLD,
  CLAUDE_IMAGE_LIMITS,
  IMAGE_COMPRESSION,
  TELEGRAM_MAX_LENGTH,
  DEFAULT_MAX_OUTPUT_TOKENS,
  WEB_SEARCH_MAX_TOKENS,
  DEFAULT_CYCLE_INTERVAL,
  MAX_SLEEP_SECONDS,
  MAX_REMINDERS,
  MIN_SUMMARY_LENGTH,
  HISTORY_TYPES,
  HISTORY_ICONS,
  ACTION_TYPES,
  ACTION_CATEGORIES,
} from '../constants';

// ============================================================================
// MODEL_PRICING
// ============================================================================

describe('MODEL_PRICING', () => {
  describe('structure', () => {
    it('has pricing for Claude models', () => {
      expect(MODEL_PRICING.opus).toBeDefined();
      expect(MODEL_PRICING.sonnet).toBeDefined();
      expect(MODEL_PRICING.haiku).toBeDefined();
    });

    it('has pricing for OpenAI models', () => {
      expect(MODEL_PRICING['gpt-4.1-mini']).toBeDefined();
      expect(MODEL_PRICING['gpt-5.1']).toBeDefined();
      expect(MODEL_PRICING['gpt-4o']).toBeDefined();
    });

    it('has pricing for local models', () => {
      expect(MODEL_PRICING.local).toBeDefined();
    });

    it('all models have inputPerMillion and outputPerMillion', () => {
      for (const [name, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputPerMillion, `${name} missing inputPerMillion`).toBeDefined();
        expect(pricing.outputPerMillion, `${name} missing outputPerMillion`).toBeDefined();
        expect(typeof pricing.inputPerMillion).toBe('number');
        expect(typeof pricing.outputPerMillion).toBe('number');
      }
    });
  });

  describe('values', () => {
    it('Claude Opus is the most expensive', () => {
      expect(MODEL_PRICING.opus.inputPerMillion).toBeGreaterThan(MODEL_PRICING.sonnet.inputPerMillion);
      expect(MODEL_PRICING.sonnet.inputPerMillion).toBeGreaterThan(MODEL_PRICING.haiku.inputPerMillion);
    });

    it('output costs are higher than input costs', () => {
      expect(MODEL_PRICING.opus.outputPerMillion).toBeGreaterThan(MODEL_PRICING.opus.inputPerMillion);
      expect(MODEL_PRICING.sonnet.outputPerMillion).toBeGreaterThan(MODEL_PRICING.sonnet.inputPerMillion);
      expect(MODEL_PRICING.haiku.outputPerMillion).toBeGreaterThan(MODEL_PRICING.haiku.inputPerMillion);
    });

    it('local models are free', () => {
      expect(MODEL_PRICING.local.inputPerMillion).toBe(0);
      expect(MODEL_PRICING.local.outputPerMillion).toBe(0);
    });

    it('all costs are non-negative', () => {
      for (const pricing of Object.values(MODEL_PRICING)) {
        expect(pricing.inputPerMillion).toBeGreaterThanOrEqual(0);
        expect(pricing.outputPerMillion).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ============================================================================
// CACHE_PRICING
// ============================================================================

describe('CACHE_PRICING', () => {
  it('cache read discount is 90% off (pay 10%)', () => {
    expect(CACHE_PRICING.cacheReadDiscount).toBe(0.1);
  });

  it('5-minute TTL write has 25% premium', () => {
    expect(CACHE_PRICING.cacheWritePremium5m).toBe(1.25);
  });

  it('1-hour TTL write has 100% premium', () => {
    expect(CACHE_PRICING.cacheWritePremium1h).toBe(2.0);
  });

  it('legacy cache write premium matches 5-min', () => {
    expect(CACHE_PRICING.cacheWritePremium).toBe(CACHE_PRICING.cacheWritePremium5m);
  });

  it('batch discount is 50% off', () => {
    expect(CACHE_PRICING.batchDiscount).toBe(0.5);
  });
});

// ============================================================================
// CACHE_TTL & Derived Values
// ============================================================================

describe('CACHE_TTL', () => {
  it('SHORT is 5 minutes', () => {
    expect(CACHE_TTL.SHORT).toBe(300);
  });

  it('LONG is 1 hour', () => {
    expect(CACHE_TTL.LONG).toBe(3600);
  });
});

describe('CACHE_SAFETY_MARGIN', () => {
  it('is 90%', () => {
    expect(CACHE_SAFETY_MARGIN).toBe(0.9);
  });
});

describe('CACHE_THRESHOLD_SECONDS', () => {
  it('is derived from LONG TTL with safety margin', () => {
    expect(CACHE_THRESHOLD_SECONDS).toBe(Math.floor(CACHE_TTL.LONG * CACHE_SAFETY_MARGIN));
    expect(CACHE_THRESHOLD_SECONDS).toBe(3240); // 54 minutes
  });
});

describe('SHORT_TTL_THRESHOLD', () => {
  it('is derived from SHORT TTL with safety margin', () => {
    expect(SHORT_TTL_THRESHOLD).toBe(Math.floor(CACHE_TTL.SHORT * CACHE_SAFETY_MARGIN));
    expect(SHORT_TTL_THRESHOLD).toBe(270); // 4.5 minutes
  });
});

// ============================================================================
// API LIMITS
// ============================================================================

describe('CLAUDE_IMAGE_LIMITS', () => {
  it('max bytes is 5MB', () => {
    expect(CLAUDE_IMAGE_LIMITS.maxImageBytes).toBe(5_242_880);
  });

  it('max base64 chars is ~4.875MB (conservative)', () => {
    expect(CLAUDE_IMAGE_LIMITS.maxBase64Chars).toBe(6_500_000);
    // base64 adds ~33% overhead, so 6.5M chars = ~4.875MB raw
    expect(CLAUDE_IMAGE_LIMITS.maxBase64Chars).toBeLessThan(
      CLAUDE_IMAGE_LIMITS.maxImageBytes * 1.34
    );
  });
});

describe('IMAGE_COMPRESSION', () => {
  it('has reasonable max dimension', () => {
    expect(IMAGE_COMPRESSION.maxDimension).toBe(768);
  });

  it('has JPEG quality setting', () => {
    expect(IMAGE_COMPRESSION.jpegQuality).toBe(80);
    expect(IMAGE_COMPRESSION.jpegQuality).toBeGreaterThan(0);
    expect(IMAGE_COMPRESSION.jpegQuality).toBeLessThanOrEqual(100);
  });
});

describe('TELEGRAM_MAX_LENGTH', () => {
  it('is 4000 characters', () => {
    expect(TELEGRAM_MAX_LENGTH).toBe(4000);
  });
});

describe('token limits', () => {
  it('DEFAULT_MAX_OUTPUT_TOKENS is 4000', () => {
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBe(4000);
  });

  it('WEB_SEARCH_MAX_TOKENS is 4000', () => {
    expect(WEB_SEARCH_MAX_TOKENS).toBe(4000);
  });
});

// ============================================================================
// TIMING CONFIGURATION
// ============================================================================

describe('DEFAULT_CYCLE_INTERVAL', () => {
  it('is 10 minutes', () => {
    expect(DEFAULT_CYCLE_INTERVAL).toBe(600);
  });
});

describe('MAX_SLEEP_SECONDS', () => {
  it('equals cache threshold', () => {
    expect(MAX_SLEEP_SECONDS).toBe(CACHE_THRESHOLD_SECONDS);
  });
});

describe('MAX_REMINDERS', () => {
  it('is 5', () => {
    expect(MAX_REMINDERS).toBe(5);
  });
});

describe('MIN_SUMMARY_LENGTH', () => {
  it('is 50 characters', () => {
    expect(MIN_SUMMARY_LENGTH).toBe(50);
  });
});

// ============================================================================
// HISTORY_TYPES & HISTORY_ICONS
// ============================================================================

describe('HISTORY_TYPES', () => {
  it('has all expected history types', () => {
    expect(HISTORY_TYPES.thought).toBe('thought');
    expect(HISTORY_TYPES.message_to_user).toBe('message_to_user');
    expect(HISTORY_TYPES.user_message).toBe('user_message');
    expect(HISTORY_TYPES.curiosity).toBe('curiosity');
    expect(HISTORY_TYPES.art_result).toBe('art_result');
    expect(HISTORY_TYPES.user_art).toBe('user_art');
    expect(HISTORY_TYPES.art_request).toBe('art_request');
    expect(HISTORY_TYPES.search_query).toBe('search_query');
    expect(HISTORY_TYPES.search_result).toBe('search_result');
    expect(HISTORY_TYPES.cold_storage).toBe('cold_storage');
    expect(HISTORY_TYPES.note_saved).toBe('note_saved');
    expect(HISTORY_TYPES.exist).toBe('exist');
  });

  it('values match keys', () => {
    for (const [key, value] of Object.entries(HISTORY_TYPES)) {
      expect(value).toBe(key);
    }
  });
});

describe('HISTORY_ICONS', () => {
  it('has icon for each history type', () => {
    for (const type of Object.values(HISTORY_TYPES)) {
      expect(HISTORY_ICONS[type], `Missing icon for ${type}`).toBeDefined();
      expect(typeof HISTORY_ICONS[type]).toBe('string');
    }
  });

  it('icons are non-empty', () => {
    for (const [type, icon] of Object.entries(HISTORY_ICONS)) {
      expect(icon.length, `Empty icon for ${type}`).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// ACTION_TYPES & ACTION_CATEGORIES
// ============================================================================

describe('ACTION_TYPES', () => {
  it('has all expected action types', () => {
    expect(ACTION_TYPES.MESSAGE_USER).toBe('MESSAGE_USER');
    expect(ACTION_TYPES.THINK).toBe('THINK');
    expect(ACTION_TYPES.WONDER).toBe('WONDER');
    expect(ACTION_TYPES.REMEMBER).toBe('REMEMBER');
    expect(ACTION_TYPES.COLD_STORAGE).toBe('COLD_STORAGE');
    expect(ACTION_TYPES.SEARCH).toBe('SEARCH');
    expect(ACTION_TYPES.ART).toBe('ART');
    expect(ACTION_TYPES.NOTE).toBe('NOTE');
    expect(ACTION_TYPES.OBSERVATION).toBe('OBSERVATION');
    expect(ACTION_TYPES.SUMMARIZE).toBe('SUMMARIZE');
    expect(ACTION_TYPES.REMINDER).toBe('REMINDER');
    expect(ACTION_TYPES.SET_STATUS).toBe('SET_STATUS');
    expect(ACTION_TYPES.SET_PROFILE_PIC).toBe('SET_PROFILE_PIC');
    expect(ACTION_TYPES.SLEEP).toBe('SLEEP');
    expect(ACTION_TYPES.EXIST).toBe('EXIST');
    expect(ACTION_TYPES.SET_USER_STATUS).toBe('SET_USER_STATUS');
    expect(ACTION_TYPES.LEARNED).toBe('LEARNED');
    expect(ACTION_TYPES.QUESTION).toBe('QUESTION');
  });

  it('values match keys', () => {
    for (const [key, value] of Object.entries(ACTION_TYPES)) {
      expect(value).toBe(key);
    }
  });
});

describe('ACTION_CATEGORIES', () => {
  it('has all expected categories', () => {
    expect(ACTION_CATEGORIES.communication).toBeDefined();
    expect(ACTION_CATEGORIES.internal).toBeDefined();
    expect(ACTION_CATEGORIES.memory).toBeDefined();
    expect(ACTION_CATEGORIES.external).toBeDefined();
    expect(ACTION_CATEGORIES.creative).toBeDefined();
    expect(ACTION_CATEGORIES.control).toBeDefined();
    expect(ACTION_CATEGORIES.self).toBeDefined();
  });

  it('categories contain valid action types', () => {
    const allActions = new Set(Object.values(ACTION_TYPES));

    for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
      for (const action of actions) {
        expect(allActions.has(action), `Unknown action ${action} in ${category}`).toBe(true);
      }
    }
  });

  it('each action appears in exactly one category', () => {
    const actionToCategory = new Map<string, string>();

    for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
      for (const action of actions) {
        if (actionToCategory.has(action)) {
          throw new Error(
            `Action ${action} appears in both ${actionToCategory.get(action)} and ${category}`
          );
        }
        actionToCategory.set(action, category);
      }
    }
  });

  it('all actions are categorized', () => {
    const categorizedActions = new Set(
      Object.values(ACTION_CATEGORIES).flat()
    );

    for (const action of Object.values(ACTION_TYPES)) {
      expect(categorizedActions.has(action), `Action ${action} not categorized`).toBe(true);
    }
  });
});
