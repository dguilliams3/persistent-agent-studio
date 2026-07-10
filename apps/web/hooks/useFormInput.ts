/**
 * Form Input Custom Hooks
 *
 * @module hooks/useFormInput
 * @description Custom hooks for managing form input state, eliminating the
 * repetitive useState + onChange handler pattern.
 *
 * Instead of creating separate state variables and handlers for each input:
 * ```javascript
 * const [email, setEmail] = useState('');
 * const handleEmailChange = (e) => setEmail(e.target.value);
 * ```
 *
 * Use these hooks for cleaner code:
 * ```javascript
 * const email = useFormInput('');
 * <input value={email.value} onChange={email.onChange} />
 * ```
 *
 * @upstream Called by:
 *   - Form components needing controlled inputs
 *   - Settings tab - Multiple input fields
 *   - Editor tab - Text inputs, selects
 * @downstream Calls:
 *   - React useState, useCallback, useMemo
 *
 * @tests src/hooks/__tests__/useFormInput.test.js
 *   - "useFormInput" - Initial state, onChange (event/direct values), setValue,
 *     reset, clear, inputProps spreading, memoization
 *   - "useFormInputs" - Multiple field values, onChange currying, setValue,
 *     reset all, getValues retrieval, complex form scenarios
 *
 * @example
 * // Single input
 * const email = useFormInput('');
 * <input value={email.value} onChange={email.onChange} />
 *
 * @example
 * // With spread syntax
 * const email = useFormInput('');
 * <input {...email.inputProps} placeholder="Enter email" />
 *
 * @example
 * // Multiple inputs with useFormInputs
 * const form = useFormInputs({ email: '', password: '' });
 * <input value={form.values.email} onChange={form.onChange('email')} />
 * <input value={form.values.password} onChange={form.onChange('password')} />
 * form.reset(); // Reset all to initial values
 */

import { useState, useCallback, useMemo } from 'react';

// =============================================================================
// SINGLE INPUT HOOK
// =============================================================================

/**
 * @description Custom hook for single form input state management
 *
 * Provides value, onChange handler, and utility functions for a single input.
 * More efficient than useState because onChange is memoized.
 *
 * @upstream Called by: Any component with form inputs
 * @downstream Calls: React useState, useCallback, useMemo
 *
 * @param {string|number} [initialValue=''] - Initial input value
 * @returns {Object} Input state and handlers
 * @returns {string|number} returns.value - Current input value
 * @returns {Function} returns.onChange - Change handler for input onChange prop
 * @returns {Function} returns.setValue - Direct setter for programmatic updates
 * @returns {Function} returns.reset - Reset to initial value
 * @returns {Function} returns.clear - Clear to empty string
 * @returns {Object} returns.inputProps - Spreadable { value, onChange } object
 *
 * @example
 * const name = useFormInput('');
 *
 * // Use value and onChange separately
 * <input value={name.value} onChange={name.onChange} />
 *
 * // Or spread inputProps
 * <input {...name.inputProps} />
 *
 * // Reset after form submit
 * const handleSubmit = () => {
 *   submitForm(name.value);
 *   name.reset();
 * };
 *
 * // Set programmatically
 * useEffect(() => {
 *   name.setValue(userFromApi.name);
 * }, [userFromApi]);
 */
export function useFormInput(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  /**
   * @description Handle input change events
   *
   * Works with both event objects (from DOM inputs) and direct values.
   * Memoized to prevent unnecessary re-renders of child components.
   *
   * @param {Event|any} e - Change event or direct value
   */
  const onChange = useCallback((e: any) => {
    // Support both event objects and direct values
    const newValue = e?.target ? e.target.value : e;
    setValue(newValue);
  }, []);

  /**
   * @description Reset to initial value
   */
  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  /**
   * @description Clear to empty string
   */
  const clear = useCallback(() => {
    setValue('');
  }, []);

  /**
   * @description Spreadable props object for input elements
   *
   * @example
   * <input {...email.inputProps} className="..." placeholder="..." />
   */
  const inputProps = useMemo(() => ({
    value,
    onChange,
  }), [value, onChange]);

  return {
    value,
    onChange,
    setValue,
    reset,
    clear,
    inputProps,
  };
}

// =============================================================================
// MULTIPLE INPUTS HOOK
// =============================================================================

/**
 * @description Custom hook for managing multiple form inputs at once
 *
 * Useful for forms with many fields - keeps all state in one place
 * and provides a single reset function for the entire form.
 *
 * @upstream Called by: Components with multiple form fields
 * @downstream Calls: React useState, useCallback
 *
 * @param {Object} [initialValues={}] - Object with field names as keys
 * @returns {Object} Form state and handlers
 * @returns {Object} returns.values - Current values keyed by field name
 * @returns {Function} returns.onChange - Returns change handler for a field
 * @returns {Function} returns.setValue - Set a single field's value
 * @returns {Function} returns.reset - Reset all fields to initial values
 * @returns {Function} returns.getValues - Get current values object
 *
 * @example
 * const form = useFormInputs({
 *   email: '',
 *   password: '',
 *   rememberMe: false
 * });
 *
 * <input
 *   value={form.values.email}
 *   onChange={form.onChange('email')}
 * />
 * <input
 *   type="password"
 *   value={form.values.password}
 *   onChange={form.onChange('password')}
 * />
 * <input
 *   type="checkbox"
 *   checked={form.values.rememberMe}
 *   onChange={(e) => form.setValue('rememberMe', e.target.checked)}
 * />
 *
 * // Submit and reset
 * const handleSubmit = () => {
 *   submitForm(form.getValues());
 *   form.reset();
 * };
 *
 * @note For checkboxes, use setValue with e.target.checked instead of onChange
 */
export function useFormInputs(initialValues = {}) {
  const [values, setValues] = useState(initialValues);

  /**
   * @description Get a change handler for a specific field
   *
   * Returns a memoized handler function for the given field name.
   * The handler extracts the value from the event and updates state.
   *
   * @param {string} field - Field name
   * @returns {Function} Change handler for that field
   */
  const onChange = useCallback((field: any) => (e: any) => {
    const value = e?.target ? e.target.value : e;
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * @description Set a single field's value directly
   *
   * Useful for programmatic updates or non-standard inputs like checkboxes.
   *
   * @param {string} field - Field name
   * @param {any} value - New value
   */
  const setValue = useCallback((field: any, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * @description Reset all fields to initial values
   */
  const reset = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  /**
   * @description Get current form values
   * @returns {Object} Current values object
   */
  const getValues = useCallback(() => values, [values]);

  return {
    values,
    onChange,
    setValue,
    reset,
    getValues,
  };
}

export default useFormInput;
