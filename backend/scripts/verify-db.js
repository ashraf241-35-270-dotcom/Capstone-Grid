const config = require('../src/config');
const { initSchema, query, closePool } = require('../src/db');

async function main() {
  try {
    await initSchema();
    const [departments] = await query('SELECT COUNT(*) AS total FROM departments');
    const [users] = await query('SELECT COUNT(*) AS total FROM users');
    const [reviews] = await query('SELECT COUNT(*) AS total FROM reviews');
    const [comments] = await query('SELECT COUNT(*) AS total FROM project_comments');
    const [notifications] = await query('SELECT COUNT(*) AS total FROM notifications');
    const [posts] = await query('SELECT COUNT(*) AS total FROM posts');
    const [postComments] = await query('SELECT COUNT(*) AS total FROM post_comments');
    const tables = config.dbClient === 'sqlite'
      ? await query("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      : await query(
        `SELECT COUNT(*) AS total FROM information_schema.tables
          WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
        [config.db.database]
      );
    const databaseName = config.dbClient === 'sqlite' ? config.sqlitePath : config.db.database;

    console.log(`Connected to ${config.dbClient} database "${databaseName}".`);
    console.log(
      `Tables: ${tables[0].total} | Departments: ${departments.total} | Users: ${users.total}` +
      ` | Reviews: ${reviews.total} | Comments: ${comments.total} | Notifications: ${notifications.total}` +
      ` | Posts: ${posts.total} | Post opinions: ${postComments.total}`
    );
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(`Database check failed: ${err.code ? `${err.code}: ` : ''}${err.message}`);
  process.exit(1);
});
