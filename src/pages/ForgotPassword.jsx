import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { requestPasswordReset, resetPassword } from '../api/authApi.js';
import { validatePhone, validatePassword, validateConfirmPassword } from '../utils/validation.js';

import './AuthPages.css';
import './ForgotPassword.css';

// ── Steps definition ─────────────────────────────────────────────────────────

const STEPS = {
  PHONE:        'phone',       // Step 1 — enter phone number
  NEW_PASSWORD: 'newPassword', // Step 2 — enter new + confirm password
  SUCCESS:      'success',     // Done
};

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

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }) {
  const isDone1 = currentStep === STEPS.NEW_PASSWORD || currentStep === STEPS.SUCCESS;
  const isDone2 = currentStep === STEPS.SUCCESS;
  const isActive1 = currentStep === STEPS.PHONE;
  const isActive2 = currentStep === STEPS.NEW_PASSWORD;
  const isActive3 = currentStep === STEPS.SUCCESS;

  const stepClass = (active, done) =>
    `fp-step ${active ? 'fp-step--active' : ''} ${done ? 'fp-step--done' : ''}`;

  return (
    <div className="fp-steps" aria-label="Password reset progress" role="list">
      {/* Step 1 */}
      <div className={stepClass(isActive1, isDone1)} role="listitem"
        aria-current={isActive1 ? 'step' : undefined}>
        <div className="fp-step__circle" aria-hidden="true">
          {isDone1
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            : '1'
          }
        </div>
        <span className="fp-step__label">Phone</span>
      </div>

      <div className={`fp-connector ${isDone1 ? 'fp-connector--done' : ''}`} aria-hidden="true" />

      {/* Step 2 */}
      <div className={stepClass(isActive2, isDone2)} role="listitem"
        aria-current={isActive2 ? 'step' : undefined}>
        <div className="fp-step__circle" aria-hidden="true">
          {isDone2
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            : '2'
          }
        </div>
        <span className="fp-step__label">Password</span>
      </div>

      <div className={`fp-connector ${isDone2 ? 'fp-connector--done' : ''}`} aria-hidden="true" />

      {/* Step 3 */}
      <div className={stepClass(isActive3, false)} role="listitem"
        aria-current={isActive3 ? 'step' : undefined}>
        <div className="fp-step__circle" aria-hidden="true">
          {isActive3
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            : '3'
          }
        </div>
        <span className="fp-step__label">Done</span>
      </div>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ message, type = 'error' }) {
  if (!message) return null;
  return (
    <div className={`auth-alert auth-alert--${type}`} role="alert">
      <span className="auth-alert__icon" aria-hidden="true">
        {type === 'error'
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
        }
      </span>
      {message}
    </div>
  );
}

// ── Step 1 — Phone number ─────────────────────────────────────────────────────

function StepPhone({ onSuccess }) {
  const [phone,       setPhone]       = useState('');
  const [error,       setError]       = useState(null);
  const [touched,     setTouched]     = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = (val) => validatePhone(val);

  const handleChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    setServerError('');
    if (touched) setError(validate(val));
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validate(phone));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    const fieldError = validate(phone);
    setError(fieldError);
    if (fieldError) {
      document.getElementById('fp-phone')?.focus();
      return;
    }

    setIsLoading(true);
    setServerError('');

    try {
      /**
       * requestPasswordReset returns a resetToken from the backend
       * after the user completes SMS verification.
       *
       * IMPORTANT: Step 2 is only reached if this API call succeeds.
       * The backend is responsible for verifying the phone number —
       * the frontend NEVER skips to Step 2 without a valid server response.
       *
       * TODO (Module 19): When backend is connected, this will return:
       *   { message: 'Verification sent', resetToken: '<server-token>' }
       * Then call: onSuccess({ phone, resetToken: data.resetToken })
       */
      const data = await requestPasswordReset(phone.trim());
      const resetToken = data?.resetToken;
      if (!resetToken || typeof resetToken !== 'string') {
        setServerError('Password reset is not available yet. Please contact support.');
        return;
      }
      onSuccess({ phone: phone.trim(), resetToken });

    } catch (err) {
      setServerError(
        err?.response?.data?.message
          ?? err?.message
          ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = touched
    ? `form-control ${error ? 'is-invalid' : 'is-valid'}`
    : 'form-control';

  return (
    <div className="fp-panel">
      <Alert message={serverError} type="error" />

      <form onSubmit={handleSubmit} noValidate aria-label="Enter phone number">
        <div className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="fp-phone">
              Phone Number{' '}
              <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="fp-phone"
              name="phone"
              type="tel"
              className={fieldClass}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="tel"
              aria-required="true"
              aria-describedby={touched && error ? 'fp-phone-error' : 'fp-phone-hint'}
              disabled={isLoading}
              autoFocus
            />
            {touched && error
              ? <p id="fp-phone-error" className="field-error" role="alert">{error}</p>
              : <p id="fp-phone-hint" className="login-field-hint">
                  We&apos;ll send a verification code to this number.
                </p>
            }
          </div>

          <button
            type="submit"
            id="fp-phone-submit"
            className="btn btn-primary btn-auth-submit w-100"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading
              ? <span className="btn-spinner">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Sending…
                </span>
              : 'Send Verification Code'
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Step 2 — New password ─────────────────────────────────────────────────────

function StepNewPassword({ phone, resetToken, onSuccess, onBack }) {
  const [formData,    setFormData]    = useState({ newPassword: '', confirmPassword: '' });
  const [errors,      setErrors]      = useState({});
  const [touched,     setTouched]     = useState({});
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [serverError, setServerError] = useState('');

  const validateField = useCallback((name, value) => {
    if (name === 'newPassword')     return validatePassword(value);
    if (name === 'confirmPassword') return validateConfirmPassword(formData.newPassword, value);
    return null;
  }, [formData.newPassword]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
    // Re-validate confirm when new password changes
    if (name === 'newPassword' && touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(value, formData.confirmPassword),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ newPassword: true, confirmPassword: true });

    const newErrors = {
      newPassword:     validatePassword(formData.newPassword),
      confirmPassword: validateConfirmPassword(formData.newPassword, formData.confirmPassword),
    };
    // Remove nulls
    Object.keys(newErrors).forEach((k) => newErrors[k] === null && delete newErrors[k]);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      document.getElementById('fp-new-password')?.focus();
      return;
    }

    setIsLoading(true);
    setServerError('');

    try {
      /**
       * resetPassword receives the server-issued resetToken (from Step 1 API response)
       * along with the phone and the new password.
       *
       * The backend verifies the token server-side before updating the password.
       * The client NEVER bypasses this by sending just a phone number + new password.
       *
       * TODO (Module 19): When backend is connected, this will:
       *   POST /auth/reset-password { phone, resetToken, newPassword }
       *   → 200 OK  → navigate to success
       */
      await resetPassword({
        phone,
        resetToken,
        newPassword: formData.newPassword,
      });
      onSuccess();

    } catch (err) {
      setServerError(
        err?.response?.data?.message
          ?? err?.message
          ?? 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (name) => {
    if (!touched[name]) return 'form-control';
    return `form-control ${errors[name] ? 'is-invalid' : 'is-valid'}`;
  };

  return (
    <div className="fp-panel">
      {/* Security context banner */}
      <div className="fp-info-banner">
        <span className="fp-info-banner__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <span>
          Setting new password for <strong>{phone}</strong>.
          Your phone number was verified by the server in the previous step.
        </span>
      </div>

      <Alert message={serverError} type="error" />

      <form onSubmit={handleSubmit} noValidate aria-label="Set new password">
        <div className="auth-form">
          {/* New Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="fp-new-password">
              New Password{' '}
              <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="password-wrapper">
              <input
                id="fp-new-password"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                className={fieldClass('newPassword')}
                placeholder="Min. 8 chars, A-Z, a-z, 0-9"
                value={formData.newPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby={
                  touched.newPassword && errors.newPassword ? 'fp-new-error' : undefined
                }
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {touched.newPassword && errors.newPassword && (
              <p id="fp-new-error" className="field-error" role="alert">
                {errors.newPassword}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="fp-confirm-password">
              Confirm Password{' '}
              <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="password-wrapper">
              <input
                id="fp-confirm-password"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                className={fieldClass('confirmPassword')}
                placeholder="Repeat your new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby={
                  touched.confirmPassword && errors.confirmPassword
                    ? 'fp-confirm-error'
                    : undefined
                }
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <p id="fp-confirm-error" className="field-error" role="alert">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            id="fp-password-submit"
            className="btn btn-primary btn-auth-submit w-100"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading
              ? <span className="btn-spinner">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Updating…
                </span>
              : 'Update Password'
            }
          </button>

          {/* Back link */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              className="fp-back-link"
              onClick={onBack}
              disabled={isLoading}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Change phone number
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Success view ──────────────────────────────────────────────────────────────

function StepSuccess() {
  return (
    <div className="fp-success">
      <div className="fp-success__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="fp-success__title">Password updated!</h2>
      <p className="fp-success__subtitle">
        Your password has been changed successfully.<br />
        You can now sign in with your new password.
      </p>
      <Link
        to="/login"
        id="fp-go-to-login"
        className="btn btn-primary btn-auth-submit w-100"
        style={{ marginTop: '0.25rem' }}
      >
        Sign In
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ForgotPassword() {
  const [step,       setStep]       = useState(STEPS.PHONE);
  const [resetData,  setResetData]  = useState({ phone: '', resetToken: '' });

  /**
   * Called when Step 1 (phone) succeeds.
   * NOTE: This is only called when requestPasswordReset() resolves successfully.
   *       With a placeholder backend it will never be called — Step 2 is
   *       unreachable until the real backend is connected.
   */
  const handlePhoneSuccess = useCallback(({ phone, resetToken }) => {
    setResetData({ phone, resetToken });
    setStep(STEPS.NEW_PASSWORD);
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setStep(STEPS.SUCCESS);
  }, []);

  const handleBack = useCallback(() => {
    setStep(STEPS.PHONE);
    setResetData({ phone: '', resetToken: '' });
  }, []);

  return (
    <div className="auth-page">

      {/* Header */}
      <div className="auth-page__header">
        <h1 className="auth-page__title">Reset password</h1>
        <p className="auth-page__subtitle">
          {step === STEPS.PHONE        && "Enter the phone number linked to your account"}
          {step === STEPS.NEW_PASSWORD && "Create a new password for your account"}
          {step === STEPS.SUCCESS      && "All done — you're ready to sign in"}
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step panels */}
      {step === STEPS.PHONE && (
        <StepPhone onSuccess={handlePhoneSuccess} />
      )}

      {step === STEPS.NEW_PASSWORD && (
        <StepNewPassword
          phone={resetData.phone}
          resetToken={resetData.resetToken}
          onSuccess={handlePasswordSuccess}
          onBack={handleBack}
        />
      )}

      {step === STEPS.SUCCESS && (
        <StepSuccess />
      )}

      {/* Footer — back to login */}
      {step !== STEPS.SUCCESS && (
        <div className="auth-page__footer">
          <p>
            Remembered it?{' '}
            <Link to="/login" className="auth-link">Back to sign in</Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default ForgotPassword;
