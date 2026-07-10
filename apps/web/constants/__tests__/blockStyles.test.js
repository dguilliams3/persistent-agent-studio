/**
 * Block Styles Tests
 *
 * @module constants/__tests__/blockStyles.test
 * @description Tests for the shared block styles configuration.
 * Ensures all blocks have required properties and getBarBlocks() works correctly.
 *
 * @covers constants/blockStyles.js
 */

import { describe, it, expect } from 'vitest';
import { BLOCK_STYLES, getBarBlocks } from '../blockStyles';

describe('BLOCK_STYLES', () => {
  const EXPECTED_BLOCKS = ['system', 'promoted', 'stable', 'fresh', 'archive'];

  it('should have all expected block types', () => {
    EXPECTED_BLOCKS.forEach((block) => {
      expect(BLOCK_STYLES).toHaveProperty(block);
    });
  });

  describe('each block style', () => {
    // Required properties for all blocks
    const REQUIRED_PROPS = ['label', 'border', 'bg', 'text', 'textLight'];

    // Additional props for bar-displayable blocks (not archive)
    const BAR_PROPS = ['key', 'gradient', 'glow', 'tooltip'];

    EXPECTED_BLOCKS.forEach((blockName) => {
      describe(`${blockName}`, () => {
        const block = BLOCK_STYLES[blockName];

        REQUIRED_PROPS.forEach((prop) => {
          it(`should have ${prop} property`, () => {
            expect(block).toHaveProperty(prop);
            expect(typeof block[prop]).toBe('string');
          });
        });

        // Bar blocks need additional props
        if (blockName !== 'archive') {
          BAR_PROPS.forEach((prop) => {
            it(`should have bar property: ${prop}`, () => {
              expect(block).toHaveProperty(prop);
              expect(typeof block[prop]).toBe('string');
            });
          });
        }
      });
    });
  });

  describe('Tailwind class format', () => {
    it('border classes should start with border-l-', () => {
      Object.values(BLOCK_STYLES).forEach((style) => {
        expect(style.border).toMatch(/^border-l-/);
      });
    });

    it('bg classes should start with bg-', () => {
      Object.values(BLOCK_STYLES).forEach((style) => {
        expect(style.bg).toMatch(/^bg-/);
      });
    });

    it('text classes should start with text-', () => {
      Object.values(BLOCK_STYLES).forEach((style) => {
        expect(style.text).toMatch(/^text-/);
        expect(style.textLight).toMatch(/^text-/);
      });
    });

    it('gradient classes should use from-/to- format', () => {
      ['system', 'promoted', 'stable', 'fresh'].forEach((blockName) => {
        const gradient = BLOCK_STYLES[blockName].gradient;
        expect(gradient).toMatch(/^from-.*to-/);
      });
    });
  });

  describe('color consistency', () => {
    it('system should use cyan colors', () => {
      expect(BLOCK_STYLES.system.border).toContain('cyan');
      expect(BLOCK_STYLES.system.text).toContain('cyan');
    });

    it('promoted should use blue colors', () => {
      expect(BLOCK_STYLES.promoted.border).toContain('blue');
      expect(BLOCK_STYLES.promoted.text).toContain('blue');
    });

    it('stable should use green colors', () => {
      expect(BLOCK_STYLES.stable.border).toContain('green');
      expect(BLOCK_STYLES.stable.text).toContain('green');
    });

    it('fresh should use rose colors', () => {
      expect(BLOCK_STYLES.fresh.border).toContain('rose');
      expect(BLOCK_STYLES.fresh.text).toContain('rose');
    });

    it('archive should use emerald colors', () => {
      expect(BLOCK_STYLES.archive.border).toContain('emerald');
      expect(BLOCK_STYLES.archive.text).toContain('emerald');
    });
  });
});

describe('getBarBlocks', () => {
  it('should return an array', () => {
    const blocks = getBarBlocks();
    expect(Array.isArray(blocks)).toBe(true);
  });

  it('should return exactly 5 blocks (including archive)', () => {
    const blocks = getBarBlocks();
    expect(blocks).toHaveLength(5);
  });

  it('should return blocks in correct order: system, promoted, stable, fresh, archive', () => {
    const blocks = getBarBlocks();
    expect(blocks[0]).toBe(BLOCK_STYLES.system);
    expect(blocks[1]).toBe(BLOCK_STYLES.promoted);
    expect(blocks[2]).toBe(BLOCK_STYLES.stable);
    expect(blocks[3]).toBe(BLOCK_STYLES.fresh);
    expect(blocks[4]).toBe(BLOCK_STYLES.archive);
  });

  it('should include archive block', () => {
    const blocks = getBarBlocks();
    expect(blocks).toContain(BLOCK_STYLES.archive);
  });

  it('fresh block should have uncached: true', () => {
    const blocks = getBarBlocks();
    const freshBlock = blocks.find((b) => b.key === 'block4_fresh');
    expect(freshBlock.uncached).toBe(true);
  });

  it('other blocks should not have uncached flag', () => {
    const blocks = getBarBlocks();
    const nonFreshBlocks = blocks.filter((b) => b.key !== 'block4_fresh');
    nonFreshBlocks.forEach((block) => {
      expect(block.uncached).toBeUndefined();
    });
  });
});
