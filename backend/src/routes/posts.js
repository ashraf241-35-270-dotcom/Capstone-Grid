const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'posts');
const IMAGE_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${crypto.randomBytes(18).toString('hex')}${extension}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extensions = IMAGE_EXTENSIONS[file.mimetype];
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extensions || !extensions.includes(extension)) {
      return callback(new Error('Choose a PNG, JPEG, or WebP image.'));
    }
    return callback(null, true);
  }
});

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Post images must be 5 MB or smaller.' });
    }
    return res.status(400).json({ error: err.message || 'Could not upload the post image.' });
  });
}

async function removeUpload(file) {
  if (file) await fs.promises.unlink(file.path);
}

async function detectImageType(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return 'image/png';
    }
    if (bytesRead >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255) {
      return 'image/jpeg';
    }
    if (bytesRead >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    return null;
  } finally {
    await handle.close();
  }
}

function normalizeComment(comment) {
  return {
    commentId: comment.comment_id,
    authorName: comment.author_name,
    authorRole: comment.author_role,
    opinion: comment.opinion,
    createdAt: comment.created_at
  };
}

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT p.post_id, p.user_id, p.content, p.image_file_name, p.created_at,
            u.name AS author_name, u.role AS author_role
       FROM posts p
       JOIN users u ON u.user_id = p.user_id
      ORDER BY p.created_at DESC, p.post_id DESC
      LIMIT 30`
  );
  if (rows.length === 0) return res.json({ posts: [] });

  const postIds = rows.map((post) => post.post_id);
  const comments = await query(
    `SELECT c.comment_id, c.post_id, c.opinion, c.created_at,
            u.name AS author_name, u.role AS author_role
       FROM post_comments c
       JOIN users u ON u.user_id = c.user_id
      WHERE c.post_id IN (${postIds.map(() => '?').join(', ')})
      ORDER BY c.created_at ASC, c.comment_id ASC`,
    postIds
  );
  const commentsByPost = new Map();
  for (const comment of comments) {
    const postComments = commentsByPost.get(comment.post_id) || [];
    postComments.push(normalizeComment(comment));
    commentsByPost.set(comment.post_id, postComments);
  }

  return res.json({
    posts: rows.map((post) => ({
      postId: post.post_id,
      authorName: post.author_name,
      authorRole: post.author_role,
      content: post.content,
      imageUrl: post.image_file_name ? `/posts/${post.post_id}/image` : null,
      createdAt: post.created_at,
      comments: commentsByPost.get(post.post_id) || []
    }))
  });
});

router.post('/', requireAuth, handleImageUpload, async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (content.length > 2000) {
    await removeUpload(req.file);
    return res.status(400).json({ error: 'Post text must be 2000 characters or fewer.' });
  }
  if (!content && !req.file) {
    return res.status(400).json({ error: 'Add text or choose an image for your post.' });
  }

  if (req.file) {
    const detectedType = await detectImageType(req.file.path);
    if (detectedType !== req.file.mimetype) {
      await removeUpload(req.file);
      return res.status(400).json({ error: 'The uploaded file is not a valid PNG, JPEG, or WebP image.' });
    }
  }

  let result;
  try {
    result = await query(
      'INSERT INTO posts (user_id, content, image_file_name, image_mime_type) VALUES (?, ?, ?, ?)',
      [req.user.id, content || null, req.file?.filename || null, req.file?.mimetype || null]
    );
  } catch (err) {
    await removeUpload(req.file);
    throw err;
  }

  const rows = await query(
    `SELECT p.post_id, p.content, p.image_file_name, p.created_at,
            u.name AS author_name, u.role AS author_role
       FROM posts p
       JOIN users u ON u.user_id = p.user_id
      WHERE p.post_id = ?
      LIMIT 1`,
    [result.insertId]
  );
  const post = rows[0];
  return res.status(201).json({
    post: {
      postId: post.post_id,
      authorName: post.author_name,
      authorRole: post.author_role,
      content: post.content,
      imageUrl: post.image_file_name ? `/posts/${post.post_id}/image` : null,
      createdAt: post.created_at,
      comments: []
    }
  });
});

router.get('/:id/image', async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid post id.' });

  const rows = await query(
    'SELECT image_file_name, image_mime_type FROM posts WHERE post_id = ? LIMIT 1',
    [postId]
  );
  if (rows.length === 0 || !rows[0].image_file_name) {
    return res.status(404).json({ error: 'Post image not found.' });
  }

  const imagePath = path.join(uploadsDir, rows[0].image_file_name);
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Post image is no longer available.' });
  }
  res.set({
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff'
  });
  res.type(rows[0].image_mime_type);
  return res.sendFile(imagePath);
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const postId = parseId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid post id.' });

  const opinion = typeof req.body?.opinion === 'string' ? req.body.opinion.trim() : '';
  if (opinion.length < 1 || opinion.length > 1000) {
    return res.status(400).json({ error: 'Opinion must be between 1 and 1000 characters.' });
  }

  const posts = await query('SELECT post_id FROM posts WHERE post_id = ? LIMIT 1', [postId]);
  if (posts.length === 0) return res.status(404).json({ error: 'Post not found.' });

  const result = await query(
    'INSERT INTO post_comments (post_id, user_id, opinion) VALUES (?, ?, ?)',
    [postId, req.user.id, opinion]
  );
  const rows = await query(
    `SELECT c.comment_id, c.opinion, c.created_at,
            u.name AS author_name, u.role AS author_role
       FROM post_comments c
       JOIN users u ON u.user_id = c.user_id
      WHERE c.comment_id = ?
      LIMIT 1`,
    [result.insertId]
  );
  return res.status(201).json({ comment: normalizeComment(rows[0]) });
});

module.exports = router;
