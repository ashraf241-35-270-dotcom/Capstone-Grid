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
| Database       | SQLite (local default), MySQL 8 (optional)   | Relational storage for all entities      |
| DB access      | `node:sqlite` or mysql2                      | Parameterized database queries           |
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
│       ├── db.js            SQLite/MySQL adapter, schema bootstrap, query helper
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
│   ├── schema.sql           MySQL schema (idempotent)
│   └── schema.sqlite.sql    SQLite schema and local seed data
├── scripts/
│   └── setup-db.ps1         Creates DB + dedicated user, applies schema
├── .env.example             Configuration template (never commit `.env`)
├── context.md               Full project context and AI working agreement
└── README.md
```

---

## Prerequisites

- **Node.js 22.5+** (uses the built-in `node:sqlite` module)
- MySQL 8 is optional; the default SQLite database needs no service or administrator setup.
- Windows PowerShell 5.1+ is only needed for the optional MySQL setup script.

---

## Getting started

```powershell
# 1. Install all workspace dependencies (root, backend, frontend)
npm install

# 2. Verify/create the local SQLite database and seed departments/courses
npm run db:verify

# 3. Run API + frontend together
npm run dev
```

- Frontend: **http://localhost:5173**
- API: **http://localhost:5000** (`/api/health` for a health check)

The API applies the selected schema automatically on startup. By default, data is stored in
`backend/data/capstone-grid.sqlite` and survives restarts. No MySQL service or `.env` file is needed
for local development. The first run may print Node's experimental `node:sqlite` warning.

### Use the UI with VS Code Go Live

Keep the API running in a terminal:

```powershell
npm run dev -w capstone-grid-api
```

In another terminal, build the frontend after changes:

```powershell
npm run build
```

Then open the project root `index.html` with **Go Live** (do not open the built HTML as `file://`).
The built UI connects to the API at `http://localhost:5000/api`; the API allows local Go Live
origins during development. Keep the API terminal open while using the app. For the simplest setup,
`npm run dev` starts both the API and Vite frontend.

### Optional MySQL setup

To use MySQL instead of the default SQLite file, copy `.env.example` to `.env`, set
`DB_CLIENT=mysql`, fill in the MySQL connection values, then run `npm run db:setup` and
`npm run db:verify`. The setup script prompts for the MySQL root password locally; it is not saved.
For manual setup on non-Windows systems, create the database and application user, apply
`database/schema.sql`, and use the matching `.env` values.

### Environment variables (`.env`)

`.env` is optional for local SQLite development and git-ignored. Set `JWT_SECRET` before deploying
to production. The API generates a random development-only signing key when none is configured.

| Variable         | Default                 | Notes                                              |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `PORT`           | `5000`                  | API port                                           |
| `NODE_ENV`       | `development`           |                                                    |
| `CLIENT_ORIGIN`  | `http://localhost:5173` | Allowed CORS origin                                |
| `JWT_SECRET`     | generated in development | Set a long random string for production           |
| `JWT_EXPIRES_IN` | `1d`                    | Token lifetime                                     |
| `DB_CLIENT`      | `sqlite`                | `sqlite` or `mysql`                                |
| `DB_FILE`        | `backend/data/capstone-grid.sqlite` | Relative to the project root              |
| `DB_HOST`        | `127.0.0.1`             | MySQL only                                        |
| `DB_PORT`        | `3306`                  | MySQL only                                        |
| `DB_NAME`        | `capstone_grid`         | MySQL database                                    |
| `DB_USER`        | `capstone_user`         | MySQL app user (no root access)                    |
| `DB_PASSWORD`    | —                       | MySQL app password                                |

### npm scripts (run from the repo root)

| Script            | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Start API (watch mode) and Vite dev server concurrently   |
| `npm run build`   | Production build of the React app                         |
| `npm run preview` | Preview the production frontend build                     |
| `npm run db:setup`| Optional MySQL database/user setup (prompts for root pw) |
| `npm run db:verify`| Initialize selected DB and print table counts           |

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

Implemented tables (see `database/schema.sql` for MySQL and `database/schema.sqlite.sql` for SQLite):

- **`departments`** — `department_id` PK, `name` (unique), `created_at`; seeded with 13 departments.
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
  SQLite schema (plus optional MySQL), Express API, JWT/bcrypt auth, role-based routing, React
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
| API exits with `[db] Could not connect...` | SQLite is the local default; for MySQL, check `.env` and run `npm run db:verify`. |
| MySQL reports `ER_ACCESS_DENIED_ERROR` | Re-run `npm run db:setup` with the MySQL root password to align the app user's password and grants with `.env`, then run `npm run db:verify`. |
| `Missing required environment variables` | For MySQL, set all DB values in `.env`; production also requires `JWT_SECRET`. |
| MySQL root login fails in setup | Use the root password set during MySQL installation; no password is stored by the script. |
| Port 5000/5173 already in use | Change `PORT` in `.env` (also update `vite.config.js` proxy) or stop the other process. |
| Departments fail to load in registration | Run `npm run dev -w capstone-grid-api`, open the page through Go Live (not `file://`), and reload. |
| Login works but dashboard redirects back | Clear `localStorage` and log in again; check the API logs for JWT errors. |
