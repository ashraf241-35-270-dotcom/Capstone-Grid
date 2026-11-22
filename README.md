# Capstone Grid

A centralized platform for **submitting, reviewing, managing and showcasing university capstone
projects**. Students build project repositories and submit work; teachers create sections, enroll
students, review submissions and record feedback, marks and ratings; everyone can explore public
projects and community posts.

> **Project status:** Step 9 of 9 built and approved — password recovery, tests, demo seed, and operations docs.
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
| Additional     | Multer (project/community uploads)             | Validated file uploads                   |
| Email + tests  | Nodemailer, Jest, Supertest                    | Password recovery and API integration tests |

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
| `SMTP_HOST`      | —                       | SMTP host; required to send password reset emails |
| `SMTP_PORT`      | `587`                   | SMTP server port                                  |
| `SMTP_SECURE`    | `false`                 | Set `true` for implicit TLS, commonly port 465     |
| `SMTP_USER`      | —                       | Optional SMTP username; set with `SMTP_PASSWORD`  |
| `SMTP_PASSWORD`  | —                       | Optional SMTP password; set with `SMTP_USER`      |
| `MAIL_FROM`      | `SMTP_USER`             | Sender address/name; required in production        |

### npm scripts (run from the repo root)

| Script            | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Start API (watch mode) and Vite dev server concurrently   |
| `npm run build`   | Production build of the React app                         |
| `npm run preview` | Preview the production frontend build                     |
| `npm run db:setup`| Optional MySQL database/user setup (prompts for root pw) |
| `npm run db:verify`| Initialize selected DB and print table counts           |
| `npm test`        | Run the backend integration tests                       |
| `npm run db:seed-demo` | Add optional sample accounts and public projects   |

---

## Authentication and roles

- Accounts have exactly one role: **`Student`** or **`Teacher`** (capitalized in DB, JWT and API).
- Passwords are hashed with bcrypt (cost 12). Passwords must be 8–72 bytes.
- Login requires the role to match the account, as specified (“separate Student and Teacher login”).
- JWT payload: `{ id, role, name }`, sent as `Authorization: Bearer <token>`.
- Logout is client-side (the JWT is stateless): the frontend discards the token.
- Protected API routes use `requireAuth`; role-restricted routes use `requireRole('Teacher')`.
- Public endpoints: `GET /api/health`, `GET /api/departments`, `POST /api/auth/register`,
  `POST /api/auth/login`, `GET /api/posts`, and `GET /api/posts/:id/image`.
- Auth endpoints are rate-limited (50 requests / 15 min / IP).
- Password recovery is rate-limited separately (5 requests / 15 min / IP). Set SMTP configuration
  and `CLIENT_ORIGIN` to the exact public frontend origin before enabling it in production.

### Password recovery

The login page links to a recovery form. `POST /api/auth/forgot-password` sends a one-time email link
when SMTP is configured. Existing and unknown addresses receive the same `202` response to avoid
revealing whether an account exists. Recovery links expire after 30 minutes, are stored as SHA-256
hashes (never as usable tokens), and can only be used once. A successful reset updates the password;
the user then logs in normally.

If SMTP is not configured in development, recovery requests return `503` with an administrator
configuration message. Production startup requires `SMTP_HOST` and `MAIL_FROM` (or `SMTP_USER` as the
sender); SMTP credentials, when used, must be supplied together. `CLIENT_ORIGIN` determines the
frontend URL embedded in reset emails. Do not put SMTP credentials in source control or expose the
reset URL in logs.

```json
POST /api/auth/forgot-password
{ "email": "student@university.edu" }
```

```json
POST /api/auth/reset-password
{ "token": "<token-from-email-link>", "password": "a-new-password" }
```

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
| GET    | `/api/projects`        | Token   | Student project list or teacher-owned project view, with latest review mark/rating summary |
| POST   | `/api/projects`        | Student | Create a project repository for an enrolled section |
| GET    | `/api/projects/:id`    | Token   | View one project and its uploaded files          |
| GET    | `/api/projects/explore` | Public | Search/filter accepted and archived public projects with latest review scores; paginated (24/page) |
| GET    | `/api/projects/explore/:id/files/:fileId` | Public | Download a file from a public archived project |
| PUT    | `/api/projects/:id`    | Student | Update metadata; move Draft → In Progress → Submitted, Changes Requested → In Progress, or Accepted → Archived |
| POST   | `/api/projects/:id/files` | Student | Upload files to an editable project; shows them to both project participants and notifies the assigned teacher |
| GET    | `/api/projects/:id/files/:fileId` | Token | Download a project file privately |
| GET   | `/api/projects/:id/tracking` | Token | View milestones, tasks, and project progress |
| GET    | `/api/projects/:id/comments` | Owner/assigned teacher | View project conversation |
| POST   | `/api/projects/:id/comments` | Owner/assigned teacher | Add a project message |
| GET    | `/api/projects/:id/reviews` | Owner/assigned teacher | View private review history |
| POST   | `/api/projects/:id/reviews` | Assigned teacher | Decide Accepted/Changes Requested; include feedback, marks (0–100), rating (1–5) |
| POST  | `/api/projects/:id/milestones` | Student | Add a project milestone and deadline |
| PUT/DELETE | `/api/projects/:id/milestones/:milestoneId` | Student | Update or delete a milestone and its tasks |
| POST  | `/api/projects/:id/milestones/:milestoneId/tasks` | Student | Add a task and due date |
| PUT/DELETE | `/api/projects/:id/milestones/:milestoneId/tasks/:taskId` | Student | Update or delete a task |
| GET    | `/api/notifications`   | Token   | List the signed-in user's 50 latest notifications and unread count |
| PUT    | `/api/notifications/:id/read` | Token | Mark one owned notification as read |
| PUT    | `/api/notifications/read-all` | Token | Mark all owned notifications as read |
| GET    | `/api/posts?page=1`    | Public  | List public posts with opinions, 30 per page      |
| POST   | `/api/posts`           | Token   | Create a text post and/or upload a PNG, JPEG, or WebP image (up to 5 MB) |
| GET    | `/api/posts/:id/image` | Public  | Serve a post image |
| POST   | `/api/posts/:id/comments` | Token | Add an opinion to a post (1–1000 characters) |
| POST   | `/api/auth/register`   | Public  | Create Student/Teacher account                   |
| POST   | `/api/auth/login`      | Public  | Log in with email + password + role              |
| POST   | `/api/auth/forgot-password` | Public | Request a one-time email reset link (SMTP required) |
| POST   | `/api/auth/reset-password` | Public | Replace password with a valid one-time reset token |
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
- **`password_resets`** — `reset_id` PK, `user_id` FK → users (`ON DELETE CASCADE`), SHA-256
  `token_hash`, `expires_at`, `used`, `created_at`; reset tokens expire and are single-use.
- **`courses`** — `course_id` PK, `department_id` FK, `course_code`, `title`; seeded per department.
- **`categories`** — `category_id` PK, `name`; seeded with default capstone categories.
- **`sections`** — `section_id` PK, `course_id` FK, `teacher_id` FK, `section_name`, `semester`.
- **`enrollments`** — `enrollment_id` PK, `section_id` FK, `student_id` FK, unique student/section pair.
- **`projects`** — `project_id` PK, `student_id` FK, `section_id` FK, `category_id` FK,
  `title`, `description`, `status`, `visibility`, `created_at`, `submitted_at`, `archived_at`.
- **`reviews`** — `review_id` PK, `project_id` FK, `teacher_id` FK, decision, feedback, marks
  (0–100), rating (1–5), `reviewed_at`; every review is retained as history.
- **`project_comments`** — `comment_id` PK, `project_id` FK, `user_id` FK, message, `created_at`;
  visible only to the project owner and assigned teacher.
- **`notifications`** — `notification_id` PK, `user_id` FK, type, message, optional project/section
  links, read state, `created_at`; each user can access only their own notifications. A student's
  project file upload alerts the assigned teacher and links directly to the project's file list.
- **`posts`** — `post_id` PK, `user_id` FK, optional text and image metadata, `created_at`; public
  feed access, authenticated publishing.
- **`post_comments`** — `comment_id` PK, `post_id` and `user_id` FKs, opinion, `created_at`; opinions
  are public with the post.
- **`project_files`** — `file_id` PK, `project_id` FK, `file_name`, `original_name`, `mime_type`,
  `file_size`, `file_path`, `uploaded_at`; files remain private except downloadable files attached
  to a public archived project.
- **`milestones`** — `milestone_id` PK, `project_id` FK, `title`, `description`, `deadline`,
  `status`, timestamps.
- **`milestone_tasks`** — `task_id` PK, `milestone_id` FK, `title`, `due_date`, `status`, timestamps.

Project progress is calculated from completed tasks when a project has tasks; otherwise it is
calculated from completed milestones. Projects with no milestones start at 0%.

Archived projects will live in `projects` with `status = 'Archived'` and `archived_at` set — no
separate archive table.

### Tests and optional demo data

Run the backend integration suite with `npm test`. The password-recovery tests use an isolated,
temporary SQLite database and mock email delivery; they do not verify a live SMTP server.

To create sample accounts and public Explore projects, set `DEMO_PASSWORD` to a new password of
8–72 bytes and run `npm run db:seed-demo`. The seed refuses to run when `NODE_ENV=production`,
creates student and teacher demo accounts, and is safe to rerun without changing existing demo
account passwords. It also creates a downloadable sample report under `backend/uploads/`. The demo
emails use the reserved `.test` domain and are not real inboxes. Keep the password in a local
environment variable only; never commit it or save it in `.env`.

PowerShell example:

```powershell
$env:DEMO_PASSWORD = Read-Host "Demo password (8-72 bytes)"
try { npm run db:seed-demo } finally { Remove-Item Env:\DEMO_PASSWORD }
```

### Backup and restore

Database records reference uploaded files, so back up the database and `backend/uploads/` together
from the same recovery point. Store backups outside the repository in access-controlled, encrypted
storage; do not commit database dumps, SQLite files, or uploads.

- **SQLite:** stop the API before copying `backend/data/capstone-grid.sqlite` (or the configured
  `DB_FILE`) and `backend/uploads/`. Restore both before starting the API, then run `npm run db:verify`.
- **MySQL:** use the organization's approved `mysqldump`/restore procedure for `capstone_grid` and
  separately back up `backend/uploads/`. Restore the database and matching uploads before starting
  the API, then run `npm run db:verify`.
- Test restores periodically. Keep secrets such as `.env` and database/SMTP credentials separate
  from backups intended for general developer access.

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
- [x] **Step 5 — Review workflow (FR-08; built, awaiting owner review)**
  Submissions, accept/request changes, feedback, marks, ratings, review history.
- [x] **Step 6 — Communication (FR-07, FR-11; built, awaiting owner review)**
  Project comments and notifications (assignments, submissions, feedback, deadlines).
- [x] **Step 7 — Community dashboard (FR-13, FR-14; built and approved)**
  Public text/photo posts, image upload, opinions on posts.
- [x] **Step 8 — Exploration + archive (FR-05, FR-10, FR-12; built and approved)**
  Public dashboard data, search/filter by name, student, teacher, category, department, status,
  accepted-project and archived-project browsing, public archive file downloads.
- [x] **Step 9 — Completion + hardening (FR-01 recovery, NFRs; built and approved)**
  Password recovery via Nodemailer, focused Jest/Supertest tests, optional demo seed, API docs,
  backup notes, and final validation.

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
5. Upload one or more project files and confirm each file appears immediately beside the upload control.
   As the assigned teacher, confirm an unread notification arrives, opens the relevant project, and
   highlights downloadable files.
6. Confirm the Project conversation appears below the uploaded files, shows only the two newest
   messages initially, and expands/collapses with its See all messages control.
7. Try uploading an unsupported file type → rejected with an error response.
8. Open a project as the owner and verify the returned JSON includes the metadata and uploaded file list.
9. Open the project as a teacher for the same section → access is allowed; as a different teacher or
   unrelated user → rejected with `403`.
10. `GET /api/projects` and `GET /api/projects/:id` return only data the logged-in user is allowed to see.

## Step 4 verification checklist

1. Run `npm run db:verify` and confirm `milestones` and `milestone_tasks` are present.
2. Run `npm run dev`; the frontend should be available on :5173 and the API on :5000.
3. As a student, start a project, add milestones and tasks with optional deadlines, and update their statuses.
4. Confirm project progress uses completed tasks (or completed milestones when there are no tasks).
5. Submit an in-progress project and confirm the status cannot skip directly from Draft to Submitted.
6. As the section teacher, open Project tracking and confirm the assigned project's tracking is read-only.
7. Confirm another student or an unrelated teacher cannot read or modify the project's tracking.

## Step 5 verification checklist

1. Run `npm run db:verify` and confirm the `reviews` table exists.
2. Sign in as a teacher assigned to the project's section; submit a project as its student.
3. Accept the submitted project with feedback, a mark from 0 to 100, and a rating from 1 to 5.
   Confirm the student sees the decision and review history and cannot resubmit an accepted project.
4. On another submitted project, request changes; confirm its student sees the feedback and can
   start revisions, upload updated files, and submit again.
5. Confirm the assigned teacher can review the new submission and both reviews remain in history.
6. Confirm unrelated teachers cannot view or submit reviews, students cannot submit reviews, and
   invalid marks/ratings are rejected.
7. Confirm a submitted or accepted project cannot be edited or receive uploads until changes are
   requested.
8. Restart the API and confirm review history persists.

## Step 6 verification checklist

1. Run `npm run db:verify` and confirm `project_comments` and `notifications` tables exist.
2. Enroll a student in a teacher's section and confirm that student receives an assignment notice.
3. Submit a project and confirm its assigned teacher receives a submission notice. Review it and
   confirm the student receives a feedback notice.
4. Add a message as the student and as the assigned teacher; confirm both sides see the conversation
   and the other participant receives a comment notice.
5. Add or change a milestone/task deadline and confirm project participants receive a deadline
   notice. These are event-based notices, not scheduled advance reminders.
6. Confirm the notification badge/list updates, one notification can be marked read, and Mark all
   read clears the unread count.
7. Confirm unrelated users cannot read another user's notifications or another project's comments.
8. Restart the API and confirm comments and notification read states persist.

## Step 7 verification checklist

1. Run `npm run db:verify` and confirm `posts` and `post_comments` are present.
2. Open Explore while signed out, choose **Community posts**, and confirm posts are separate from
   public projects. Verify the feed can page through every public post and opinions remain visible.
3. Sign in, publish a text-only post, and confirm it appears at the top of the public feed.
4. Publish an image-only post and a text-plus-image post using PNG, JPEG, or WebP files up to 5 MB;
   confirm each photo stays visible inline in the public feed; the first three posts load photos
   immediately.
5. Try an unsupported file type, a mismatched image signature, and an image over 5 MB; confirm each
   upload is rejected and no failed post appears.
6. Add an opinion while signed in; confirm it appears on the post. Confirm signed-out users cannot
   publish or add opinions.
7. Restart the API and confirm posts and opinions persist; confirm the public image endpoint serves
   the uploaded image without requiring login.

## Step 8 verification checklist

1. Run `npm run db:verify` and confirm the public-project search index is present.
2. Open `/explore` while signed out; confirm public accepted projects appear and filter controls load.
3. Search by project name/description and filter by student, teacher, category, department, and
   status; confirm results and pagination update.
4. Confirm private projects and public projects that are not accepted or archived are never listed.
5. As the owner of an accepted project, archive it from the project list; confirm its archive date is
   saved and its tracking/repository updates are read-only.
6. Choose the Archive status filter; confirm public archived projects and their downloadable files
   appear. Confirm private archived project files are not accessible publicly.
7. Restart the API and confirm archived state and public project/file visibility persist.

## Step 9 verification checklist

1. Run `npm test`; confirm the password-recovery integration tests pass.
2. With SMTP unset in development, request a reset and confirm the API reports that recovery is not
   configured. Configure SMTP and a valid `CLIENT_ORIGIN` before testing delivery.
3. Request a reset for a registered account and an unknown address; confirm both return the same
   generic response. Check the email link targets the configured frontend.
4. Confirm a reset token works once, fails after use or expiry, and the new password works at login.
5. If testing demo data, set `DEMO_PASSWORD` locally, run `npm run db:seed-demo`, and confirm the
   accepted and archived projects appear in Explore. Never run the demo seed in production.
6. Follow the backup instructions to verify a database and upload restore in a non-production
   environment.

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
| Password recovery returns `503` | Configure `SMTP_HOST`, `MAIL_FROM`, and paired SMTP credentials if required; verify `CLIENT_ORIGIN` and restart the API. |
