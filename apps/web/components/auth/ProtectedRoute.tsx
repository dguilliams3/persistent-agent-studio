/**
 * Protected Route Wrapper Component
 *
 * Wraps application content and ensures user is authenticated before access.
 * Shows login form when authentication is required.
 *
 * @module components/auth/ProtectedRoute
 * @upstream Called by: App.jsx to protect the entire application
 * @downstream Calls: useAuth hook, LoginForm component
 */

import { useAuth } from '../../hooks/useAuth.js';
import { LoginForm } from './LoginForm.jsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected Route Wrapper Component
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to protect
 * @returns {React.ReactElement} Protected content or login form
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Render protected content
  return children;
}


