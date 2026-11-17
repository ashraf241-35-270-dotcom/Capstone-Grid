const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalize(section) {
  return { ...section, student_count: Number(section.student_count || 0) };
}

async function findSection(sectionId) {
  const rows = await query(
    `SELECT s.section_id, s.course_id, s.teacher_id, s.section_name, s.semester, s.created_at,
            c.course_code, c.title AS course_title,
            c.department_id, d.name AS department_name,
            t.name AS teacher_name, t.email AS teacher_email,
            (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.section_id) AS student_count
       FROM sections s
       JOIN courses c ON c.course_id = s.course_id
       JOIN departments d ON d.department_id = c.department_id
       JOIN users t ON t.user_id = s.teacher_id
      WHERE s.section_id = ?
      LIMIT 1`,
    [sectionId]
  );

  return rows.length ? normalize(rows[0]) : null;
}

async function loadRoster(sectionId) {
  return query(
    `SELECT e.enrollment_id, e.enrolled_at,
            u.user_id AS student_id, u.name, u.email,
            d.name AS department_name
       FROM enrollments e
       JOIN users u ON u.user_id = e.student_id
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE e.section_id = ?
      ORDER BY u.name ASC`,
    [sectionId]
  );
}

// GET /api/sections - teachers see their own sections, students see enrolled sections.
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'Teacher') {
    const sections = await query(
      `SELECT s.section_id, s.section_name, s.semester, s.created_at,
              s.course_id, c.course_code, c.title AS course_title,
              c.department_id, d.name AS department_name,
              s.teacher_id, t.name AS teacher_name,
              COUNT(e.enrollment_id) AS student_count
         FROM sections s
         JOIN courses c ON c.course_id = s.course_id
         JOIN departments d ON d.department_id = c.department_id
         JOIN users t ON t.user_id = s.teacher_id
         LEFT JOIN enrollments e ON e.section_id = s.section_id
        WHERE s.teacher_id = ?
        GROUP BY s.section_id, s.section_name, s.semester, s.created_at,
                 s.course_id, c.course_code, c.title, c.department_id, d.name,
                 s.teacher_id, t.name
        ORDER BY s.semester DESC, c.course_code ASC, s.section_name ASC`,
      [req.user.id]
    );
    return res.json({ sections: sections.map(normalize) });
  }

  const sections = await query(
    `SELECT s.section_id, s.section_name, s.semester, s.created_at,
            s.course_id, c.course_code, c.title AS course_title,
            c.department_id, d.name AS department_name,
            s.teacher_id, t.name AS teacher_name, t.email AS teacher_email,
            (SELECT COUNT(*) FROM enrollments e2 WHERE e2.section_id = s.section_id) AS student_count
       FROM enrollments e
       JOIN sections s ON s.section_id = e.section_id
       JOIN courses c ON c.course_id = s.course_id
       JOIN departments d ON d.department_id = c.department_id
       JOIN users t ON t.user_id = s.teacher_id
      WHERE e.student_id = ?
      ORDER BY s.semester DESC, c.course_code ASC, s.section_name ASC`,
    [req.user.id]
  );
  return res.json({ sections: sections.map(normalize) });
});

// POST /api/sections - a teacher creates a section for a course and semester.
router.post('/', requireAuth, requireRole('Teacher'), async (req, res) => {
  const { courseId, sectionName, semester } = req.body || {};

  const cleanCourseId = parseId(courseId);
  if (!cleanCourseId) {
    return res.status(400).json({ error: 'Please choose a valid course.' });
  }

  const cleanName = typeof sectionName === 'string' ? sectionName.trim() : '';
  const cleanSemester = typeof semester === 'string' ? semester.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({ error: 'Section name must be between 2 and 80 characters.' });
  }
  if (cleanSemester.length < 2 || cleanSemester.length > 50) {
    return res.status(400).json({ error: 'Semester must be between 2 and 50 characters.' });
  }

  const courses = await query('SELECT course_id FROM courses WHERE course_id = ? LIMIT 1', [cleanCourseId]);
  if (courses.length === 0) {
    return res.status(400).json({ error: 'The selected course does not exist.' });
  }

  const duplicates = await query(
    'SELECT section_id FROM sections WHERE course_id = ? AND semester = ? AND section_name = ? LIMIT 1',
    [cleanCourseId, cleanSemester, cleanName]
  );
  if (duplicates.length > 0) {
    return res.status(409).json({ error: 'That section already exists for this course and semester.' });
  }

  const result = await query(
    'INSERT INTO sections (course_id, teacher_id, section_name, semester) VALUES (?, ?, ?, ?)',
    [cleanCourseId, req.user.id, cleanName, cleanSemester]
  );

  const section = await findSection(result.insertId);
  return res.status(201).json({ section });
});

// GET /api/sections/:id - owner teacher gets the roster; enrolled students get section details.
router.get('/:id', requireAuth, async (req, res) => {
  const sectionId = parseId(req.params.id);
  if (!sectionId) {
    return res.status(400).json({ error: 'Invalid section id.' });
  }

  const section = await findSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found.' });
  }

  if (req.user.role === 'Teacher') {
    if (section.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view your own sections.' });
    }
    const students = await loadRoster(sectionId);
    return res.json({ section, students });
  }

  const enrolled = await query(
    'SELECT enrollment_id FROM enrollments WHERE section_id = ? AND student_id = ? LIMIT 1',
    [sectionId, req.user.id]
  );
  if (enrolled.length === 0) {
    return res.status(403).json({ error: 'You are not enrolled in this section.' });
  }

  return res.json({ section });
});

// POST /api/sections/:id/enrollments - teacher enrolls a student by email.
router.post('/:id/enrollments', requireAuth, requireRole('Teacher'), async (req, res) => {
  const sectionId = parseId(req.params.id);
  if (!sectionId) {
    return res.status(400).json({ error: 'Invalid section id.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid student email address.' });
  }

  const section = await findSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found.' });
  }
  if (section.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only manage your own sections.' });
  }

  const students = await query(
    'SELECT user_id, name, email, role FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  if (students.length === 0) {
    return res.status(404).json({ error: 'No account exists with that email address.' });
  }

  const student = students[0];
  if (student.role !== 'Student') {
    return res.status(400).json({ error: 'Only Student accounts can be enrolled in a section.' });
  }

  const existing = await query(
    'SELECT enrollment_id FROM enrollments WHERE section_id = ? AND student_id = ? LIMIT 1',
    [sectionId, student.user_id]
  );
  if (existing.length > 0) {
    return res.status(409).json({ error: 'That student is already enrolled in this section.' });
  }

  const result = await query(
    'INSERT INTO enrollments (section_id, student_id) VALUES (?, ?)',
    [sectionId, student.user_id]
  );

  const rows = await query(
    `SELECT e.enrollment_id, e.enrolled_at,
            u.user_id AS student_id, u.name, u.email,
            d.name AS department_name
       FROM enrollments e
       JOIN users u ON u.user_id = e.student_id
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE e.enrollment_id = ?
      LIMIT 1`,
    [result.insertId]
  );

  return res.status(201).json({ student: rows[0] });
});

// DELETE /api/sections/:id/enrollments/:studentId - teacher removes a student.
router.delete('/:id/enrollments/:studentId', requireAuth, requireRole('Teacher'), async (req, res) => {
  const sectionId = parseId(req.params.id);
  const studentId = parseId(req.params.studentId);
  if (!sectionId || !studentId) {
    return res.status(400).json({ error: 'Invalid section or student id.' });
  }

  const section = await findSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found.' });
  }
  if (section.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only manage your own sections.' });
  }

  const result = await query(
    'DELETE FROM enrollments WHERE section_id = ? AND student_id = ?',
    [sectionId, studentId]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'That student is not enrolled in this section.' });
  }

  return res.status(204).end();
});

// DELETE /api/sections/:id - delete an empty section owned by the teacher.
router.delete('/:id', requireAuth, requireRole('Teacher'), async (req, res) => {
  const sectionId = parseId(req.params.id);
  if (!sectionId) {
    return res.status(400).json({ error: 'Invalid section id.' });
  }

  const section = await findSection(sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found.' });
  }
  if (section.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only manage your own sections.' });
  }
  if (section.student_count > 0) {
    return res.status(409).json({ error: 'Remove all enrolled students before deleting this section.' });
  }

  await query('DELETE FROM sections WHERE section_id = ?', [sectionId]);
  return res.status(204).end();
});

module.exports = router;
