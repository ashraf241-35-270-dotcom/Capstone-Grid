const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const dbClient = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
const projectRoot = path.resolve(__dirname, '..', '..');

function assertEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    missing.push('JWT_SECRET');
  }
  if (dbClient === 'mysql') {
    missing.push(...['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
      .filter((key) => !process.env[key]));
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
  }
  if (!['sqlite', 'mysql'].includes(dbClient)) {
    throw new Error('DB_CLIENT must be either "sqlite" or "mysql".');
  }
}

module.exports = {
  assertEnv,
  dbClient,
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  sqlitePath: path.resolve(
    projectRoot,
    process.env.DB_FILE || path.join('backend', 'data', 'capstone-grid.sqlite')
  ),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    charset: 'utf8mb4'
  }
};
