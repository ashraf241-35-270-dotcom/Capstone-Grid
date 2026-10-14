-- Capstone Grid database schema (SQLite)
-- Run automatically by backend/src/db.js on server start.

PRAGMA foreign_keys = ON;

-- FR-01: User authentication (Student / Teacher roles)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student', 'teacher')),
  department    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Upcoming tables (see README roadmap):
-- projects, sections, enrollments, milestones, reviews, comments,
-- notifications, posts, post_opinions
