const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });

  try {
    const [[departments]] = await connection.query('SELECT COUNT(*) AS total FROM departments');
    const [[users]] = await connection.query('SELECT COUNT(*) AS total FROM users');
    const [[tables]] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables
        WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [config.db.database]
    );

    console.log(`Connected to MySQL database "${config.db.database}".`);
    console.log(`Tables: ${tables.total} | Departments: ${departments.total} | Users: ${users.total}`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`Database check failed: ${err.code ? `${err.code}: ` : ''}${err.message}`);
  process.exit(1);
});
