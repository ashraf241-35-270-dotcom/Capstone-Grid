# Capstone Grid

A centralized platform for **submitting, reviewing, managing and showcasing university capstone
projects**. Students build project repositories and submit work; teachers create sections, enroll
students, review submissions and record feedback, marks and ratings; everyone can explore public
projects and community posts.

> **Project status:** Step 4 of 9 complete — project tracking, milestones, tasks, and progress.
> See [Roadmap](#roadmap) and [`context.md`](./context.md) for the step-by-step build plan.

---

## Tech stack

| Layer          | Technology                                   | Purpose                                  |
| -------------- | -------------------------------------------- | ---------------------------------------- |
| Frontend       | React 19 + Vite, React Router, Axios          | Responsive SPA with role-based pages     |
| Backend        | Node.js + Express 5                           | REST API, business logic, access rules   |
| Database       | MySQL 8                                       | Relational storage for all entities      |
| DB access      | mysql2 (promise pool, parameterized queries)  | Connects the API to MySQL                |
| Authentication | JWT + bcryptjs                                | Login tokens, password hashing, RBAC     |
| Security       | helmet, express-rate-limit, CORS              | Hardening for the API                    |
| Planned        | Multer (uploads), Nodemailer (email), Jest    | Files, password recovery, tests          |

**Repository layout**

```
capstone-grid/
├── backend/                 Express REST API
│   ├── server.js            App bootstrap, middleware, error handling
│   ├── scripts/
│   │   └── verify-db.js     `npm run db:verify` connectivity check
│   └── src/
│       ├── config.js        Environment validation + shared config
│       ├── db.js            MySQL pool, schema bootstrap, query helper
│       ├── middleware/
│       │   └── auth.js      requireAuth / requireRole
│       └── routes/
│           ├── auth.js      FR-01 register, login, me
│           └── departments.js
├── frontend/                React SPA (Vite)
│   └── src/
│       ├── api/client.js    Axios instance, token + 401 handling
│       ├── context/         AuthContext (session state)
│       ├── components/      Layout, navbar, protected route, role select
│       └── pages/           Landing, Login, Register, Dashboard, 404
├── database/
│   └── schema.sql           MySQL schema (single source of truth, idempotent)
├── scripts/
│   └── setup-db.ps1         Creates DB + dedicated user, applies schema
├── .env.example             Configuration template (never commit `.env`)
├── context.md               Full project context and AI working agreement
└── README.md
```

---

## Prerequisites

- **Node.js 20+** (developed on Node 24)
- **MySQL 8** running locally with an administrative (root) account
- Windows PowerShell 5.1+ (the DB setup script targets Windows; on macOS/Linux, run the
  equivalent SQL manually — see [Manual MySQL setup](#manual-mysql-setup))

---

## Getting started

```powershell
# 1. Install all workspace dependencies (root, backend, frontend)
npm install

# 2. Create the database + dedicated MySQL user and apply the schema.
#    You will be prompted once for the MySQL root password.
npm run db:setup

# 3. Confirm the API can reach the database
npm run db:verify

# 4. Run API + frontend together
npm run dev
```

- Frontend: **http://localhost:5173**
- API: **http://localhost:5000** (`/api/health` for a health check)

The API applies `database/schema.sql` automatically on startup (idempotent), so new tables added in
later steps are created without manual migration commands.

### Open the UI with VS Code Go Live

Run `npm run build` after frontend updates, then open either the root `index.html` or
`frontend/index.html` and select **Go Live**. Both open the compiled frontend in `frontend/dist`.
This static preview is for viewing and navigating the UI; login, registration, and other API-backed
actions need the backend, so use `npm run dev` for those.

### Manual MySQL setup (non-Windows)

```sql
CREATE DATABASE capstone_grid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'capstone_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON capstone_grid.* TO 'capstone_user'@'localhost';
FLUSH PRIVILEGES;
```

Then run `mysql -u capstone_user -p capstone_grid < database/schema.sql` and set the matching values
in `.env`.

### Environment variables (`.env`)

Copy `.env.example` to `.env` and fill in the values. `.env` is git-ignored.

| Variable         | Default                 | Notes                                              |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `PORT`           | `5000`                  | API port                                           |
| `NODE_ENV`       | `development`           |                                                    |
| `CLIENT_ORIGIN`  | `http://localhost:5173` | Allowed CORS origin                                |
| `JWT_SECRET`     | —                       | Long random string; **required**                   |
| `JWT_EXPIRES_IN` | `1d`                    | Token lifetime                                     |
| `DB_HOST`        | `127.0.0.1`             |                                                    |
| `DB_PORT`        | `3306`                  |                                                    |
| `DB_NAME`        | `capstone_grid`         | Created by `db:setup`                              |
| `DB_USER`        | `capstone_user`         | Dedicated app user (no root access)                |
| `DB_PASSWORD`    | —                       | Strong password; **required**                      |

### npm scripts (run from the repo root)

| Script            | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Start API (watch mode) and Vite dev server concurrently   |
| `npm run build`   | Production build of the React app                         |
| `npm run preview` | Preview the production frontend build                     |
| `npm run db:setup`| Create database/user, apply schema (prompts for root pw)  |
| `npm run db:verify`| Connect with app credentials and print table counts      |

---

## Authentication and roles

- Accounts have exactly one role: **`Student`** or **`Teacher`** (capitalized in DB, JWT and API).
- Passwords are hashed with bcrypt (cost 12). Passwords must be 8–72 bytes.
- Login requires the role to match the account, as specified (“separate Student and Teacher login”).
- JWT payload: `{ id, role, name }`, sent as `Authorization: Bearer <token>`.
- Logout is client-side (the JWT is stateless): the frontend discards the token.
- Protected API routes use `requireAuth`; role-restricted routes use `requireRole('Teacher')`.
- Public endpoints: `GET /api/health`, `GET /api/departments`, `POST /api/auth/register`,
  `POST /api/auth/login`.
- Auth endpoints are rate-limited (50 requests / 15 min / IP).

---

## API reference (implemented)

All responses are JSON. Errors use `{ "error": "message" }`.

| Method | Endpoint               | Access  | Description                                      |
| ------ | ---------------------- | ------- | ------------------------------------------------ |
| GET    | `/api/health`          | Public  | Service + DB health check                        |
| GET    | `/api/departments`     | Public  | List departments (id, name)                      |
| GET    | `/api/courses`         | Public  | List courses, optionally filtered by department   |
| GET    | `/api/categories`      | Public  | List project categories                           |
| GET    | `/api/sections`        | Token   | Teacher sections or student enrollment list       |
| POST   | `/api/sections`        | Teacher | Create a course section                          |
| POST   | `/api/sections/:id/enrollments` | Teacher | Enroll a student by email         |
| DELETE | `/api/sections/:id/enrollments/:studentId` | Teacher | Remove a student from a section |
| GET    | `/api/projects`        | Token   | Student project list or teacher-owned project view |
| POST   | `/api/projects`        | Student | Create a project repository for an enrolled section |
| GET    | `/api/projects/:id`    | Token   | View one project and its uploaded files          |
| PUT    | `/api/projects/:id`    | Student | Update project metadata; move status Draft → In Progress → Submitted |
| POST   | `/api/projects/:id/files` | Student | Upload files to a project repository     |
| GET    | `/api/projects/:id/files/:fileId` | Token | Download a project file privately |
| GET   | `/api/projects/:id/tracking` | Token | View milestones, tasks, and project progress |
| POST  | `/api/projects/:id/milestones` | Student | Add a project milestone and deadline |
| PUT/DELETE | `/api/projects/:id/milestones/:milestoneId` | Student | Update or delete a milestone and its tasks |
| POST  | `/api/projects/:id/milestones/:milestoneId/tasks` | Student | Add a task and due date |
| PUT/DELETE | `/api/projects/:id/milestones/:milestoneId/tasks/:taskId` | Student | Update or delete a task |
| POST   | `/api/auth/register`   | Public  | Create Student/Teacher account                   |
| POST   | `/api/auth/login`      | Public  | Log in with email + password + role              |
| GET    | `/api/auth/me`         | Token   | Current user profile                             |

**Register body**

```json
{ "name": "Ayesha Rahman", "email": "ayesha@university.edu", "password": "secret123", "role": "Student", "departmentId": 1 }
```

**Login body / response**

```json
{ "email": "ayesha@university.edu", "password": "secret123", "role": "Student" }
```

```json
{
  "token": "<jwt>",
  "user": { "userId": 1, "name": "Ayesha Rahman", "email": "ayesha@university.edu", "role": "Student", "departmentId": 1, "department": "Computer Science and Engineering", "createdAt": "..." }
}
```

---

## Database (current state)

Implemented tables (see `database/schema.sql`):

- **`departments`** — `department_id` PK, `name` (unique), `created_at`; seeded with eight departments.
- **`users`** — `user_id` PK, `department_id` FK → departments (nullable, `ON DELETE SET NULL`),
  `name`, `email` (unique), `password_hash`, `role` ENUM('Student','Teacher'), `created_at`.
- **`password_resets`** — `reset_id` PK, `user_id` FK → users (`ON DELETE CASCADE`), `token_hash`,
  `expires_at`, `used`, `created_at`. (Prepared for FR-01 password recovery.)
- **`courses`** — `course_id` PK, `department_id` FK, `course_code`, `title`; seeded per department.
- **`categories`** — `category_id` PK, `name`; seeded with default capstone categories.
- **`sections`** — `section_id` PK, `course_id` FK, `teacher_id` FK, `section_name`, `semester`.
- **`enrollments`** — `enrollment_id` PK, `section_id` FK, `student_id` FK, unique student/section pair.
- **`projects`** — `project_id` PK, `student_id` FK, `section_id` FK, `category_id` FK,
  `title`, `description`, `status`, `visibility`, `created_at`, `submitted_at`, `archived_at`.
- **`project_files`** — `file_id` PK, `project_id` FK, `file_name`, `original_name`, `mime_type`,
  `file_size`, `file_path`, `uploaded_at`.
- **`milestones`** — `milestone_id` PK, `project_id` FK, `title`, `description`, `deadline`,
  `status`, timestamps.
- **`milestone_tasks`** — `task_id` PK, `milestone_id` FK, `title`, `due_date`, `status`, timestamps.

Planned tables from the proposal’s ER model, added in later steps: `reviews`, `project_comments`,
`posts`, `post_comments`, `notifications`.

Project progress is calculated from completed tasks when a project has tasks; otherwise it is
calculated from completed milestones. Projects with no milestones start at 0%.

Archived projects will live in `projects` with `status = 'Archived'` and `archived_at` set — no
separate archive table.

---

## Roadmap

Each step is built and reviewed with the project owner before the next begins.
`context.md` records the full history and working rules.

- [x] **Step 1 — Foundation + authentication (FR-01 core)**
  MySQL schema, DB/user setup script, Express API, JWT/bcrypt auth, role-based routing, React
  landing/login/register/dashboard shell, responsive styling, docs.
- [x] **Step 2 — Academic structure (FR-03, FR-04)**
  Courses, categories, section creation + enrollment flows, teacher-managed roster UI, academic
  dashboards and protected academic routes.
- [x] **Step 3 — Project repository + uploads (FR-02, FR-03)**
  Project creation, category/visibility metadata, student-owned repositories, file uploads,
  private file access to the project owner and section teacher.
- [x] **Step 4 — Tracking (FR-06, FR-09)**
  Project status workflow, milestones, tasks, deadlines, progress percentage.
- [ ] **Step 5 — Review workflow (FR-08)**
  Submissions, accept/request changes, feedback, marks, ratings, review history.
- [ ] **Step 6 — Communication (FR-07, FR-11)**
  Project comments and notifications (assignments, submissions, feedback, deadlines).
- [ ] **Step 7 — Community dashboard (FR-13, FR-14)**
  Public text/photo posts, image upload, opinions on posts.
- [ ] **Step 8 — Exploration + archive (FR-05, FR-10, FR-12)**
  Public dashboard data, search/filter by name, student, teacher, category, department, status,
  archived project browsing.
- [ ] **Step 9 — Completion + hardening (FR-01 recovery, NFRs)**
  Password recovery via Nodemailer, tests (Jest), validation review, seed demo data, API docs,
  backup notes.

---

## Conventions for contributors and AI agents

1. **Read `context.md` first.** It contains the full proposal, decisions, progress and rules.
2. **Build one step at a time.** Do not start a new step until the owner replies “ok to go”.
3. **Update docs every step:** README roadmap/API/schema and append to `context.md`.
4. **Never commit secrets.** `.env`, uploaded files and database dumps are git-ignored.
5. **Roles** are `Student` / `Teacher` (capitalized) everywhere.
6. **SQL** uses parameterized `query(sql, params)` from `backend/src/db.js`; no string concatenation.
7. **Auth** uses `requireAuth` / `requireRole`; private project data must never leak to public routes.
8. **Errors** return `{ error }` with an appropriate HTTP status.
9. **Frontend** talks to `/api` through the Axios instance in `frontend/src/api/client.js`.

---

## Step 3 verification checklist

1. `npm run db:verify` → connects and shows the full set of academic tables, including `projects`
   and `project_files`.
2. `npm run dev` → API on :5000 and frontend on :5173.
3. Sign in as a **Student** and open `/projects` from the navbar or dashboard.
4. Create a project repository by selecting an enrolled section and category, then confirm it appears in the project list.
5. Upload one or more project files and confirm the file count increases.
6. Try uploading an unsupported file type → rejected with an error response.
7. Open a project as the owner and verify the returned JSON includes the metadata and uploaded file list.
8. Open the project as a teacher for the same section → access is allowed; as a different teacher or
   unrelated user → rejected with `403`.
9. `GET /api/projects` and `GET /api/projects/:id` return only data the logged-in user is allowed to see.

## Step 4 verification checklist

1. Run `npm run db:verify` and confirm `milestones` and `milestone_tasks` are present.
2. Run `npm run dev`; the frontend should be available on :5173 and the API on :5000.
3. As a student, start a project, add milestones and tasks with optional deadlines, and update their statuses.
4. Confirm project progress uses completed tasks (or completed milestones when there are no tasks).
5. Submit an in-progress project and confirm the status cannot skip directly from Draft to Submitted.
6. As the section teacher, open Project tracking and confirm the assigned project's tracking is read-only.
7. Confirm another student or an unrelated teacher cannot read or modify the project's tracking.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| API exits with `[db] Could not connect...` | Run `npm run db:setup`, then `npm run db:verify`. |
| MySQL reports `ER_ACCESS_DENIED_ERROR` | Re-run `npm run db:setup` with the MySQL root password to align the app user's password and grants with `.env`, then run `npm run db:verify`. |
| `Missing required environment variables` | Create `.env` from `.env.example` and fill every DB/JWT value. |
| MySQL root login fails in setup | Use the root password set during MySQL installation; no password is stored by the script. |
| Port 5000/5173 already in use | Change `PORT` in `.env` (also update `vite.config.js` proxy) or stop the other process. |
| Departments fail to load in registration | Check the API is running and `/api/departments` returns data. |
| Login works but dashboard redirects back | Clear `localStorage` and log in again; check the API logs for JWT errors. |
