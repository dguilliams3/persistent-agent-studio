/**
 * @module @persistence/core/__tests__/types.test
 * @description Unit tests for type definitions and interfaces
 *
 * Tests cover:
 * - PersonaConfig interface structure
 * - MeterConfig interface structure
 *
 * Note: ToolDefinition, ActionContext, ActionResult, HistoryType have been
 * removed from core/types.ts. Canonical locations:
 * - ToolDefinition → @persistence/tools/types.ts
 * - ToolContext/ToolResult → @persistence/tools/types.ts
 * - HistoryType → @persistence/memory/types.ts
 *
 * @covers ../types.ts
 */

import { describe, it, expect } from 'vitest';
import type {
  PersonaConfig,
  MeterConfig,
} from '../types';

// ============================================================================
// PersonaConfig Interface
// ============================================================================

describe('PersonaConfig interface', () => {
  it('accepts persona config with required fields', () => {
    const config: PersonaConfig = {
      name: 'Clio',
      slug: 'clio',
      model: 'sonnet',
      systemPromptTemplate: 'templates/clio.md',
    };

    expect(config.name).toBe('Clio');
    expect(config.slug).toBe('clio');
    expect(config.model).toBe('sonnet');
    expect(config.systemPromptTemplate).toBe('templates/clio.md');
    expect(config.meterConfig).toBeUndefined();
  });

  it('accepts persona config with meter config', () => {
    const config: PersonaConfig = {
      name: 'Clio V2',
      slug: 'clio-v2',
      model: 'opus',
      systemPromptTemplate: 'templates/clio-v2.md',
      meterConfig: { min: 0, max: 10, default: 5, label: 'Energy' },
    };

    expect(config.meterConfig?.default).toBe(5);
  });
});

// ============================================================================
// MeterConfig Interface
// ============================================================================

describe('MeterConfig interface', () => {
  it('accepts complete meter configuration', () => {
    const config: MeterConfig = {
      min: 0,
      max: 10,
      default: 5,
      label: 'Energy',
    };

    expect(config.min).toBe(0);
    expect(config.max).toBe(10);
    expect(config.default).toBe(5);
    expect(config.label).toBe('Energy');
  });

  it('accepts different value ranges', () => {
    const configs: MeterConfig[] = [
      { min: 0, max: 100, default: 50, label: 'Percentage' },
      { min: -10, max: 10, default: 0, label: 'Balance' },
      { min: 1, max: 5, default: 3, label: 'Rating' },
    ];

    expect(configs[0].max).toBe(100);
    expect(configs[1].min).toBe(-10);
    expect(configs[2].default).toBe(3);
  });
});
