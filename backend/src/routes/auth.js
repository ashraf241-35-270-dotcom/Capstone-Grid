const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

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

// POST /api/auth/register - create a Student or Teacher account.
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, role, departmentId } = req.body || {};

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
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
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
// Password recovery endpoints are scheduled for a later step (FR-01 completion).

module.exports = router;
