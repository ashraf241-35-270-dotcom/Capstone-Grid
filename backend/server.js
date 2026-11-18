const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config');
const { initSchema, query, closePool } = require('./src/db');
const authRoutes = require('./src/routes/auth');
const departmentRoutes = require('./src/routes/departments');
const courseRoutes = require('./src/routes/courses');
const categoryRoutes = require('./src/routes/categories');
const sectionRoutes = require('./src/routes/sections');
const projectRoutes = require('./src/routes/projects');
const notificationRoutes = require('./src/routes/notifications');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === config.clientOrigin || origin === 'http://127.0.0.1:5173') {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      try {
        const url = new URL(origin);
        if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
          return callback(null, true);
        }
      } catch {
        return callback(null, false);
      }
    }

    return callback(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', service: 'capstone-grid-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (err.code === 'ER_DUP_ENTRY' || err.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'That record already exists.' });
  }

  console.error('[api]', err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function start() {
  try {
    await initSchema();
  } catch (err) {
    console.error('\n[db] Could not connect to or initialize MySQL.');
    console.error(`[db] ${err.code ? `${err.code}: ` : ''}${err.message}`);
    console.error('[db] Run "npm run db:setup" from the project root, then start again.\n');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Capstone Grid API running at http://localhost:${config.port}`);
  });
}

async function shutdown() {
  await closePool();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
