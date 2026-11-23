const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.DB_FILE = path.join(os.tmpdir(), `capstone-grid-posts-${process.pid}.sqlite`);

const databasePath = process.env.DB_FILE;
fs.rmSync(databasePath, { force: true });

const express = require('express');
const request = require('supertest');
const { closePool, initSchema, query } = require('../src/db');
const postsRoutes = require('../src/routes/posts');

const app = express();
app.use(express.json());
app.use('/api/posts', postsRoutes);

describe('public posts pagination', () => {
  beforeAll(async () => {
    await initSchema();
    const user = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Posts Test User', 'posts-user@example.test', 'test-hash', 'Student']
    );
    for (let index = 1; index <= 31; index += 1) {
      await query(
        'INSERT INTO posts (user_id, content) VALUES (?, ?)',
        [user.insertId, `Public post ${index}`]
      );
    }
  });

  afterAll(async () => {
    await closePool();
    await fs.promises.rm(databasePath, { force: true });
    await fs.promises.rm(`${databasePath}-journal`, { force: true });
  });

  test('returns every public post across pages with a consistent newest-first order', async () => {
    const firstPage = await request(app).get('/api/posts').expect(200);
    expect(firstPage.body.posts).toHaveLength(30);
    expect(firstPage.body.posts[0].content).toBe('Public post 31');
    expect(firstPage.body.pagination).toEqual({
      page: 1,
      pageSize: 30,
      pageCount: 2,
      total: 31
    });

    const secondPage = await request(app).get('/api/posts?page=2').expect(200);
    expect(secondPage.body.posts).toHaveLength(1);
    expect(secondPage.body.posts[0].content).toBe('Public post 1');
    expect(secondPage.body.pagination.page).toBe(2);

    const outOfRangePage = await request(app).get('/api/posts?page=3').expect(200);
    expect(outOfRangePage.body.posts).toEqual([]);
    expect(outOfRangePage.body.pagination.total).toBe(31);
  });

  test('rejects invalid page numbers', async () => {
    await request(app).get('/api/posts?page=0').expect(400);
    await request(app).get('/api/posts?page=not-a-number').expect(400);
  });
});
