const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/courses - public course catalog, optionally filtered by department.
router.get('/', async (req, res) => {
  const params = [];
  let sql = `SELECT c.course_id, c.course_code, c.title, c.department_id, d.name AS department_name
               FROM courses c
               JOIN departments d ON d.department_id = c.department_id`;

  if (req.query.departmentId !== undefined) {
    const departmentId = Number(req.query.departmentId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ error: 'departmentId must be a positive integer.' });
    }
    sql += ' WHERE c.department_id = ?';
    params.push(departmentId);
  }

  sql += ' ORDER BY d.name ASC, c.course_code ASC';
  const courses = await query(sql, params);
  return res.json({ courses });
});

module.exports = router;
