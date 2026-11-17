const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./config');

config.assertEnv();

const pool = mysql.createPool(config.db);

async function initSchema() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    await connection.query(schema);
  } finally {
    await connection.end();
  }

  console.log(`[db] Schema ready in database "${config.db.database}".`);
}

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, initSchema, closePool };
