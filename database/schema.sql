-- ============================================================================
-- Capstone Grid database schema (MySQL 8)
-- Applied automatically by backend/src/db.js on API startup (idempotent).
--
-- Step 1 defines the authentication foundation:
--   departments -> users -> password_resets
-- Remaining ER tables (reviews, project_comments, posts, post_comments,
-- notifications) are added in later steps, as documented in README.md.
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS departments (
  department_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NULL,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('Student', 'Teacher') NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_department (department_id),
  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments (department_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  reset_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reset_id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default departments so registration works immediately.
INSERT IGNORE INTO departments (name) VALUES
  ('Computer Science and Engineering'),
  ('Electrical and Electronic Engineering'),
  ('Civil Engineering'),
  ('Mechanical Engineering'),
  ('Business Administration'),
  ('Economics and Finance'),
  ('English and Literature'),
  ('Architecture'),
  ('Information Technology'),
  ('Software Engineering'),
  ('Data Science'),
  ('Biomedical Engineering'),
  ('Environmental Science');

-- ============================================================================
-- Step 2: academic structure (FR-03 base) and sections (FR-04)
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  course_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NOT NULL,
  course_code   VARCHAR(20)  NOT NULL,
  title         VARCHAR(160) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id),
  UNIQUE KEY uq_courses_department_code (department_id, course_code),
  CONSTRAINT fk_courses_department
    FOREIGN KEY (department_id) REFERENCES departments (department_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sections (
  section_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  teacher_id   INT UNSIGNED NOT NULL,
  section_name VARCHAR(80)  NOT NULL,
  semester     VARCHAR(50)  NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (section_id),
  UNIQUE KEY uq_sections_course_semester_name (course_id, semester, section_name),
  KEY idx_sections_teacher (teacher_id),
  CONSTRAINT fk_sections_course
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sections_teacher
    FOREIGN KEY (teacher_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id    INT UNSIGNED NOT NULL,
  student_id    INT UNSIGNED NOT NULL,
  enrolled_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_id),
  UNIQUE KEY uq_enrollments_section_student (section_id, student_id),
  KEY idx_enrollments_student (student_id),
  CONSTRAINT fk_enrollments_section
    FOREIGN KEY (section_id) REFERENCES sections (section_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  project_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     INT UNSIGNED NOT NULL,
  section_id     INT UNSIGNED NULL,
  category_id    INT UNSIGNED NULL,
  title          VARCHAR(160) NOT NULL,
  description    TEXT NOT NULL,
  status         ENUM('Draft', 'Submitted', 'Under Review', 'Accepted', 'Changes Requested', 'Archived') NOT NULL DEFAULT 'Draft',
  visibility     ENUM('Private', 'Public') NOT NULL DEFAULT 'Private',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at   DATETIME NULL,
  archived_at    DATETIME NULL,
  PRIMARY KEY (project_id),
  KEY idx_projects_student (student_id),
  KEY idx_projects_section (section_id),
  KEY idx_projects_category (category_id),
  CONSTRAINT fk_projects_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_projects_section
    FOREIGN KEY (section_id) REFERENCES sections (section_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_projects_category
    FOREIGN KEY (category_id) REFERENCES categories (category_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE projects
  MODIFY status ENUM('Draft', 'In Progress', 'Submitted', 'Under Review', 'Accepted', 'Changes Requested', 'Archived')
  NOT NULL DEFAULT 'Draft';

CREATE TABLE IF NOT EXISTS reviews (
  review_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  INT UNSIGNED NOT NULL,
  teacher_id  INT UNSIGNED NOT NULL,
  decision    ENUM('Accepted', 'Changes Requested') NOT NULL,
  feedback    TEXT NOT NULL,
  marks       DECIMAL(5,2) NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  KEY idx_reviews_project_reviewed (project_id, reviewed_at),
  CONSTRAINT chk_reviews_marks CHECK (marks >= 0 AND marks <= 100),
  CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT fk_reviews_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_teacher
    FOREIGN KEY (teacher_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_comments (
  comment_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id),
  KEY idx_project_comments_project_created (project_id, created_at),
  CONSTRAINT fk_project_comments_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_project_comments_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  type            ENUM('assignment', 'submission', 'feedback', 'comment', 'deadline') NOT NULL,
  message         VARCHAR(500) NOT NULL,
  project_id      INT UNSIGNED NULL,
  section_id      INT UNSIGNED NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY idx_notifications_user_read_created (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notifications_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_notifications_section
    FOREIGN KEY (section_id) REFERENCES sections (section_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  post_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  content         TEXT NULL,
  image_file_name VARCHAR(80) NULL,
  image_mime_type ENUM('image/jpeg', 'image/png', 'image/webp') NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id),
  UNIQUE KEY uq_posts_image_file_name (image_file_name),
  KEY idx_posts_created (created_at, post_id),
  CONSTRAINT chk_posts_content_or_image
    CHECK ((content IS NOT NULL AND CHAR_LENGTH(TRIM(content)) > 0) OR image_file_name IS NOT NULL),
  CONSTRAINT chk_posts_image_pair
    CHECK ((image_file_name IS NULL AND image_mime_type IS NULL) OR (image_file_name IS NOT NULL AND image_mime_type IS NOT NULL)),
  CONSTRAINT fk_posts_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_comments (
  comment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  opinion    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id),
  KEY idx_post_comments_post_created (post_id, created_at, comment_id),
  CONSTRAINT fk_post_comments_post
    FOREIGN KEY (post_id) REFERENCES posts (post_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_files (
  file_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id     INT UNSIGNED NOT NULL,
  file_name      VARCHAR(200) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(120) NOT NULL,
  file_size      INT UNSIGNED NOT NULL,
  file_path      VARCHAR(255) NOT NULL,
  uploaded_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id),
  KEY idx_project_files_project (project_id),
  CONSTRAINT fk_project_files_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Step 4: project milestones, tasks, deadlines, and progress (FR-06, FR-09)
-- ============================================================================

CREATE TABLE IF NOT EXISTS milestones (
  milestone_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id   INT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  description  TEXT NULL,
  deadline     DATE NULL,
  status       ENUM('Not Started', 'In Progress', 'Completed') NOT NULL DEFAULT 'Not Started',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (milestone_id),
  KEY idx_milestones_project_deadline (project_id, deadline),
  CONSTRAINT fk_milestones_project
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS milestone_tasks (
  task_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  milestone_id INT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  due_date     DATE NULL,
  status       ENUM('Not Started', 'In Progress', 'Completed') NOT NULL DEFAULT 'Not Started',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id),
  KEY idx_milestone_tasks_milestone_due (milestone_id, due_date),
  CONSTRAINT fk_milestone_tasks_milestone
    FOREIGN KEY (milestone_id) REFERENCES milestones (milestone_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default project categories (used from Step 3 onward, pickers ready now).
INSERT IGNORE INTO categories (name) VALUES
  ('Web Application'),
  ('Mobile Application'),
  ('Machine Learning'),
  ('Internet of Things'),
  ('Data Analytics'),
  ('Cybersecurity'),
  ('Robotics'),
  ('Research and Innovation');

-- One capstone course per department so teachers can create sections immediately.
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'CSE-490', 'Capstone Project' FROM departments
 WHERE name = 'Computer Science and Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'EEE-490', 'Capstone Project' FROM departments
 WHERE name = 'Electrical and Electronic Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'CIV-490', 'Capstone Project' FROM departments
 WHERE name = 'Civil Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'MEC-490', 'Capstone Project' FROM departments
 WHERE name = 'Mechanical Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'BBA-490', 'Capstone Project' FROM departments
 WHERE name = 'Business Administration';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ECO-490', 'Capstone Project' FROM departments
 WHERE name = 'Economics and Finance';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ENG-490', 'Capstone Project' FROM departments
 WHERE name = 'English and Literature';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ARC-490', 'Capstone Project' FROM departments
 WHERE name = 'Architecture';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'IT-490', 'Capstone Project' FROM departments
 WHERE name = 'Information Technology';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'SWE-490', 'Capstone Project' FROM departments
 WHERE name = 'Software Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'DSC-490', 'Capstone Project' FROM departments
 WHERE name = 'Data Science';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'BME-490', 'Capstone Project' FROM departments
 WHERE name = 'Biomedical Engineering';
INSERT IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ENV-490', 'Capstone Project' FROM departments
 WHERE name = 'Environmental Science';
