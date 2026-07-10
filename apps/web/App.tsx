/**
 * Root Application Component
 *
 * @module App
 * @description Top-level component wrapping the entire application with
 * error boundary and authentication gating. Renders AppShell which
 * provides the icon rail navigation and responsive view system.
 *
 * @upstream Called by: main.tsx
 * @downstream Calls: ErrorBoundary, ProtectedRoute, AppShell
 */

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

/**
 * @description Root application component.
 *
 * Auth flow: ErrorBoundary > ProtectedRoute (login gate) > AppShell.
 * AppShell handles all navigation, polling, and view rendering.
 *
 * @returns {React.ReactElement} The wrapped application
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
