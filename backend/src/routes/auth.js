const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query, transaction } = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../mailer');

const router = express.Router();

const ROLES = ['Student', 'Teacher'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email does not exist, so both paths take similar time.
const DUMMY_HASH = bcrypt.hashSync('capstone-grid-placeholder-password', 12);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in a few minutes.' }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many password recovery attempts. Please try again in a few minutes.' }
});
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many password recovery attempts. Please try again in a few minutes.' }
});

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

function signToken(user) {
  return jwt.sign(
    { id: user.user_id, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function toPublicUser(row) {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    departmentId: row.department_id,
    department: row.department_name || null,
    createdAt: row.created_at
  };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function databaseUtcDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function resetTokenIsExpired(value) {
  const dateValue = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const expiresAt = Date.parse(dateValue);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

// POST /api/auth/register - create a Student or Teacher account.
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, role, departmentId, departmentName } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required.' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 120) {
    return res.status(400).json({ error: 'Name must be between 2 and 120 characters.' });
  }
  if (cleanEmail.length > 190 || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be Student or Teacher.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be 72 bytes or fewer.' });
  }

  let cleanDepartmentId = null;
  if (departmentName !== undefined && departmentName !== null && departmentName !== '') {
    if (typeof departmentName !== 'string' || (departmentId !== undefined && departmentId !== null && departmentId !== '')) {
      return res.status(400).json({ error: 'Please choose a valid department.' });
    }

    const cleanDepartmentName = departmentName.trim();
    if (!cleanDepartmentName || cleanDepartmentName.length > 150) {
      return res.status(400).json({ error: 'Please choose a valid department.' });
    }

    const departments = await query(
      'SELECT department_id FROM departments WHERE name = ? LIMIT 1',
      [cleanDepartmentName]
    );
    if (departments.length === 0) {
      return res.status(400).json({ error: 'The selected department does not exist.' });
    }
    cleanDepartmentId = departments[0].department_id;
  } else if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    cleanDepartmentId = Number(departmentId);
    if (!Number.isInteger(cleanDepartmentId) || cleanDepartmentId <= 0) {
      return res.status(400).json({ error: 'Please choose a valid department.' });
    }
    const departments = await query(
      'SELECT department_id FROM departments WHERE department_id = ? LIMIT 1',
      [cleanDepartmentId]
    );
    if (departments.length === 0) {
      return res.status(400).json({ error: 'The selected department does not exist.' });
    }
  }

  const existing = await query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (department_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [cleanDepartmentId, cleanName, cleanEmail, passwordHash, role]
  );

  return res.status(201).json({
    message: 'Account created. You can now log in.',
    user: { userId: result.insertId, name: cleanName, email: cleanEmail, role }
  });
});

// POST /api/auth/login - role must match the account (separate Student/Teacher login).
router.post('/login', authLimiter, async (req, res) => {
  const { email, password, role } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !role) {
    return res.status(400).json({ error: 'Email, password and role are required.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be Student or Teacher.' });
  }

  const rows = await query(
    `SELECT u.user_id, u.name, u.email, u.password_hash, u.role, u.department_id, u.created_at,
            d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE u.email = ?
      LIMIT 1`,
    [email.trim().toLowerCase()]
  );

  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || user.role !== role || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email, password or role.' });
  }

  return res.json({ token: signToken(user), user: toPublicUser(user) });
});

// POST /api/auth/forgot-password - send a one-time reset link without revealing account existence.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!config.emailConfigured) {
    return res.status(503).json({ error: 'Password recovery is not configured. Please contact the administrator.' });
  }

  const users = await query(
    'SELECT user_id, name, email FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  if (users.length === 0) {
    return res.status(202).json({ message: GENERIC_RESET_MESSAGE });
  }

  const user = users[0];
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = databaseUtcDate(new Date(Date.now() + RESET_TOKEN_LIFETIME_MS));
  await transaction(async (execute) => {
    await execute('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.user_id]);
    await execute(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)',
      [user.user_id, tokenHash, expiresAt]
    );
  });

  const clientUrl = config.clientOrigin.replace(/\/+$/, '');
  const resetUrl = `${clientUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  } catch (err) {
    await query('UPDATE password_resets SET used = 1 WHERE token_hash = ?', [tokenHash]);
    console.error('[auth] Password reset email could not be sent:', err.message);
    return res.status(503).json({ error: 'Password recovery is temporarily unavailable. Please try again later.' });
  }

  return res.status(202).json({ message: GENERIC_RESET_MESSAGE });
});

// POST /api/auth/reset-password - consume a valid one-time token and replace the password.
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'The reset link is invalid or expired.' });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and 72 bytes or fewer.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const tokenHash = hashResetToken(token);
  const updated = await transaction(async (execute) => {
    const resets = await execute(
      'SELECT reset_id, user_id, expires_at, used FROM password_resets WHERE token_hash = ? LIMIT 1',
      [tokenHash]
    );
    const reset = resets[0];
    if (!reset || Number(reset.used) !== 0 || resetTokenIsExpired(reset.expires_at)) {
      return false;
    }

    const consumed = await execute(
      'UPDATE password_resets SET used = 1 WHERE reset_id = ? AND used = 0',
      [reset.reset_id]
    );
    if (consumed.affectedRows !== 1) return false;

    await execute(
      'UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0',
      [reset.user_id]
    );
    const changed = await execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [passwordHash, reset.user_id]
    );
    if (changed.affectedRows !== 1) {
      throw new Error('Password reset account could not be updated.');
    }
    return true;
  });

  if (!updated) {
    return res.status(400).json({ error: 'The reset link is invalid or expired.' });
  }

  return res.json({ message: 'Password updated. You can now log in with your new password.' });
});

// GET /api/auth/me - returns the authenticated user's profile.
router.get('/me', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT u.user_id, u.name, u.email, u.role, u.department_id, u.created_at,
            d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE u.user_id = ?
      LIMIT 1`,
    [req.user.id]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Account no longer exists.' });
  }

  return res.json({ user: toPublicUser(rows[0]) });
});

// Logout is client-side: the JWT is stateless, so the client discards its token.
module.exports = router;
