const nodemailer = require('nodemailer');
const config = require('./config');

const transport = config.emailConfigured
  ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user ? {
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password
      }
    } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  })
  : null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!transport) {
    throw new Error('SMTP is not configured for password recovery.');
  }

  const safeName = escapeHtml(name);
  return transport.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Reset your Capstone Grid password',
    text: `Hello ${name},\n\nUse this link to reset your Capstone Grid password. The link expires in 30 minutes and can only be used once:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Use this link to reset your Capstone Grid password. The link expires in 30 minutes and can only be used once.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
}

module.exports = { sendPasswordResetEmail };
