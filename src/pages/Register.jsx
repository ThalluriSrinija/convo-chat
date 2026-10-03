import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { registerUser } from '../api/authApi.js';
import {
  validateName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRegisterForm,
  getPasswordStrength,
} from '../utils/validation.js';

import './AuthPages.css';
import './Register.css';

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

// ── Password Strength Meter ───────────────────────────────────────────────────

function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = getPasswordStrength(password);

  return (
    <div className="strength-meter" role="status" aria-label={`Password strength: ${label}`}>
      <div className="strength-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`strength-bar ${level <= score ? 'active' : ''}`}
            style={{ backgroundColor: level <= score ? color : undefined }}
          />
        ))}
      </div>
      {label && (
        <span className="strength-label" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Success View ─────────────────────────────────────────────────────────────

function RegisterSuccess() {
  return (
    <div className="register-success">
      <div className="register-success__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="register-success__title">Account created!</h2>
      <p className="register-success__subtitle">
        Your account has been created successfully.<br />
        You can now sign in to Convo.
      </p>
      <Link to="/login" className="btn btn-primary btn-auth-submit w-100 mt-1">
        Go to Sign In
      </Link>
    </div>
  );
}

// ── Initial form state ────────────────────────────────────────────────────────

const INITIAL_FORM = {
  name:            '',
  phone:           '',
  email:           '',
  password:        '',
  confirmPassword: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

function Register() {
  const [formData,  setFormData]  = useState(INITIAL_FORM);
  const [errors,    setErrors]    = useState({});
  const [touched,   setTouched]   = useState({});
  const [showPass,  setShowPass]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSuccess, setIsSuccess]  = useState(false);

  // ── Validate a single field on blur ──────────────────────────────────────

  const validateField = useCallback((name, value) => {
    let error = null;
    switch (name) {
      case 'name':            error = validateName(value);            break;
      case 'phone':           error = validatePhone(value);           break;
      case 'email':           error = validateEmail(value);           break;
      case 'password':        error = validatePassword(value);        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.password, value);
        break;
      default: break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, [formData.password]);

  // ── Handle input change ───────────────────────────────────────────────────

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');

    // Re-validate the field live only if it was already touched
    if (touched[name]) {
      let error = null;
      switch (name) {
        case 'name':            error = validateName(value);            break;
        case 'phone':           error = validatePhone(value);           break;
        case 'email':           error = validateEmail(value);           break;
        case 'password':        error = validatePassword(value);        break;
        case 'confirmPassword':
          error = validateConfirmPassword(formData.password, value);
          break;
        default: break;
      }
      setErrors((prev) => ({ ...prev, [name]: error }));
    }

    // Re-validate confirmPassword live when password field changes
    if (name === 'password' && touched.confirmPassword) {
      const confirmErr = validateConfirmPassword(value, formData.confirmPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  }, [touched, formData.password, formData.confirmPassword]);

  // ── Handle blur (mark field touched, validate) ────────────────────────────

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  }, [validateField]);

  // ── Form submit ───────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Mark all fields as touched so errors become visible
    setTouched({ name: true, phone: true, email: true, password: true, confirmPassword: true });

    // Full client-side validation
    const validationErrors = validateRegisterForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Focus the first invalid field for accessibility
      const firstErrorField = Object.keys(validationErrors)[0];
      document.getElementById(`register-${firstErrorField}`)?.focus();
      return;
    }

    // Submit to API
    setIsLoading(true);
    setServerError('');

    try {
      // Strip confirmPassword — never send it to the server
      const { confirmPassword: _omit, ...payload } = formData;
      await registerUser(payload);
      setIsSuccess(true);
    } catch (err) {
      // Surface the error message — real backend errors will replace placeholder text
      setServerError(
        err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [formData]);

  // ── Helper: field class ───────────────────────────────────────────────────

  const fieldClass = (name) => {
    if (!touched[name]) return 'form-control';
    return `form-control ${errors[name] ? 'is-invalid' : 'is-valid'}`;
  };

  // ── Success view ──────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <div className="auth-page">
        <RegisterSuccess />
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────

  return (
    <div className="auth-page">
      {/* Header */}
      <div className="auth-page__header">
        <h1 className="auth-page__title">Create account</h1>
        <p className="auth-page__subtitle">Join Convo and start chatting</p>
      </div>

      {/* Server error alert */}
      {serverError && (
        <div className="auth-alert auth-alert--error" role="alert">
          <span className="auth-alert__icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          {serverError}
        </div>
      )}

      {/* Registration form */}
      <form
        id="register-form"
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Registration form"
      >
        {/* Row: Name + Phone */}
        <div className="register-row">

          {/* Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="register-name"
              name="name"
              type="text"
              className={fieldClass('name')}
              placeholder="Jane Smith"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="name"
              aria-required="true"
              aria-describedby={errors.name && touched.name ? 'error-name' : undefined}
              disabled={isLoading}
            />
            {touched.name && errors.name && (
              <p id="error-name" className="field-error" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label" htmlFor="register-phone">
              Phone <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              className={fieldClass('phone')}
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="tel"
              aria-required="true"
              aria-describedby={errors.phone && touched.phone ? 'error-phone' : undefined}
              disabled={isLoading}
            />
            {touched.phone && errors.phone && (
              <p id="error-phone" className="field-error" role="alert">
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-email">
            Email <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            className={fieldClass('email')}
            placeholder="jane@example.com"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            autoComplete="email"
            aria-required="true"
            aria-describedby={errors.email && touched.email ? 'error-email' : undefined}
            disabled={isLoading}
          />
          {touched.email && errors.email && (
            <p id="error-email" className="field-error" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-password">
            Password <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <div className="password-wrapper">
            <input
              id="register-password"
              name="password"
              type={showPass ? 'text' : 'password'}
              className={fieldClass('password')}
              placeholder="Min. 8 chars, A-Z, a-z, 0-9"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="new-password"
              aria-required="true"
              aria-describedby={
                [
                  errors.password && touched.password ? 'error-password' : '',
                  formData.password ? 'password-strength' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showPass ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>

          {/* Strength meter */}
          {formData.password && (
            <div id="password-strength">
              <PasswordStrengthMeter password={formData.password} />
            </div>
          )}

          {touched.password && errors.password && (
            <p id="error-password" className="field-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="register-confirmPassword">
            Confirm Password <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <div className="password-wrapper">
            <input
              id="register-confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              className={fieldClass('confirmPassword')}
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="new-password"
              aria-required="true"
              aria-describedby={
                errors.confirmPassword && touched.confirmPassword
                  ? 'error-confirmPassword'
                  : undefined
              }
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              tabIndex={0}
            >
              {showConfirm ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          {touched.confirmPassword && errors.confirmPassword && (
            <p id="error-confirmPassword" className="field-error" role="alert">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="register-submit"
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
              Creating account…
            </span>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="auth-page__footer">
        <p>
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
