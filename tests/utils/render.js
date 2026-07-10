/**
 * React Testing Utilities
 *
 * @module tests/utils/render
 * @description Utilities for rendering React components in tests
 *
 * Wraps React Testing Library with common providers and helpers.
 * Use these utilities instead of importing directly from @testing-library/react
 * to ensure consistent test setup across all component tests.
 *
 * @upstream Called by: Component tests, hook tests
 * @downstream Calls: @testing-library/react, @testing-library/user-event
 *
 * @usage
 * import { render, screen, userEvent } from '../utils/render';
 *
 * const { user } = render(<MyComponent />);
 * await user.click(screen.getByRole('button'));
 */

import { render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * @description Custom render function with providers and user event setup
 *
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Render options
 * @param {React.FC} options.wrapper - Custom wrapper component
 * @param {Object} options.initialState - Initial state for providers
 * @returns {Object} Render result plus user event instance
 *
 * @example
 * const { user, container } = render(<Button onClick={handleClick} />);
 * await user.click(screen.getByRole('button'));
 */
export function render(ui, options = {}) {
  const { wrapper: Wrapper, ...renderOptions } = options;

  // Set up user event with realistic timings
  const user = userEvent.setup({
    delay: null, // Remove artificial delays for faster tests
  });

  const renderResult = Wrapper
    ? rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
    : rtlRender(ui, renderOptions);

  return {
    ...renderResult,
    user,
  };
}

/**
 * @description Render a hook for testing
 *
 * Re-exports renderHook from @testing-library/react for convenience.
 * Use this for testing custom hooks in isolation.
 *
 * @example
 * import { renderHook, waitFor } from '../utils/render';
 *
 * const { result } = renderHook(() => useCounter());
 * expect(result.current.count).toBe(0);
 */
export { renderHook } from '@testing-library/react';

// Re-export common testing utilities for convenience
export { screen, waitFor, within };

/**
 * @description Wait for loading states to resolve
 *
 * @param {Function} callback - Assertion callback
 * @param {Object} options - waitFor options
 * @returns {Promise} Resolves when condition is met
 *
 * @example
 * await waitForLoadingToFinish(() => {
 *   expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
 * });
 */
export async function waitForLoadingToFinish(callback, options = {}) {
  return waitFor(callback, {
    timeout: 3000,
    ...options,
  });
}

/**
 * @description Assert element is visible and not hidden
 *
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if visible
 */
export function isVisible(element) {
  return !element.hidden && element.style.display !== 'none';
}

/**
 * @description Create a mock event for testing event handlers
 *
 * @param {Object} overrides - Event properties to override
 * @returns {Object} Mock event object
 *
 * @example
 * const event = createMockEvent({ target: { value: 'test' } });
 * handleChange(event);
 */
export function createMockEvent(overrides = {}) {
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    target: { value: '' },
    currentTarget: { value: '' },
    ...overrides,
  };
}
