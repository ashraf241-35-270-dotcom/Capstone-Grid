const fs = require('fs');
const path = require('path');
const config = require('./config');

config.assertEnv();

let mysql;
let pool;
let sqlite;

if (config.dbClient === 'mysql') {
  mysql = require('mysql2/promise');
  pool = mysql.createPool(config.db);
} else {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  sqlite = new DatabaseSync(config.sqlitePath);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
}

async function initSchema() {
  const schemaFile = config.dbClient === 'mysql' ? 'schema.sql' : 'schema.sqlite.sql';
  const schemaPath = path.join(__dirname, '..', '..', 'database', schemaFile);
  const schema = fs.readFileSync(schemaPath, 'utf8');

  if (config.dbClient === 'mysql') {
    const connection = await mysql.createConnection({ ...config.db, multipleStatements: true });
    try {
      await connection.query(schema);
    } finally {
      await connection.end();
    }
  } else {
    sqlite.exec(schema);
  }

  const databaseName = config.dbClient === 'mysql' ? config.db.database : config.sqlitePath;
  console.log(`[db] Schema ready in ${config.dbClient} database "${databaseName}".`);
}

async function queryOn(executor, sql, params = []) {
  if (config.dbClient === 'mysql') {
    const [result] = await executor.execute(sql, params);
    if (Array.isArray(result)) return result;
    return {
      insertId: Number(result.insertId),
      affectedRows: result.affectedRows,
      changes: result.affectedRows
    };
  }
  const statement = sqlite.prepare(sql);
  if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) {
    return statement.all(...params);
  }

  const result = statement.run(...params);
  return {
    insertId: Number(result.lastInsertRowid),
    affectedRows: result.changes,
    changes: result.changes
  };
}

async function query(sql, params = []) {
  return queryOn(pool, sql, params);
}

async function transaction(callback) {
  if (config.dbClient === 'mysql') {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback((sql, params = []) => queryOn(connection, sql, params));
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const result = await callback(query);
    sqlite.exec('COMMIT');
    return result;
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
}

async function closePool() {
  if (config.dbClient === 'mysql') {
    await pool.end();
  } else {
    sqlite.close();
  }
}

module.exports = { query, transaction, initSchema, closePool };
