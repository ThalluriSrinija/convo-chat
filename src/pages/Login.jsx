import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { loginUser } from '../api/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  validateIdentifier,
  validateLoginPassword,
  validateLoginForm,
} from '../utils/validation.js';

import './AuthPages.css';
import './Login.css';

// ── Eye icons ────────────────────────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_FORM = { identifier: '', password: '' };

// ── Component ─────────────────────────────────────────────────────────────────

function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const [formData,    setFormData]    = useState(INITIAL_FORM);
  const [errors,      setErrors]      = useState({});
  const [touched,     setTouched]     = useState({});
  const [showPass,    setShowPass]    = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [serverError, setServerError] = useState('');

  // ── Per-field validation (called on blur) ─────────────────────────────────

  const validateField = useCallback((name, value) => {
    let error = null;
    if (name === 'identifier') error = validateIdentifier(value);
    if (name === 'password')   error = validateLoginPassword(value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  // ── Handle change ─────────────────────────────────────────────────────────

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');

    // Live re-validate only after the field has been touched
    if (touched[name]) {
      let error = null;
      if (name === 'identifier') error = validateIdentifier(value);
      if (name === 'password')   error = validateLoginPassword(value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  }, [touched]);

  // ── Handle blur ───────────────────────────────────────────────────────────

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  }, [validateField]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Mark all fields touched so errors become visible
    setTouched({ identifier: true, password: true });

    const validationErrors = validateLoginForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Focus first invalid field
      const firstField = Object.keys(validationErrors)[0];
      document.getElementById(`login-${firstField}`)?.focus();
      return;
    }

    setIsLoading(true);
    setServerError('');

    try {
      /**
       * loginUser returns { user, token } on success.
       *
       * TODO (Module 19 — Integration):
       *   - The token will be stored in axiosInstance headers here.
       *   - login(data.user) stores the user in AuthContext + sessionStorage.
       *   - navigate('/home') takes the user into the app.
       */
      const data = await loginUser({
        identifier: formData.identifier.trim(),
        password:   formData.password,
      });

      // Store user and token in AuthContext and redirect
      login(data.user, data.token);
      navigate('/home', { replace: true });

    } catch (err) {
      // Surface the error — placeholder message until backend is connected
      setServerError(
        err?.response?.data?.message
          ?? err?.message
          ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [formData, login, navigate]);

  // ── Helper: field class ───────────────────────────────────────────────────

  const fieldClass = (name) => {
    if (!touched[name]) return 'form-control';
    return `form-control ${errors[name] ? 'is-invalid' : 'is-valid'}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="auth-page">

      {/* Header */}
      <div className="auth-page__header">
        <h1 className="auth-page__title">Welcome back</h1>
        <p className="auth-page__subtitle">Sign in to continue to Convo</p>
      </div>

      {/* Server error alert */}
      {serverError && (
        <div className="auth-alert auth-alert--error" role="alert">
          <span className="auth-alert__icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          {serverError}
        </div>
      )}

      {/* Form */}
      <form
        id="login-form"
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Sign in form"
      >
        {/* Email or Phone */}
        <div className="form-group">
          <label className="form-label" htmlFor="login-identifier">
            Email or Phone{' '}
            <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            inputMode="email"
            className={fieldClass('identifier')}
            placeholder="jane@example.com or 9876543210"
            value={formData.identifier}
            onChange={handleChange}
            onBlur={handleBlur}
            autoComplete="username"
            autoFocus
            aria-required="true"
            aria-describedby={
              errors.identifier && touched.identifier ? 'error-identifier' : 'hint-identifier'
            }
            disabled={isLoading}
          />
          {touched.identifier && errors.identifier ? (
            <p id="error-identifier" className="field-error" role="alert">
              {errors.identifier}
            </p>
          ) : (
            <p id="hint-identifier" className="login-field-hint">
              You can use either your email address or phone number.
            </p>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <div className="login-forgot-row">
            <label className="form-label" htmlFor="login-password" style={{ flex: 1 }}>
              Password{' '}
              <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <Link
              to="/forgot-password"
              className="auth-link"
              style={{ fontSize: 'var(--font-size-xs)' }}
              tabIndex={isLoading ? -1 : 0}
            >
              Forgot password?
            </Link>
          </div>

          <div className="password-wrapper">
            <input
              id="login-password"
              name="password"
              type={showPass ? 'text' : 'password'}
              className={fieldClass('password')}
              placeholder="Your password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="current-password"
              aria-required="true"
              aria-describedby={
                errors.password && touched.password ? 'error-password' : undefined
              }
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              disabled={isLoading}
            >
              {showPass ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>

          {touched.password && errors.password && (
            <p id="error-password" className="field-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="login-submit"
          className="btn btn-primary btn-auth-submit w-100"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="btn-spinner">
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              />
              Signing in…
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="auth-page__footer">
        <p>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
