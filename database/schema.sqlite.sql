PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  department_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Student', 'Teacher')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_users_department ON users (department_id);

CREATE TABLE IF NOT EXISTS password_resets (
  reset_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS courses (
  course_id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, course_code),
  FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
  section_id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  section_name TEXT NOT NULL,
  semester TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, semester, section_name),
  FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sections_teacher ON sections (teacher_id);

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (section_id, student_id),
  FOREIGN KEY (section_id) REFERENCES sections (section_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);

CREATE TABLE IF NOT EXISTS projects (
  project_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  section_id INTEGER,
  category_id INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'In Progress', 'Submitted', 'Under Review', 'Accepted', 'Changes Requested', 'Archived')),
  visibility TEXT NOT NULL DEFAULT 'Private' CHECK (visibility IN ('Private', 'Public')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT,
  archived_at TEXT,
  FOREIGN KEY (student_id) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections (section_id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_student ON projects (student_id);
CREATE INDEX IF NOT EXISTS idx_projects_section ON projects (section_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects (category_id);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('Accepted', 'Changes Requested')),
  feedback TEXT NOT NULL,
  marks REAL NOT NULL CHECK (marks >= 0 AND marks <= 100),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users (user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_project_reviewed ON reviews (project_id, reviewed_at);

CREATE TABLE IF NOT EXISTS project_files (
  file_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files (project_id);

CREATE TABLE IF NOT EXISTS milestones (
  milestone_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'Not Started'
    CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_milestones_project_deadline ON milestones (project_id, deadline);

CREATE TABLE IF NOT EXISTS milestone_tasks (
  task_id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Not Started'
    CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (milestone_id) REFERENCES milestones (milestone_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_milestone_due ON milestone_tasks (milestone_id, due_date);

CREATE TRIGGER IF NOT EXISTS trg_milestones_updated_at
AFTER UPDATE ON milestones
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE milestones SET updated_at = CURRENT_TIMESTAMP WHERE milestone_id = NEW.milestone_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_milestone_tasks_updated_at
AFTER UPDATE ON milestone_tasks
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE milestone_tasks SET updated_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
END;

INSERT OR IGNORE INTO departments (name) VALUES
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

INSERT OR IGNORE INTO categories (name) VALUES
  ('Web Application'),
  ('Mobile Application'),
  ('Machine Learning'),
  ('Internet of Things'),
  ('Data Analytics'),
  ('Cybersecurity'),
  ('Robotics'),
  ('Research and Innovation');

INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'CSE-490', 'Capstone Project' FROM departments
WHERE name = 'Computer Science and Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'EEE-490', 'Capstone Project' FROM departments
WHERE name = 'Electrical and Electronic Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'CIV-490', 'Capstone Project' FROM departments
WHERE name = 'Civil Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'MEC-490', 'Capstone Project' FROM departments
WHERE name = 'Mechanical Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'BBA-490', 'Capstone Project' FROM departments
WHERE name = 'Business Administration';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ECO-490', 'Capstone Project' FROM departments
WHERE name = 'Economics and Finance';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ENG-490', 'Capstone Project' FROM departments
WHERE name = 'English and Literature';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ARC-490', 'Capstone Project' FROM departments
WHERE name = 'Architecture';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'IT-490', 'Capstone Project' FROM departments
WHERE name = 'Information Technology';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'SWE-490', 'Capstone Project' FROM departments
WHERE name = 'Software Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'DSC-490', 'Capstone Project' FROM departments
WHERE name = 'Data Science';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'BME-490', 'Capstone Project' FROM departments
WHERE name = 'Biomedical Engineering';
INSERT OR IGNORE INTO courses (department_id, course_code, title)
SELECT department_id, 'ENV-490', 'Capstone Project' FROM departments
WHERE name = 'Environmental Science';
