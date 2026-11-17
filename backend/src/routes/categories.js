const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/categories - public project category list.
router.get('/', async (req, res) => {
  const categories = await query('SELECT category_id, name FROM categories ORDER BY name ASC');
  return res.json({ categories });
});

module.exports = router;
