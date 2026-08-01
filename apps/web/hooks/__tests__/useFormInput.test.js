/**
 * @module tests/hooks/useFormInput
 * @description Unit tests for useFormInput and useFormInputs hooks
 *
 * Test coverage:
 * - Single input state management (useFormInput)
 * - Multiple input state management (useFormInputs)
 * - Event handling (DOM events vs direct values)
 * - Reset and clear functionality
 * - inputProps spreading
 * - Memoization behavior
 *
 * @covers src/hooks/useFormInput.js
 *   - useFormInput() - Initial value, onChange (event/direct), setValue,
 *     reset, clear, inputProps spreading, memoization
 *   - useFormInputs() - Multiple field values, onChange currying, setValue,
 *     reset all, getValues retrieval
 *
 * @fixtures None (hook-only tests)
 * @mocks None
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormInput, useFormInputs } from '../../hooks/useFormInput';

// =============================================================================
// useFormInput TESTS
// =============================================================================

describe('useFormInput', () => {
  describe('initial state', () => {
    it('should initialize with empty string by default', () => {
      const { result } = renderHook(() => useFormInput());

      expect(result.current.value).toBe('');
    });

    it('should initialize with provided string value', () => {
      const { result } = renderHook(() => useFormInput('hello'));

      expect(result.current.value).toBe('hello');
    });

    it('should initialize with provided number value', () => {
      const { result } = renderHook(() => useFormInput(42));

      expect(result.current.value).toBe(42);
    });

    it('should expose all expected properties', () => {
      const { result } = renderHook(() => useFormInput('test'));

      expect(result.current).toHaveProperty('value');
      expect(result.current).toHaveProperty('onChange');
      expect(result.current).toHaveProperty('setValue');
      expect(result.current).toHaveProperty('reset');
      expect(result.current).toHaveProperty('clear');
      expect(result.current).toHaveProperty('inputProps');
    });
  });

  describe('onChange - event objects', () => {
    it('should update value from DOM input event', () => {
      const { result } = renderHook(() => useFormInput(''));

      act(() => {
        result.current.onChange({ target: { value: 'new value' } });
      });

      expect(result.current.value).toBe('new value');
    });

    it('should handle multiple sequential changes', () => {
      const { result } = renderHook(() => useFormInput(''));

      act(() => {
        result.current.onChange({ target: { value: 'first' } });
      });
      expect(result.current.value).toBe('first');

      act(() => {
        result.current.onChange({ target: { value: 'second' } });
      });
      expect(result.current.value).toBe('second');
    });
  });

  describe('onChange - direct values', () => {
    it('should update value from direct string', () => {
      const { result } = renderHook(() => useFormInput(''));

      act(() => {
        result.current.onChange('direct value');
      });

      expect(result.current.value).toBe('direct value');
    });

    it('should update value from direct number', () => {
      const { result } = renderHook(() => useFormInput(0));

      act(() => {
        result.current.onChange(100);
      });

      expect(result.current.value).toBe(100);
    });

    it('should handle null as direct value', () => {
      const { result } = renderHook(() => useFormInput('initial'));

      act(() => {
        result.current.onChange(null);
      });

      expect(result.current.value).toBe(null);
    });

    it('should handle undefined as direct value', () => {
      const { result } = renderHook(() => useFormInput('initial'));

      act(() => {
        result.current.onChange(undefined);
      });

      expect(result.current.value).toBe(undefined);
    });
  });

  describe('setValue', () => {
    it('should set value programmatically', () => {
      const { result } = renderHook(() => useFormInput(''));

      act(() => {
        result.current.setValue('programmatic');
      });

      expect(result.current.value).toBe('programmatic');
    });

    it('should work independently of onChange', () => {
      const { result } = renderHook(() => useFormInput('start'));

      act(() => {
        result.current.setValue('via setValue');
      });
      expect(result.current.value).toBe('via setValue');

      act(() => {
        result.current.onChange({ target: { value: 'via onChange' } });
      });
      expect(result.current.value).toBe('via onChange');
    });
  });

  describe('reset', () => {
    it('should reset to initial value', () => {
      const { result } = renderHook(() => useFormInput('initial'));

      act(() => {
        result.current.onChange({ target: { value: 'changed' } });
      });
      expect(result.current.value).toBe('changed');

      act(() => {
        result.current.reset();
      });
      expect(result.current.value).toBe('initial');
    });

    it('should reset to empty string when no initial value', () => {
      const { result } = renderHook(() => useFormInput());

      act(() => {
        result.current.onChange({ target: { value: 'something' } });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.value).toBe('');
    });
  });

  describe('clear', () => {
    it('should clear to empty string', () => {
      const { result } = renderHook(() => useFormInput('initial'));

      act(() => {
        result.current.clear();
      });

      expect(result.current.value).toBe('');
    });

    it('should clear regardless of current value', () => {
      const { result } = renderHook(() => useFormInput(''));

      act(() => {
        result.current.onChange({ target: { value: 'some value' } });
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.value).toBe('');
    });
  });

  describe('inputProps', () => {
    it('should provide value and onChange', () => {
      const { result } = renderHook(() => useFormInput('test'));

      expect(result.current.inputProps).toHaveProperty('value', 'test');
      expect(result.current.inputProps).toHaveProperty('onChange');
      expect(typeof result.current.inputProps.onChange).toBe('function');
    });

    it('should update when value changes', () => {
      const { result } = renderHook(() => useFormInput('initial'));

      const initialProps = result.current.inputProps;
      expect(initialProps.value).toBe('initial');

      act(() => {
        result.current.onChange({ target: { value: 'updated' } });
      });

      expect(result.current.inputProps.value).toBe('updated');
    });

    it('should work when spread on input element simulation', () => {
      const { result } = renderHook(() => useFormInput(''));

      // Simulate spreading inputProps and calling onChange
      const { onChange } = result.current.inputProps;

      act(() => {
        onChange({ target: { value: 'from spread' } });
      });

      expect(result.current.value).toBe('from spread');
    });
  });

  describe('memoization', () => {
    it('should maintain stable onChange reference', () => {
      const { result, rerender } = renderHook(() => useFormInput('test'));

      const firstOnChange = result.current.onChange;

      rerender();

      expect(result.current.onChange).toBe(firstOnChange);
    });

    it('should maintain stable reset reference when initialValue unchanged', () => {
      const { result, rerender } = renderHook(
        ({ initial }) => useFormInput(initial),
        { initialProps: { initial: 'test' } }
      );

      const firstReset = result.current.reset;

      rerender({ initial: 'test' });

      expect(result.current.reset).toBe(firstReset);
    });
  });
});

// =============================================================================
// useFormInputs TESTS
// =============================================================================

describe('useFormInputs', () => {
  describe('initial state', () => {
    it('should initialize with empty object by default', () => {
      const { result } = renderHook(() => useFormInputs());

      expect(result.current.values).toEqual({});
    });

    it('should initialize with provided values', () => {
      const initial = { email: '', password: '', remember: false };
      const { result } = renderHook(() => useFormInputs(initial));

      expect(result.current.values).toEqual(initial);
    });

    it('should expose all expected properties', () => {
      const { result } = renderHook(() => useFormInputs({}));

      expect(result.current).toHaveProperty('values');
      expect(result.current).toHaveProperty('onChange');
      expect(result.current).toHaveProperty('setValue');
      expect(result.current).toHaveProperty('reset');
      expect(result.current).toHaveProperty('getValues');
    });
  });

  describe('onChange currying', () => {
    it('should return a handler for specific field', () => {
      const { result } = renderHook(() =>
        useFormInputs({ email: '', password: '' })
      );

      const emailHandler = result.current.onChange('email');
      expect(typeof emailHandler).toBe('function');
    });

    it('should update only the specified field', () => {
      const { result } = renderHook(() =>
        useFormInputs({ email: '', password: '' })
      );

      act(() => {
        result.current.onChange('email')({ target: { value: 'test@example.com' } });
      });

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.password).toBe('');
    });

    it('should handle multiple field updates', () => {
      const { result } = renderHook(() =>
        useFormInputs({ name: '', age: '' })
      );

      act(() => {
        result.current.onChange('name')({ target: { value: 'John' } });
      });

      act(() => {
        result.current.onChange('age')({ target: { value: '30' } });
      });

      expect(result.current.values).toEqual({ name: 'John', age: '30' });
    });

    it('should accept direct values without event object', () => {
      const { result } = renderHook(() =>
        useFormInputs({ count: 0 })
      );

      act(() => {
        result.current.onChange('count')(42);
      });

      expect(result.current.values.count).toBe(42);
    });
  });

  describe('setValue', () => {
    it('should set a single field value', () => {
      const { result } = renderHook(() =>
        useFormInputs({ field1: 'a', field2: 'b' })
      );

      act(() => {
        result.current.setValue('field1', 'updated');
      });

      expect(result.current.values.field1).toBe('updated');
      expect(result.current.values.field2).toBe('b');
    });

    it('should handle boolean values for checkboxes', () => {
      const { result } = renderHook(() =>
        useFormInputs({ remember: false, subscribe: false })
      );

      act(() => {
        result.current.setValue('remember', true);
      });

      expect(result.current.values.remember).toBe(true);
      expect(result.current.values.subscribe).toBe(false);
    });

    it('should add new fields dynamically', () => {
      const { result } = renderHook(() =>
        useFormInputs({ existing: 'value' })
      );

      act(() => {
        result.current.setValue('newField', 'new value');
      });

      expect(result.current.values.newField).toBe('new value');
      expect(result.current.values.existing).toBe('value');
    });
  });

  describe('reset', () => {
    it('should reset all fields to initial values', () => {
      const initial = { email: '', password: '', name: '' };
      const { result } = renderHook(() => useFormInputs(initial));

      act(() => {
        result.current.onChange('email')({ target: { value: 'user@example.com' } });
        result.current.onChange('password')({ target: { value: 'secret' } });
        result.current.onChange('name')({ target: { value: 'John' } });
      });

      expect(result.current.values).toEqual({
        email: 'user@example.com',
        password: 'secret',
        name: 'John',
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual(initial);
    });

    it('should remove dynamically added fields on reset', () => {
      const initial = { field1: 'a' };
      const { result } = renderHook(() => useFormInputs(initial));

      act(() => {
        result.current.setValue('dynamicField', 'value');
      });

      expect(result.current.values.dynamicField).toBe('value');

      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual(initial);
      expect(result.current.values.dynamicField).toBeUndefined();
    });
  });

  describe('getValues', () => {
    it('should return current values object', () => {
      const { result } = renderHook(() =>
        useFormInputs({ a: '1', b: '2' })
      );

      const values = result.current.getValues();

      expect(values).toEqual({ a: '1', b: '2' });
    });

    it('should return updated values after changes', () => {
      const { result } = renderHook(() =>
        useFormInputs({ field: 'initial' })
      );

      act(() => {
        result.current.onChange('field')({ target: { value: 'updated' } });
      });

      const values = result.current.getValues();

      expect(values).toEqual({ field: 'updated' });
    });

    it('should be useful for form submission', () => {
      const { result } = renderHook(() =>
        useFormInputs({ username: '', email: '' })
      );

      act(() => {
        result.current.setValue('username', 'testuser');
        result.current.setValue('email', 'test@example.com');
      });

      // Simulate form submission
      const formData = result.current.getValues();

      expect(formData).toEqual({
        username: 'testuser',
        email: 'test@example.com',
      });
    });
  });

  describe('complex form scenarios', () => {
    it('should handle form with mixed input types', () => {
      const { result } = renderHook(() =>
        useFormInputs({
          name: '',
          age: 0,
          subscribe: false,
          tier: 'free',
        })
      );

      act(() => {
        result.current.onChange('name')({ target: { value: 'Alice' } });
        result.current.setValue('age', 25);
        result.current.setValue('subscribe', true);
        result.current.onChange('tier')({ target: { value: 'premium' } });
      });

      expect(result.current.values).toEqual({
        name: 'Alice',
        age: 25,
        subscribe: true,
        tier: 'premium',
      });
    });

    it('should handle rapid sequential updates', () => {
      const { result } = renderHook(() =>
        useFormInputs({ counter: 0 })
      );

      act(() => {
        for (let i = 1; i <= 5; i++) {
          result.current.setValue('counter', i);
        }
      });

      expect(result.current.values.counter).toBe(5);
    });
  });
});
