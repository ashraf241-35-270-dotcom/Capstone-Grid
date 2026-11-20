const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'posts');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only JPG, PNG and WEBP images are allowed.'));
  }
});

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizePost(row) {
  return {
    postId: row.post_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    content: row.content,
    hasImage: Boolean(row.image_path),
    createdAt: row.created_at,
    opinionCount: Number(row.opinion_count || 0)
  };
}

router.get('/', async (_req, res) => {
  const rows = await query(
    `SELECT p.post_id, p.user_id, p.content, p.image_path, p.created_at,
            u.name AS author_name, u.role AS author_role,
            (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.post_id) AS opinion_count
       FROM posts p JOIN users u ON u.user_id = p.user_id
      ORDER BY p.created_at DESC, p.post_id DESC LIMIT 100`
  );
  return res.json({ posts: rows.map(normalizePost) });
});

router.post('/', requireAuth, (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Image upload failed.' });
    return next();
  });
}, async (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content && !req.file) {
    return res.status(400).json({ error: 'Write something or select an image before publishing.' });
  }
  if (content.length > 2000) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Post text must be 2,000 characters or fewer.' });
  }

  const imagePath = req.file ? req.file.filename : null;
  try {
    const result = await query(
      'INSERT INTO posts (user_id, content, image_path) VALUES (?, ?, ?)',
      [req.user.id, content, imagePath]
    );
    const rows = await query(
      `SELECT p.post_id, p.user_id, p.content, p.image_path, p.created_at,
              u.name AS author_name, u.role AS author_role, 0 AS opinion_count
         FROM posts p JOIN users u ON u.user_id = p.user_id WHERE p.post_id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ post: normalizePost(rows[0]) });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw err;
  }
});

router.get('/:id/image', async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid post id.' });
  const rows = await query('SELECT image_path FROM posts WHERE post_id = ? LIMIT 1', [postId]);
  if (!rows.length || !rows[0].image_path) return res.status(404).json({ error: 'Post image not found.' });
  const imagePath = path.join(uploadsDir, path.basename(rows[0].image_path));
  if (!fs.existsSync(imagePath)) return res.status(404).json({ error: 'Post image not found.' });
  return res.sendFile(imagePath);
});

router.get('/:id/opinions', async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid post id.' });
  const exists = await query('SELECT post_id FROM posts WHERE post_id = ? LIMIT 1', [postId]);
  if (!exists.length) return res.status(404).json({ error: 'Post not found.' });
  const rows = await query(
    `SELECT pc.comment_id, pc.post_id, pc.user_id, pc.opinion, pc.created_at,
            u.name AS author_name, u.role AS author_role
       FROM post_comments pc JOIN users u ON u.user_id = pc.user_id
      WHERE pc.post_id = ? ORDER BY pc.created_at ASC, pc.comment_id ASC`,
    [postId]
  );
  return res.json({ opinions: rows.map((row) => ({
    opinionId: row.comment_id,
    postId: row.post_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    opinion: row.opinion,
    createdAt: row.created_at
  })) });
});

router.post('/:id/opinions', requireAuth, async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid post id.' });
  const opinion = String(req.body.opinion || '').trim();
  if (!opinion) return res.status(400).json({ error: 'Opinion cannot be empty.' });
  if (opinion.length > 1000) return res.status(400).json({ error: 'Opinion must be 1,000 characters or fewer.' });
  const exists = await query('SELECT post_id FROM posts WHERE post_id = ? LIMIT 1', [postId]);
  if (!exists.length) return res.status(404).json({ error: 'Post not found.' });
  const result = await query(
    'INSERT INTO post_comments (post_id, user_id, opinion) VALUES (?, ?, ?)',
    [postId, req.user.id, opinion]
  );
  const rows = await query(
    `SELECT pc.comment_id, pc.post_id, pc.user_id, pc.opinion, pc.created_at,
            u.name AS author_name, u.role AS author_role
       FROM post_comments pc JOIN users u ON u.user_id = pc.user_id
      WHERE pc.comment_id = ? LIMIT 1`,
    [result.insertId]
  );
  const row = rows[0];
  return res.status(201).json({ opinion: {
    opinionId: row.comment_id,
    postId: row.post_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    opinion: row.opinion,
    createdAt: row.created_at
  } });
});

module.exports = router;
