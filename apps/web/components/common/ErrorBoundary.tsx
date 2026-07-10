/**
 * React Error Boundary Component
 *
 * @module components/common/ErrorBoundary
 * @description Catches JavaScript errors anywhere in the child component tree,
 * logs the error, and displays a fallback UI instead of crashing the entire app.
 *
 * @tests src/components/__tests__/ErrorBoundary.test.jsx
 *
 * Error boundaries are React's way of handling errors in components gracefully.
 * Without an error boundary, a single component error crashes the entire React tree.
 * With an error boundary, only the failing subtree shows the error UI.
 *
 * @upstream Called by:
 *   - App.jsx - Wraps entire application
 *   - Future: Individual tabs may have their own boundaries
 * @downstream Calls:
 *   - React.Component lifecycle methods
 *   - Console for error logging
 *
 * @example
 * // Wrap components that might fail
 * <ErrorBoundary>
 *   <UnstableComponent />
 * </ErrorBoundary>
 *
 * @example
 * // With custom fallback UI
 * <ErrorBoundary fallback={<div>Oops! Something broke.</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @note Error boundaries only catch errors during rendering, lifecycle methods,
 * and constructors. They do NOT catch errors in event handlers, async code,
 * or server-side rendering.
 *
 * @antipattern
 * // WRONG: Trying to catch async errors with ErrorBoundary
 * <ErrorBoundary>
 *   <button onClick={async () => { throw new Error('fail') }}>Click</button>
 * </ErrorBoundary>
 * // This won't be caught! Use try/catch in the handler instead.
 */

import { Component } from 'react';
import { Accordion } from '../ui';

/**
 * @description Error boundary component using React class component pattern
 *
 * Class components are required for error boundaries because the necessary
 * lifecycle methods (getDerivedStateFromError, componentDidCatch) are not
 * available as hooks in functional components.
 *
 * @upstream Called by: Parent components wrapping potentially failing children
 * @downstream Calls: React lifecycle methods, console.error
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to wrap
 * @param {React.ReactNode} [props.fallback] - Optional custom fallback UI
 */
export class ErrorBoundary extends Component<any, any> {
  /**
   * @description Initialize error state
   * @param {Object} props - Component props
   */
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  /**
   * @description Update state when an error is caught (render phase)
   *
   * This static method is called during the "render" phase, so side effects
   * are not allowed. Just return the new state.
   *
   * @upstream Called by: React when a child component throws
   * @downstream Calls: None (pure function)
   *
   * @param {Error} error - The error that was thrown
   * @returns {Object} New state with hasError: true
   */
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  /**
   * @description Log error details (commit phase)
   *
   * This method is called during the "commit" phase, so side effects
   * like logging are allowed here.
   *
   * @upstream Called by: React after an error is caught
   * @downstream Calls: console.error
   *
   * @param {Error} error - The error that was thrown
   * @param {Object} errorInfo - Contains componentStack trace
   */
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  /**
   * @description Reset error state to retry rendering children
   *
   * @upstream Called by: "Try Again" button click
   * @downstream Calls: setState
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  /**
   * @description Render children or error fallback
   *
   * @upstream Called by: React render cycle
   * @downstream Calls: props.children or fallback UI
   *
   * @returns {React.ReactNode} Children if no error, fallback if error
   */
  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided via props
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI with Tailwind styling
      return (
        <div className="p-6 bg-red-900/50 border border-red-700 rounded-lg m-4">
          <h2 className="text-xl font-bold text-red-200 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-300 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          {/* Show component stack trace for debugging */}
          {this.state.errorInfo && (
            <Accordion title="Error details" className="mb-4">
              <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-red-300 overflow-auto max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            </Accordion>
          )}

          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
