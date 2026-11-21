const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { query, initSchema, closePool } = require('../src/db');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const REPORT_NAME = 'demo-accessible-campus-report.txt';
const REPORT_CONTENT = [
  'Capstone Grid demo archive report',
  '',
  'Project: Accessible Campus Navigator',
  'This sample report demonstrates a downloadable archived project file.',
  ''
].join('\n');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo data cannot be seeded in production.');
}
if (typeof DEMO_PASSWORD !== 'string' || Buffer.byteLength(DEMO_PASSWORD, 'utf8') < 8
  || Buffer.byteLength(DEMO_PASSWORD, 'utf8') > 72) {
  throw new Error('Set DEMO_PASSWORD to a value between 8 and 72 bytes before seeding demo data.');
}

async function ensureUser({ email, name, role, departmentId, passwordHash }) {
  const rows = await query('SELECT user_id, role FROM users WHERE email = ? LIMIT 1', [email]);
  if (rows.length > 0) {
    if (rows[0].role !== role) {
      throw new Error(`The demo email ${email} is already assigned to a different role.`);
    }
    return rows[0].user_id;
  }

  const result = await query(
    'INSERT INTO users (department_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [departmentId, name, email, passwordHash, role]
  );
  return result.insertId;
}

async function ensureProject({ studentId, sectionId, categoryId, title, description, status }) {
  const rows = await query(
    'SELECT project_id, status, visibility FROM projects WHERE student_id = ? AND title = ? LIMIT 1',
    [studentId, title]
  );
  if (rows.length > 0) {
    if (rows[0].status !== status || rows[0].visibility !== 'Public') {
      throw new Error(`The demo project "${title}" exists with different status or visibility.`);
    }
    return rows[0].project_id;
  }

  const isArchived = status === 'Archived';
  const result = await query(
    `INSERT INTO projects (student_id, section_id, category_id, title, description, status, visibility${isArchived ? ', archived_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, 'Public'${isArchived ? ', CURRENT_TIMESTAMP' : ''})`,
    [studentId, sectionId, categoryId, title, description, status]
  );
  return result.insertId;
}

async function main() {
  try {
    await initSchema();
    const departments = await query(
      "SELECT department_id FROM departments WHERE name = 'Computer Science and Engineering' LIMIT 1"
    );
    if (departments.length === 0) throw new Error('The Computer Science department is missing.');
    const departmentId = departments[0].department_id;

    const courses = await query(
      "SELECT course_id FROM courses WHERE department_id = ? ORDER BY course_id LIMIT 1",
      [departmentId]
    );
    const categories = await query('SELECT category_id FROM categories ORDER BY category_id LIMIT 1');
    if (courses.length === 0 || categories.length === 0) {
      throw new Error('A demo course or project category is missing from the database.');
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const studentId = await ensureUser({
      email: 'demo-student@capstone-grid.test',
      name: 'Jordan Lee (Demo Student)',
      role: 'Student',
      departmentId,
      passwordHash
    });
    const teacherId = await ensureUser({
      email: 'demo-teacher@capstone-grid.test',
      name: 'Morgan Patel (Demo Teacher)',
      role: 'Teacher',
      departmentId,
      passwordHash
    });

    const sections = await query(
      "SELECT section_id FROM sections WHERE course_id = ? AND teacher_id = ? AND section_name = 'DEMO-01' AND semester = 'DEMO' LIMIT 1",
      [courses[0].course_id, teacherId]
    );
    const sectionId = sections.length > 0
      ? sections[0].section_id
      : (await query(
        'INSERT INTO sections (course_id, teacher_id, section_name, semester) VALUES (?, ?, ?, ?)',
        [courses[0].course_id, teacherId, 'DEMO-01', 'DEMO']
      )).insertId;

    const enrollments = await query(
      'SELECT enrollment_id FROM enrollments WHERE section_id = ? AND student_id = ? LIMIT 1',
      [sectionId, studentId]
    );
    if (enrollments.length === 0) {
      await query('INSERT INTO enrollments (section_id, student_id) VALUES (?, ?)', [sectionId, studentId]);
    }

    await ensureProject({
      studentId,
      sectionId,
      categoryId: categories[0].category_id,
      title: 'Campus Energy Monitor (Demo)',
      description: 'A sample public capstone project for monitoring campus energy use.',
      status: 'Accepted'
    });
    const archivedProjectId = await ensureProject({
      studentId,
      sectionId,
      categoryId: categories[0].category_id,
      title: 'Accessible Campus Navigator (Demo)',
      description: 'A sample archived project with a downloadable report.',
      status: 'Archived'
    });

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const reportPath = path.join(uploadsDir, REPORT_NAME);
    if (fs.existsSync(reportPath)) {
      const currentReport = await fs.promises.readFile(reportPath, 'utf8');
      if (currentReport !== REPORT_CONTENT) {
        throw new Error(`The demo report path is already occupied: ${reportPath}`);
      }
    } else {
      await fs.promises.writeFile(reportPath, REPORT_CONTENT, { flag: 'wx' });
    }
    const reportRows = await query(
      'SELECT file_id FROM project_files WHERE project_id = ? AND original_name = ? LIMIT 1',
      [archivedProjectId, REPORT_NAME]
    );
    if (reportRows.length === 0) {
      await query(
        'INSERT INTO project_files (project_id, file_name, original_name, mime_type, file_size, file_path) VALUES (?, ?, ?, ?, ?, ?)',
        [archivedProjectId, REPORT_NAME, REPORT_NAME, 'text/plain', Buffer.byteLength(REPORT_CONTENT), reportPath]
      );
    }

    console.log('Demo data is ready:');
    console.log('  Student: demo-student@capstone-grid.test');
    console.log('  Teacher: demo-teacher@capstone-grid.test');
    console.log('  Password for new accounts: the supplied DEMO_PASSWORD value.');
    console.log('  Re-running the seed does not change existing demo account passwords.');
    console.log('  The public Explore page contains one accepted project and one archived project with a report.');
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(`[db:seed-demo] ${err.message}`);
  process.exitCode = 1;
});
