/**
 * Login Form Component - Neural Observatory Design
 *
 * @description Login form with Neural Observatory design - gradient mesh background,
 * breathing logo animation, cyan accent inputs and button. First impression of Clio.
 *
 * @module components/auth/LoginForm
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx (when not authenticated)
 * @downstream Calls:
 *   - useAuth() hook - login(), isAuthenticated state
 *   - api/client.js - login endpoint
 *
 * @tests src/components/auth/__tests__/LoginForm.test.jsx
 *   - "renders login form inputs"
 *   - "handles login submission"
 *   - "displays error on failed login"
 *
 * @antipattern
 * // WRONG: Using purple accent colors
 * className="bg-purple-600" // Clashes with dark mode extensions
 * // CORRECT: Use cyan accent from design system
 * className="bg-accent" // Uses --accent CSS variable
 */

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Breathing logo animation - three dots that pulse together
 * @returns {JSX.Element}
 */
function BreathingLogo() {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <div
        className="w-3 h-3 rounded-full bg-accent animate-breathe"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="w-4 h-4 rounded-full bg-accent animate-breathe"
        style={{ animationDelay: '0.15s' }}
      />
      <div
        className="w-3 h-3 rounded-full bg-accent animate-breathe"
        style={{ animationDelay: '0.3s' }}
      />
    </div>
  );
}

interface LoginFormProps {
  onLogin?: () => void;
}

/**
 * Login Form Component
 *
 * @param {Object} props - Component props
 * @param {Function} props.onLogin - Callback when login succeeds
 * @returns {JSX.Element} Login form
 */
export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error } = useAuth();

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const success = await login(username, password);
      if (success && onLogin) {
        onLogin();
      }
    } catch (err) {
      // Error is handled by useAuth hook
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Gradient mesh background effect */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top-left glow */}
        <div
          className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.4) 0%, transparent 70%)',
          }}
        />
        {/* Bottom-right glow */}
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%)',
          }}
        />
        {/* Center subtle glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 max-w-md w-full">
        <div className="card-elevated p-8 sm:p-10">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <BreathingLogo />
            <h1 className="text-display text-3xl sm:text-4xl text-content-primary mb-2">
              Clio
            </h1>
            <p className="text-content-secondary text-sm">
              Neural Observatory
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-content-secondary mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-content-secondary mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pr-20"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'rgb(var(--danger) / 0.1)',
                  borderColor: 'rgb(var(--danger) / 0.3)',
                }}
              >
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 flex-shrink-0 mt-0.5"
                    style={{ color: 'rgb(var(--danger))' }}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm" style={{ color: 'rgb(var(--danger))' }}>
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex justify-center items-center gap-2 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                'Enter Observatory'
              )}
            </button>
          </form>

          {/* Footer text */}
          <p className="mt-6 text-center text-xs text-content-muted">
            Persistent AI companion
          </p>
          <p className="mt-2 text-center text-[11px] text-content-muted">
            build {__BUILD_ID__}
          </p>
        </div>
      </div>
    </div>
  );
}


