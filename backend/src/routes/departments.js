const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/departments - public list used by registration and filters.
router.get('/', async (req, res) => {
  const departments = await query(
    'SELECT department_id, name FROM departments ORDER BY name ASC'
  );
  res.json({ departments });
});

module.exports = router;
