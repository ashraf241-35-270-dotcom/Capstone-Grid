const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.DB_FILE = path.join(os.tmpdir(), `capstone-grid-auth-${process.pid}.sqlite`);
process.env.JWT_SECRET = 'test-only-password-recovery-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'capstone-test';
process.env.SMTP_PASSWORD = 'test-only-smtp-password';
process.env.MAIL_FROM = 'Capstone Grid <no-reply@example.test>';

const databasePath = process.env.DB_FILE;
fs.rmSync(databasePath, { force: true });

jest.mock('../src/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
}));

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { closePool, initSchema, query } = require('../src/db');
const authRoutes = require('../src/routes/auth');
const mailer = require('../src/mailer');

const userEmail = 'recovery-user@example.test';
const originalPassword = 'OriginalPassword123';
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

function resetTokenFromEmail() {
  const { resetUrl } = mailer.sendPasswordResetEmail.mock.calls.at(-1)[0];
  const fragment = new URL(resetUrl).hash;
  return new URLSearchParams(fragment.slice(fragment.indexOf('?') + 1)).get('token');
}

describe('password recovery', () => {
  beforeAll(async () => {
    await initSchema();
    const passwordHash = await bcrypt.hash(originalPassword, 12);
    await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Recovery Test User', userEmail, passwordHash, 'Student']
    );
  });

  afterEach(() => {
    mailer.sendPasswordResetEmail.mockReset();
    mailer.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await closePool();
    await fs.promises.rm(databasePath, { force: true });
    await fs.promises.rm(`${databasePath}-journal`, { force: true });
  });

  test('uses the same response for existing and unknown email addresses and stores only a token hash', async () => {
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: userEmail.toUpperCase() });
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.test' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const resetEmail = mailer.sendPasswordResetEmail.mock.calls[0][0];
    expect(resetEmail.to).toBe(userEmail);
    expect(new URL(resetEmail.resetUrl).origin).toBe(process.env.CLIENT_ORIGIN);
    expect(new URL(resetEmail.resetUrl).hash).toContain('/reset-password?token=');

    const token = resetTokenFromEmail();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const resetRows = await query(
      'SELECT token_hash, expires_at, used FROM password_resets WHERE user_id = (SELECT user_id FROM users WHERE email = ?) ORDER BY reset_id DESC LIMIT 1',
      [userEmail]
    );
    expect(resetRows[0].token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(resetRows[0].token_hash).not.toBe(token);
    expect(Number(resetRows[0].used)).toBe(0);
    expect(Date.parse(`${String(resetRows[0].expires_at).replace(' ', 'T')}Z`)).toBeGreaterThan(Date.now());
  });

  test('resets the password once and allows login with the new password', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: userEmail }).expect(202);
    const token = resetTokenFromEmail();
    const newPassword = 'ReplacementPassword123';

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(200);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'AnotherPassword123' })
      .expect(400);

    const userRows = await query('SELECT password_hash FROM users WHERE email = ? LIMIT 1', [userEmail]);
    expect(await bcrypt.compare(newPassword, userRows[0].password_hash)).toBe(true);
    await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: newPassword, role: 'Student' })
      .expect(200);
  });

  test('rejects malformed, expired, and invalid reset tokens', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad-token', password: 'ValidPassword123' })
      .expect(400);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const userRows = await query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [userEmail]);
    const expiresAt = new Date(Date.now() - 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userRows[0].user_id, tokenHash, expiresAt]
    );

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'ValidPassword123' })
      .expect(400);
  });

  test('invalidates an unsent token and reports SMTP delivery failures', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mailer.sendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    try {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: userEmail })
        .expect(503);
      expect(response.body.error).toMatch(/temporarily unavailable/i);
      expect(logError).toHaveBeenCalled();
      const tokenRows = await query(
        'SELECT used FROM password_resets WHERE user_id = (SELECT user_id FROM users WHERE email = ?) ORDER BY reset_id DESC LIMIT 1',
        [userEmail]
      );
      expect(Number(tokenRows[0].used)).toBe(1);
    } finally {
      logError.mockRestore();
    }
  });

  test('validates email and new-password length', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'short' })
      .expect(400);
  });
});
