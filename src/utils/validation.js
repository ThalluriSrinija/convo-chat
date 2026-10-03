/**
 * Convo — Form Validation Utilities
 *
 * A centralized, reusable validation module used across all auth forms.
 * Each validator returns null on success, or a human-readable error string.
 * validateRegisterForm() returns a flat errors object keyed by field name.
 */

// ── Individual field validators ──────────────────────────────────────────────

/**
 * Validates a display name.
 * Rules: required, 2–60 chars, letters/spaces/apostrophes/hyphens only.
 * @param {string} value
 * @returns {string|null}
 */
export function validateName(value) {
  const v = (value || '').trim();
  if (!v)          return 'Name is required.';
  if (v.length < 2)  return 'Name must be at least 2 characters.';
  if (v.length > 60) return 'Name must be 60 characters or fewer.';
  if (!/^[a-zA-Z\s'\u2019-]+$/.test(v))
    return 'Name may only contain letters, spaces, hyphens or apostrophes.';
  return null;
}

/**
 * Validates a phone number.
 * Rules: required, 7–15 digits (may include leading +, spaces, dashes, parens).
 * @param {string} value
 * @returns {string|null}
 */
export function validatePhone(value) {
  const v = (value || '').trim();
  if (!v) return 'Phone number is required.';
  const digits = v.replace(/[\s\-().+]/g, '');
  if (!/^\d+$/.test(digits))
    return 'Phone number may only contain digits, +, spaces, dashes or parentheses.';
  if (digits.length < 7 || digits.length > 15)
    return 'Phone number must be between 7 and 15 digits.';
  return null;
}

/**
 * Validates an email address.
 * Rules: required, must match standard email pattern.
 * @param {string} value
 * @returns {string|null}
 */
export function validateEmail(value) {
  const v = (value || '').trim();
  if (!v) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
    return 'Enter a valid email address.';
  return null;
}

/**
 * Validates a password.
 * Rules: required, min 8 chars, at least one uppercase, lowercase and digit.
 * @param {string} value
 * @returns {string|null}
 */
export function validatePassword(value) {
  const v = value || '';
  if (!v)           return 'Password is required.';
  if (v.length < 8)  return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(v)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(v)) return 'Password must contain at least one number.';
  return null;
}

/**
 * Validates that confirmPassword matches the given password.
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {string|null}
 */
export function validateConfirmPassword(password, confirmPassword) {
  const v = confirmPassword || '';
  if (!v)              return 'Please confirm your password.';
  if (v !== password)  return 'Passwords do not match.';
  return null;
}

// ── Whole-form validator ─────────────────────────────────────────────────────

/**
 * Runs all validators for the registration form.
 *
 * @param {{ name: string, phone: string, email: string,
 *            password: string, confirmPassword: string }} formData
 * @returns {{ [field: string]: string }}  Errors object (empty = all valid)
 */
export function validateRegisterForm(formData) {
  const { name, phone, email, password, confirmPassword } = formData;
  const errors = {};

  const e = {
    name:            validateName(name),
    phone:           validatePhone(phone),
    email:           validateEmail(email),
    password:        validatePassword(password),
    confirmPassword: validateConfirmPassword(password, confirmPassword),
  };

  Object.entries(e).forEach(([key, msg]) => {
    if (msg) errors[key] = msg;
  });

  return errors;
}

// ── Password strength meter ──────────────────────────────────────────────────

/**
 * Returns a strength descriptor for a password.
 *
 * @param {string} value
 * @returns {{ score: number, label: string, color: string }}
 *   score: 0 (empty) … 4 (strong)
 */
export function getPasswordStrength(value) {
  const v = value || '';
  if (!v) return { score: 0, label: '', color: 'transparent' };

  let score = 0;
  if (v.length >= 8)           score++;
  if (/[A-Z]/.test(v))         score++;
  if (/[a-z]/.test(v))         score++;
  if (/[0-9]/.test(v))         score++;
  if (/[^A-Za-z0-9]/.test(v))  score++; // bonus for special chars

  const LEVELS = [
    { score: 1, label: 'Weak',   color: '#f87171' },
    { score: 2, label: 'Fair',   color: '#fbbf24' },
    { score: 3, label: 'Good',   color: '#60a5fa' },
    { score: 4, label: 'Strong', color: '#4ade80' },
    { score: 5, label: 'Strong', color: '#4ade80' },
  ];

  // Clamp score to display range 1–4
  const displayScore = Math.min(score, 4);
  return { ...LEVELS[score - 1], score: displayScore };
}

// ── Login-specific validators ────────────────────────────────────────────────

/**
 * Validates the login identifier field (email OR phone number).
 * Accepts either format — backend decides which one it is.
 *
 * @param {string} value
 * @returns {string|null}
 */
export function validateIdentifier(value) {
  const v = (value || '').trim();
  if (!v) return 'Email or phone number is required.';

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  const digits = v.replace(/[\s\-().+]/g, '');
  const isPhone = /^\d+$/.test(digits) && digits.length >= 7 && digits.length <= 15;

  if (!isEmail && !isPhone) {
    return 'Enter a valid email address or phone number.';
  }
  return null;
}

/**
 * Validates the login password field.
 * Only checks presence — complexity rules are NOT applied on login.
 *
 * @param {string} value
 * @returns {string|null}
 */
export function validateLoginPassword(value) {
  if (!(value || '').trim()) return 'Password is required.';
  return null;
}

/**
 * Validates the full login form.
 *
 * @param {{ identifier: string, password: string }} formData
 * @returns {{ [field: string]: string }}  Errors object (empty = all valid)
 */
export function validateLoginForm(formData) {
  const { identifier, password } = formData;
  const errors = {};

  const idErr   = validateIdentifier(identifier);
  const passErr = validateLoginPassword(password);

  if (idErr)   errors.identifier = idErr;
  if (passErr) errors.password   = passErr;

  return errors;
}
