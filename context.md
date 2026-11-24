# Capstone Grid — Project Context

> **Read this file before doing anything.** It is the shared memory for every AI agent or developer
> working on Capstone Grid. The project is built **one approved step at a time**.

---

## 0. Mandatory working agreement

1. **Read `README.md` and this file first**, then inspect the code relevant to the current step.
2. **Do not start a new step until the owner explicitly says “ok to go”** after reviewing the last one.
3. **One step = a coherent, runnable slice** (schema + API + UI + docs + verification). Keep it small.
4. **After completing a step**, update all of the following:
   - `README.md`: roadmap checkboxes, API table, database section, scripts, verification steps.
   - `context.md`: append the new user prompt **verbatim** plus a work log (files, decisions,
     verification results, known issues, next step). Never delete history.
5. **Never write secrets into the repo or this file.** `.env` is git-ignored. Do not paste passwords,
   JWT secrets, root credentials, or uploaded user data into docs.
6. **Follow the locked decisions** in section 2 unless the owner explicitly changes them.
7. **Verify before reporting:** run the API, database check and frontend build. Report exactly what
   was verified and what still needs a manual check.
8. **Never invent features outside the proposal.** Scope is defined in section 1 / the original prompt.

---

## 1. Project summary

Capstone Grid is a full-stack web application that centralizes the university capstone lifecycle:

- **Students** create project repositories, upload code/reports/images, submit and resubmit work,
  view feedback/progress, explore public projects and comment on posts.
- **Teachers** create sections, enroll students, review submissions, accept or request changes,
  give feedback/marks/ratings, track milestones/deadlines and monitor progress.
- **Visitors** can explore public projects, dashboard posts and the archive.
- **Archive:** completed projects stay searchable for future reference (no separate table; a project
  with `status = 'Archived'` and `archived_at`).

Functional requirements: **FR-01 … FR-14** (see original prompt in section 8).
Non-functional requirements: security, performance, usability, reliability, scalability,
maintainability, data integrity, privacy.

---

## 2. Locked decisions

| Area | Decision |
| --- | --- |
| Stack | **React 19 + Vite** frontend, **Node.js + Express 5** API, **MySQL 8** database |
| DB access | **mysql2** promise pool, parameterized queries (`backend/src/db.js`) |
| Auth | **JWT** (Bearer header) + **bcryptjs** (cost 12), role-based access (`Student` / `Teacher`) |
| Roles | Exactly `Student` and `Teacher`, capitalized in DB/API/JWT |
| Login | Email + password + **role must match the account** (separate Student/Teacher login) |
| Logout | Client-side token deletion (JWT is stateless) |
| Ports | API `5000`, frontend `5173` (Vite proxies `/api` → `http://localhost:5000`) |
| MySQL access | Dedicated user `capstone_user` on database `capstone_grid` (created by `npm run db:setup`); root password is only prompted for setup and never stored |
| Env file | Single root `.env` (git-ignored), loaded explicitly by the backend |
| Schema | `database/schema.sql`, idempotent, applied automatically on API startup |
| Step process | Build → owner reviews → explicit “ok to go” → next step |
| Docs | `README.md` (how to run/use) + `context.md` (history/rules) updated every step |

Chosen by the owner on 2026-11-17:
- Rebuild the earlier SQLite/vanilla scaffold to match the proposal (React + MySQL).
- Use a dedicated MySQL user rather than root for the application.

---

## 3. Environment and commands

Prerequisites: Node.js 20+, MySQL 8 running, Windows PowerShell 5.1+ (current machine).

```powershell
npm install          # install workspaces (root + backend + frontend)
npm run db:setup     # prompts for MySQL root password; creates DB/user; applies schema
npm run db:verify    # checks app credentials and prints table counts
npm run dev          # runs API (:5000) + Vite (:5173) together
npm run build        # production build of the frontend
```

- API base: `http://localhost:5000/api`
- Frontend: `http://localhost:5173`
- Health: `GET /api/health`
- Env keys: `PORT`, `NODE_ENV`, `CLIENT_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DB_HOST`,
  `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (see `.env.example`).

Current database on this machine: MySQL 8.0 (`MySQL80` service running) and a second service
(`MySQL267`). The setup script uses `mysql.exe` from `C:\Program Files\MySQL\MySQL Server 8.0\bin`.

---

## 4. Current implementation — Step 2 complete (pending owner review)

### Backend

| File | Responsibility |
| --- | --- |
| `backend/server.js` | Express app, helmet, CORS, JSON parsing, routes, health, 404/error handling, schema bootstrap, graceful shutdown |
| `backend/src/config.js` | Loads root `.env`, validates required variables, exports config |
| `backend/src/db.js` | mysql2 pool, `query(sql, params)`, `initSchema()`, `closePool()` |
| `backend/src/middleware/auth.js` | `requireAuth` (JWT) and `requireRole(...roles)` |
| `backend/src/routes/auth.js` | `POST /register`, `POST /login`, `GET /me`; validation, hashing, rate limiting |
| `backend/src/routes/departments.js` | `GET /` public department list |
| `backend/src/routes/courses.js` | `GET /` public course catalog with optional department filter |
| `backend/src/routes/categories.js` | `GET /` public category list |
| `backend/src/routes/sections.js` | Teacher section management, enrollment roster, student view |
| `backend/scripts/verify-db.js` | Connection + table/department/user counts |

Details:
- Registration validates name (2–120), email (format/length), password (8–72 bytes), role, optional
  department; returns `201` and does not auto-login.
- Login compares against a dummy bcrypt hash when the email is unknown (timing mitigation), returns a
  generic 401 for any mismatch, and requires the requested role to equal the stored role.
- Auth endpoints are rate-limited: 50 requests / 15 min / IP.
- Teachers can create sections for any course, manage their own roster, and delete only empty sections.
- Students can view the sections they are enrolled in and access roster details only when enrolled.
- Error shape everywhere: `{ "error": "..." }`.
- Duplicate email → `409`; invalid JSON → `400`.

### Frontend

| File | Responsibility |
| --- | --- |
| `frontend/src/main.jsx` | React root, BrowserRouter, AuthProvider |
| `frontend/src/App.jsx` | Routes: `/`, `/login`, `/register`, protected `/dashboard`, 404 |
| `frontend/src/api/client.js` | Axios instance (`/api`), Bearer token injection, global 401 handling, error helper |
| `frontend/src/context/AuthContext.jsx` | Session bootstrap via `/auth/me`, login/register/logout, user state |
| `frontend/src/components/Navbar.jsx` | Brand, links, user chip/avatar, logout |
| `frontend/src/components/AppLayout.jsx` | Navbar + main + footer |
| `frontend/src/components/ProtectedRoute.jsx` | Auth/role guard with loading state |
| `frontend/src/components/RoleSelect.jsx` | Student/Teacher segmented control |
| `frontend/src/pages/LandingPage.jsx` | Public landing/dashboard placeholder (hero, features, workflow) |
| `frontend/src/pages/LoginPage.jsx` | Role + email + password login |
| `frontend/src/pages/RegisterPage.jsx` | Role, name, email, department select, password confirm |
| `frontend/src/pages/DashboardPage.jsx` | Role-aware dashboard shell, workspace cards, sections link |
| `frontend/src/pages/SectionsPage.jsx` | Teacher section builder + roster management, student section view |
| `frontend/src/pages/NotFoundPage.jsx` | 404 |
| `frontend/src/styles.css` | Design system, responsive layout, academic structure styles |

UX notes:
- Public landing page is a placeholder for the future public dashboard/community/archive.
- Dashboard cards say “Coming next” for modules not yet built; this is intentional until later steps.
- Session persists through `localStorage` key `cg_token`; global 401 events clear it.
- Login redirects back to the originally requested protected path.

### Database (implemented)

- `departments` (13 seeded), `users` (FK to departments), `password_resets` (prepared for FR-01
  recovery). See `database/schema.sql`.
- Schema bootstrap runs on API start; `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` keeps it safe.

### Verified in Step 2

- `npm install` — dependencies already installed across the workspaces.
- `node --check` — backend JavaScript files still parse cleanly.
- `npm run build` — Vite production build passes for the updated frontend route and styles.
- The academic structure routes are registered in the API and available under `/api/courses`,
  `/api/categories`, and `/api/sections`.
- The frontend now exposes the academic workflow from the dashboard and navbar.
- Pending owner action: run `npm run db:setup`, `npm run db:verify`, `npm run dev`, and walk the
  README “Step 2 verification checklist” for live section-management checks.

---

## 5. Step plan and status

| Step | Scope | Requirements | Status |
| --- | --- | --- | --- |
| 1 | Foundation + auth | FR-01 (core) | **Built — awaiting owner review** |
| 2 | Courses, categories, sections, enrollments, teacher assignment | FR-03 (base), FR-04 | **Built — awaiting owner review** |
| 3 | Project repositories + file uploads | FR-02, FR-03 | **Built — awaiting owner review** |
| 4 | Status workflow, milestones, tasks, deadlines, progress | FR-06, FR-09 | Implemented — MySQL check pending |
| 5 | Review workflow: accept/request changes, feedback, marks, ratings | FR-08 | **Built — awaiting owner review** |
| 6 | Project comments + notifications | FR-07, FR-11 | **Built — awaiting owner review** |
| 7 | Public text/photo posts + opinions | FR-13, FR-14 | **Implemented — awaiting owner review** |
| 8 | Public dashboard data, search/filter, archive | FR-05, FR-10, FR-12 | Not started |
| 9 | Password recovery, testing, hardening, docs polish | FR-01 (recovery), NFRs | Not started |

Notes:
- FR-05 dashboard work is cumulative: Step 1 provides the shell; later steps feed real data.
- Password recovery was intentionally deferred to Step 9 because it needs a mail transport
  (Nodemailer). `password_resets` is already in the schema.
- Archive is not a separate table; it is `projects.status = 'Archived'` + `archived_at`.

---

## 6. Domain and coding conventions

- **Roles:** `Student`, `Teacher` (never lowercase in persisted/API values).
- **IDs:** tables use `<entity>_id` primary keys (`user_id`, `project_id`, …), as in the proposal ER.
- **Emails:** trimmed and lowercased before storage/lookup.
- **Passwords:** bcrypt cost 12; never returned by any endpoint.
- **JWT payload:** `{ id, role, name }`; expires per `JWT_EXPIRES_IN` (default `1d`).
- **Private data:** project/file/review routes must verify ownership or teacher assignment; public
  routes only expose `visibility = 'Public'`, archived/public data.
- **SQL:** always parameterized; use `query(sql, params)`; return arrays for SELECTs.
- **Transactions:** use `pool.getConnection()` when a multi-table write must be atomic (later steps).
- **Uploads:** store under `uploads/` (git-ignored), random file names, validate type/size (Step 3).
- **API errors:** `{ error }` + correct status (400 validation, 401 auth, 403 role, 404 missing,
  409 conflict, 500 unexpected).
- **State:** server is the source of truth; frontend fatches with Axios and handles 401 centrally.
- **No comments in code unless necessary**, per current coding preference; keep modules small.
- **React:** function components, hooks, React Router v7 declarative routes.
- **CSS:** one global stylesheet with CSS variables; mobile-first responsiveness.

---

## 7. Known gaps / follow-ups

- Step 1 runtime checks depend on the owner completing `npm run db:setup` (root password prompt).
- No automated tests yet (Jest planned in Step 9).
- No password recovery endpoints yet (`password_resets` table exists).
- No refresh tokens; JWT expiry sends the user back to login.
- Rate limiter uses in-memory store (fine for single instance; revisit for scale).
- No production deployment config yet (build/preview documented).

---

## 8. Conversation log

### 2026-11-17 — Initial request from owner (verbatim)

```text
CAPSTONE GRID
Project Requirements Analysis
Project Title: Capstone Grid – A Centralized Platform for Submitting, Reviewing, Managing and Showcasing University Capstone Projects
1. Introduction
Capstone Grid is to provide a centralized platform for capstone projects in a university.  Storing, submitting, organizing, reviewing and exploring capstone projects. All users can access the common dashboard and explore public projects. Registered users can have Student or Teacher roles. Students can create project repositories and store full-stack code, reports, descriptions, images and related files. Teachers can create sections, enroll students, review and accept projects, provide feedback, marks and ratings, and monitor progress. Users can also publish text/photo posts and give opinions on specific posts. Projects can be archived for future reference.

2. Project Overview
Capstone Grid is a full-stack web application, built with React.js, Node.js and MySQL, that brings the whole capstone project cycle into one place. Students keep their project repositories, reports and files on the platform; teachers organize sections, review submissions and monitor progress; and a common dashboard lets every user explore public projects and community posts.
The system is organized around the following main modules:
•	Authentication and roles: registration, login and Student/Teacher roles with role-based access.
•	Project repository: project creation and storage of source code, reports, descriptions, images and related files.
•	Section management: sections, student enrollment and project assignment by teachers.
•	Review and progress: review, feedback, marks, ratings, milestones, deadlines and progress tracking.
•	Common dashboard and community: public text/photo posts, opinions on posts, search and filters, and notifications.
•	Archive: storing completed projects for future reference and public exploration.
3. Problem Statement
Capstone projects in a university are commonly managed through scattered tools such as email, messaging apps, shared drives and paper forms. This creates several problems:
•	Project files, reports and versions are stored in different places and are easily lost or overwritten.
•	Teachers have no single view of every student’s submission status, progress and deadlines.
•	Feedback, marks and ratings are delayed, scattered across channels and hard to trace later.
•	Deadlines and review requests are announced informally, so students and teachers miss updates.
•	Completed projects are rarely archived in a searchable way, so past work cannot be explored or learned from by future students.
•	There is no common place where students and teachers can showcase work and exchange opinions.
There is a need for a centralized, role-based platform that manages the capstone cycle from project creation to archive in a structured and transparent way.
4. Objectives
The main objective of Capstone Grid is to provide one centralized platform for storing, submitting, organizing, reviewing and exploring university capstone projects. The specific objectives are:
•	Provide separate Student and Teacher accounts with secure, role-based access.
•	Let students create project repositories and store code, reports, descriptions, images and related files.
•	Let teachers create sections, enroll students, review projects and give feedback, marks and ratings.
•	Track project status, milestones, deadlines and completion progress in one place.
•	Support communication between students and teachers through project comments and notifications.
•	Offer a common dashboard with public projects, posts and opinions, with search and filters.
•	Archive completed projects so they can be accessed and explored in the future.
•	Keep private student/teacher project information clearly separated from public content.
5. Target Users
•	Students: create and manage their own projects, upload files, submit work, view feedback and track progress.
•	Teachers / Supervisors: create sections, enroll students, review submissions, give feedback, marks and ratings, and monitor progress.
•	General visitors: explore public projects and dashboard posts through the common dashboard.
•	Department and university: benefit indirectly from an organized, searchable archive of completed capstone projects.
The detailed functions and access level of each user type are described in the Stakeholders section.
6. Project Scope
In Scope
•	User registration, login, logout and password recovery for Students and Teachers.
•	Project creation, file upload, submission, resubmission and status tracking.
•	Departments, courses, semesters, categories, sections and student enrollment.
•	Teacher review, feedback, marks, ratings, milestones, tasks and deadlines.
•	Project comments, notifications, search and filter, and the project archive.
•	Public dashboard with text/photo posts and opinions on posts.
•	Responsive web interface for desktop and mobile browsers.
Out of Scope
•	Native mobile applications.
•	Automatic plagiarism detection or automatic grading.
•	Live video or voice communication.
•	Integration with external university systems (for example ERP or LMS).
7. Functional Requirements
ID	Feature	Requirement

FR-01	
User Authentication	
Separate Student and Teacher login with registration, logout and password recovery.


FR-02	
Project Submission	
Students can create projects and upload source code, reports, descriptions and related files.


FR-03	
Project Categories	
Projects can be organized by department, course, semester and category.


FR-04	
Teacher Assignment	
Teachers can create sections, enroll students and manage assigned projects.


FR-05	
Project Dashboard	
Common dashboard displays projects, assignments, deadlines and updates according to user access.


FR-06	
Project Tracking	Students and teachers can create, edit, update and track project status and progress.


FR-07	
Communication	
Students and teachers can communicate through project messages/comments.


FR-08	Review & Feedback	
Teachers can review submissions and provide feedback, marks and ratings.


FR-09	
Progress Tracking	
Project milestones, tasks, deadlines and completion progress can be recorded.


FR-10	Search & Filter	
Users can find projects by name and filter by student, teacher, category, department or status.


FR-11	
Notifications	
Users receive notifications for assignments, submissions, feedback and deadlines.


FR-12	Project Archive	
Completed projects and reports can be stored and accessed as an archive.


FR-13	Public Dashboard Posts	
Users can publish normal text/photo posts on the common dashboard.


FR-14	Post Opinions	
Other users can give opinions/comments directly on a specific post.



8. Non-Functional Requirements
Area	Requirement
Security	Secure login, password hashing, role-based access and protected private project files.
Performance	Dashboard, search and normal operations should provide responsive performance.
Usability	Simple, consistent and responsive interface for desktop and mobile.
Reliability	Proper error handling, database/file backup and recovery support.
Scalability	The system should support increasing users, projects and stored files.
Maintainability	Modular code, documented APIs, version control and testing.
Data Integrity	Validate project data, file uploads and relationships between users, teachers and projects.
Privacy	Private project information must not be visible to unauthorized users.
9. Key Features
•	Role-based access: separate Student and Teacher accounts; private project data is visible only to authorized users.
•	Project repository: create projects and store source code, reports, descriptions and images in one repository.
•	Section and enrollment management: teachers create sections, enroll students and manage assigned projects.
•	Review workflow: submit, review, accept or request changes, update and resubmit.
•	Feedback, marks and ratings: structured feedback, marks and ratings from teachers.
•	Progress tracking: milestones, tasks, deadlines and completion progress for every project.
•	Common dashboard and community posts: text/photo posts and opinions on specific posts.
•	Search and filter: find projects by name and filter by student, teacher, category, department or status.
•	Notifications: alerts for assignments, submissions, feedback and deadlines.
•	Project archive: completed projects stored for future reference and public exploration.
10. Stakeholders
User	Main Functions	Access
Student	
Create/manage own projects, upload files, submit projects, view feedback and progress; explore projects, search/filter projects, view dashboard posts and give opinions/comments.
	
Own projects + common dashboard/public content.
Teacher	
Create sections, enroll students, review projects, give feedback/marks/ratings and monitor progress; explore projects, search/filter projects, view dashboard posts and give opinions/comments.
	
Assigned students/projects + common dashboard/public content.
Developer	
Develop, maintain, test and update the platform, including system code, database, APIs and integrations.
	
Development environment, system code and technical infrastructure.
Software Requirements Specification 
● Interviews: short talks with capstone supervisors and department staff about how                              projects are tracked today and what goes wrong.
● Questionnaires: a simple form for students asking how they submit work, how they get feedback, and what they find frustrating. 
● Observation: looking at how a capstone cycle actually runs, including how deadlines are announced and how reports are collected. 
● Document analysis: reading existing capstone guidelines, submission templates and evaluation forms. 
● Existing system review: looking at similar tools such as learning management systems and project trackers to see what works and what is missing. 
● Prototyping and review: showing early screens to a few users and adjusting the requirements based on their reactions.
11. Basic Project Flow

Student creates project → uploads code/reports/files → submits project → teacher reviews → teacher accepts or requests changes → student updates/resubmits → teacher provides feedback, marks/rating and progress updates → completed project is stored in the archive and may be publicly explored.


12. Technology Stack
Capstone Grid is developed as a full-stack JavaScript application. The React.js client communicates with the Node.js/Express.js REST API over HTTP (JSON), and the API reads and writes data in a MySQL database.
Layer	Technology	Purpose
Frontend	React.js (React Router, Axios)	Single-page, responsive user interface with role-based pages
Backend	Node.js with Express.js	REST API, business logic and access rules
Database	MySQL	Relational storage for users, projects, reviews, posts and notifications
Database access	mysql2 or Sequelize ORM	Connecting the API to MySQL and running queries
Authentication	JWT and bcrypt	Login tokens, password hashing and role-based authorization
File upload	Multer	Upload and validation of project files and images
Email	Nodemailer	Password recovery emails
Tools	Git/GitHub, Postman, VS Code, Jest	Version control, API testing, development and automated tests

13. ER Model
The figure below shows the Entity-Relationship (ER) model of the MySQL database. Each box is an entity (table) with its primary key (PK) and foreign keys (FK). A single bar marks the “one” side of a relationship and a crow’s foot marks the “many” side.
 
Figure 1: ER diagram of Capstone Grid
Entities
Entity	Purpose	Main attributes
departments	University departments	department_id (PK), name
courses	Courses offered by a department	course_id (PK), department_id (FK), course_code, title
users	Student and Teacher accounts	user_id (PK), department_id (FK), name, email (unique), password_hash, role (Student/Teacher), created_at
sections	Sections created by teachers for a course and semester	section_id (PK), course_id (FK), teacher_id (FK), section_name, semester
enrollments	Links students to sections (many-to-many)	enrollment_id (PK), section_id (FK), student_id (FK), enrolled_at
categories	Project categories	category_id (PK), name
projects	Capstone project repository record	project_id (PK), student_id (FK), section_id (FK), category_id (FK), title, description, status, visibility (Private/Public), created_at, submitted_at, archived_at
project_files	Source code, reports, images and other uploaded files	file_id (PK), project_id (FK), file_name, file_type, file_path, uploaded_at
milestones	Milestones and tasks with deadlines and progress	milestone_id (PK), project_id (FK), title, description, deadline, status, progress_percent
reviews	Teacher review of a submission	review_id (PK), project_id (FK), teacher_id (FK), decision (Accepted/Changes Requested), feedback, marks, rating, reviewed_at
project_comments	Messages between student and teacher on a project	comment_id (PK), project_id (FK), user_id (FK), message, created_at
posts	Text/photo posts on the common dashboard	post_id (PK), user_id (FK), content, image_path, created_at
post_comments	Opinions on a specific post	comment_id (PK), post_id (FK), user_id (FK), opinion, created_at
notifications	Alerts for assignments, submissions, feedback and deadlines	notification_id (PK), user_id (FK), type, message, is_read, created_at
password_resets	Tokens for password recovery	reset_id (PK), user_id (FK), token_hash, expires_at, used

Relationships
•	One department has many courses and many users.
•	One course has many sections; one teacher (user) has many sections.
•	Sections and students (users) have a many-to-many relationship, resolved by enrollments.
•	One student (user) owns many projects; one section and one category each have many projects.
•	One project has many files, milestones, reviews and project comments.
•	One teacher (user) writes many reviews; one user writes many project comments.
•	One user creates many posts; one post has many post comments; one user writes many post comments.
•	One user has many notifications and many password reset tokens.
Archived projects are not stored in a separate table; they are projects whose status is set to Archived (with an archived_at date).
14. Expected Outcome
At the end of development, Capstone Grid is expected to deliver:
•	A working full-stack web application that implements the functional requirements FR-01 to FR-14.
•	A single, centralized place for creating, submitting, reviewing and tracking capstone projects.
•	Clear and traceable feedback, marks, ratings and progress for every project.
•	A searchable archive and public showcase of completed capstone projects.
•	Secure separation between public content and private student/teacher project information.
•	A documented REST API, MySQL database design (ER model) and test cases for each feature.
15. Implementation Scope

The development team should implement only the features defined in this document. Each feature should be converted into its database structure, API, user interface, access rules and test cases. The system should maintain clear separation between public content and private student/teacher project information.






•	The End This is my whole project proposal. I want to build the full project eg. All functional and non-functional requirements including the backend. I want to build it in small step by step procedure. Build each step and tell me. I'll check and give you an ok to go. Then you build the next step. Update the readme.md as you go. So other ai knows about the project after reading it. Also make a new file called context. Md. Save every prompt and all chat context in that including this. So other ai understands what to do. Make sure he does that too
```

### 2026-11-17 — Clarification questions and answers

- **Q: Existing scaffold uses SQLite + vanilla JS; how to proceed?**
  - A: “Rebuild per proposal. Change the files if you need.” → React + MySQL.
- **Q: How should the backend connect to MySQL?**
  - A: “Create a dedicated user.” → `capstone_grid` database + `capstone_user` via `npm run db:setup`.

### 2026-11-17 — Step 1 work log (assistant)

Built and wired the foundation:

- Removed the previous SQLite/vanilla scaffold (old `database.sql`, SQLite driver, static HTML/JS).
- Added root npm workspaces and scripts (`dev`, `build`, `db:setup`, `db:verify`).
- Added `.env` (git-ignored) with generated JWT secret / DB password and `.env.example` template.
- Added MySQL schema (`database/schema.sql`): `departments`, `users`, `password_resets`, seeded
  departments; automatic idempotent bootstrap on API start.
- Added PowerShell DB setup script that prompts for the root password securely, creates the database
  and dedicated user, and applies the schema.
- Built Express API: health, departments, register, login, me; JWT/bcrypt, validation, rate limiting,
  helmet/CORS, centralized error handling, graceful shutdown.
- Built React SPA: landing (public dashboard placeholder), login, register with department select,
  protected dashboard, 404, responsive global stylesheet.
- Rewrote `README.md` and created this `context.md`.

Verification:
- Frontend production build and backend syntax checks pass for Step 4.
- MySQL connection is currently blocked: `npm run db:verify` receives
  `ER_ACCESS_DENIED_ERROR` for the configured application user. Run `npm run db:setup` with the
  MySQL root password, then `npm run db:verify` and `npm run dev`; follow the README Step 4 checklist.

Open items: restore MySQL access, configure a Git remote/repository, and get owner review before Step 5.

---

## 9. Next step (only after approval)

Step 5 is built and awaits owner review. Continue with Step 6 only after explicit approval.

### 2026-11-18 — Step 5 review workflow work log (assistant)

- Owner prompt (verbatim): "ok its running fine , now you go for step by step development again , and ask me after every dtep you developed"
- Files added/changed: `backend/src/db.js`, `backend/src/routes/projects.js`,
  `backend/scripts/verify-db.js`, `database/schema.sql`, `database/schema.sqlite.sql`,
  `frontend/src/components/ReviewPanel.jsx`, `frontend/src/pages/ProjectsPage.jsx`,
  `frontend/src/styles.css`, `README.md`, `context.md`.
- Schema/API changes: added persistent review history; added owner/assigned-teacher review reads and
  assigned-teacher decisions; review writes update project status transactionally; a Changes Requested
  project can enter revision and be resubmitted.
- Decisions: marks are 0–100 with up to two decimals; ratings are whole numbers 1–5; feedback is
  required. Review records are append-only and private to the project owner and assigned teacher.
  Submitted and accepted projects cannot be edited or receive uploads until changes are requested.
- Verification performed: `npm run db:verify` passed (SQLite; 12 tables, 13 departments, 6 users,
  0 residual reviews); `npm run build`, backend `node --check`, and `git diff --check` passed.
  Live API integration passed authorization, validation, decision, resubmission, immutable submitted
  state, and review-history checks.
- Known issues/follow-ups: MySQL and the manual browser checklist were not exercised in this
  environment; owner should complete the Step 5 checklist below before approving Step 6.
- Next step proposal: Step 6 — project comments and notifications, only after explicit owner approval.

### 2026-11-19 — Step 6 communication work log (assistant)

- Owner prompt (verbatim): "okay everything fine , go for next step development"
- Files added/changed: `database/schema.sql`, `database/schema.sqlite.sql`,
  `backend/src/notifications.js`, `backend/src/routes/notifications.js`,
  `backend/src/routes/projects.js`, `backend/src/routes/sections.js`, `backend/server.js`,
  `backend/scripts/verify-db.js`, `frontend/src/components/NotificationCenter.jsx`,
  `frontend/src/components/ProjectCommentsPanel.jsx`, `frontend/src/components/Navbar.jsx`,
  `frontend/src/pages/ProjectsPage.jsx`, `frontend/src/styles.css`, `README.md`, `context.md`.
- Schema/API changes: added private project comments and per-user notifications; assignment,
  submission, feedback, comment, and deadline events create in-app notices; users can list and mark
  their own notices read.
- Decisions: deadline notices are emitted when a milestone/task deadline is created or changed; no
  scheduled advance reminder window was added. Comments are limited to project owners and assigned
  teachers. Notifications are in-app and scoped to their recipient.
- Verification performed: `npm run db:verify` passed (SQLite; 14 tables, 13 departments, 6 users,
  no residual test comments/notifications); `npm run build`, backend `node --check`, and
  `git diff --check` passed. Live API integration passed assignment, comment access, deadline,
  submission, feedback, and per-user read-state checks.
- Known issues/follow-ups: the Step 6 browser checklist remains for owner review; MySQL schema was
  not exercised against a live MySQL server. Deadline notices are event-based, not scheduled advance
  reminders, and notifications are in-app only.
- Next step proposal: Step 7 — public text/photo posts and post opinions, only after explicit owner
  approval.

---

## 10. Append template for the next agent

```md
### YYYY-MM-DD — <step title> work log (assistant)

- Owner prompt (verbatim): ...
- Files added/changed: ...
- Schema/API changes: ...
- Decisions: ...
- Verification performed: ...
- Known issues/follow-ups: ...
- Next step proposal: ...
```

### 2026-11-17 — Step 2 work log (assistant)

- Owner prompt (verbatim): `build step 2`
- Files added/changed: `backend/src/routes/courses.js`, `backend/src/routes/categories.js`,
  `backend/src/routes/sections.js`, `frontend/src/pages/SectionsPage.jsx`, `frontend/src/App.jsx`,
  `frontend/src/components/Navbar.jsx`, `frontend/src/pages/DashboardPage.jsx`,
  `frontend/src/styles.css`, `README.md`, `context.md`.
- Schema/API changes: course and category catalog routes were registered; section creation,
  roster management, and student-enrollment endpoints were implemented and protected by role checks.
- Decisions: keep Step 2 scoped to academic structure only; teacher-only section management,
  student-only enrolled-section views, and a small, production-safe course/category seed set.
- Verification performed: `npm run build` after wiring the routes and page; backend syntax checks remain
  valid for the updated API structure.
- Known issues/follow-ups: live runtime validation still requires a fresh MySQL setup and a browser
  check with `npm run db:setup`, `npm run db:verify`, and `npm run dev` to confirm student/teacher
  flows end-to-end.
- Next step proposal: after owner review, continue with Step 3 project repositories + uploads.

### 2026-11-17 — Step 3 work log (assistant)

- Owner prompt (verbatim): `continue-step-3`
- Files added/changed: `database/schema.sql`, `backend/server.js`, `backend/src/routes/projects.js`,
  `backend/uploads/.gitkeep`, `frontend/src/pages/ProjectsPage.jsx`, `frontend/src/App.jsx`,
  `frontend/src/components/Navbar.jsx`, `frontend/src/pages/DashboardPage.jsx`,
  `frontend/src/styles.css`, `frontend/vite.config.js`, `README.md`, `context.md`.
- Schema/API changes: added `projects` and `project_files` tables, plus a project repository API for
  student-owned project creation, metadata updates, file uploads, and private file downloads guarded by
  access checks.
- Decisions: keep Step 3 scoped to project repositories and upload handling; student ownership is the
  primary access rule, with teachers able to view only projects from their own sections.
- Verification performed: `npm run build` and `node --check` passed for the updated frontend/backend.
- Known issues/follow-ups: DB runtime verification still needs MySQL setup and `npm run db:verify` to
  confirm the new tables and end-to-end project creation/upload flows.
- Next step proposal: after owner review, continue with Step 4 project tracking and milestones.

### 2026-11-17 — Step 4 work log (assistant)

- Owner prompt (verbatim): `ok go live now working fine, keep it workable in same for the whole project even with futher update and building nxt steps also , now go for nxt step ensuring backend , connections, and ready for git push`
- Files added/changed: `database/schema.sql`, `backend/src/routes/projects.js`,
  `frontend/src/components/ProjectTrackingPanel.jsx`, `frontend/src/pages/ProjectsPage.jsx`,
  `frontend/src/components/Navbar.jsx`, `frontend/src/pages/DashboardPage.jsx`,
  `frontend/src/styles.css`, `README.md`, `context.md`.
- Schema/API changes: added project milestone and milestone-task tables, per-project tracking reads,
  owner-only milestone/task CRUD, progress calculations, and sequential Draft → In Progress →
  Submitted status transitions. Assigned teachers can view tracking read-only.
- Decisions: project progress uses completed tasks when tasks exist; otherwise it uses completed
  milestones. Go Live remains supported by rebuilding the frontend into `frontend/dist` after UI
  updates and opening either the root or frontend entry page.
- Verification performed: `npm run build` passed; backend JavaScript syntax checks passed.
- Known issues/follow-ups: `npm run db:verify` could not connect because MySQL rejected the configured
  `capstone_user` credentials (`ER_ACCESS_DENIED_ERROR`). No Git repository or remote is configured
  in this workspace, so a push cannot be performed yet. Do not share or commit `.env` values.
- Next step proposal: after owner review and restoring MySQL access, continue with Step 5 review
  workflow (accept/request changes, feedback, marks, ratings, review history).

### 2026-11-18 — Department seed update

- Owner prompt (verbatim): `add some dept`
- Files changed: `database/schema.sql`, `README.md`, `context.md`.
- Added Information Technology, Software Engineering, Data Science, Biomedical Engineering, and
  Environmental Science, each with a matching capstone course. The idempotent schema seeds these
  into both new and existing databases.
- Verification: checked that the five department names and their course inserts are present. Runtime
  MySQL verification remains pending because MySQL Server is not running on this machine.


### 2026-11-20 — Step 7 community dashboard work log (assistant)

- Owner prompt (verbatim): "okay"
- Files added: `backend/src/routes/posts.js`, `frontend/src/pages/CommunityPage.jsx`.
- Files changed: `database/schema.sql`, `database/schema.sqlite.sql`, `backend/server.js`,
  `backend/scripts/verify-db.js`, `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx`,
  `frontend/src/styles.css`, `README.md`, `context.md`.
- Scope delivered: public feed of the latest 100 posts; authenticated Student/Teacher users can
  publish text-only or photo posts; JPG/PNG/WEBP image uploads are limited to 5 MB; public users
  can read post opinions; authenticated users can add opinions (up to 1,000 characters).
  Posts and opinions are stored in `posts` and `post_comments`; uploaded images are stored under
  the existing ignored `backend/uploads/posts` directory and served through the post image route.
- Decisions: no edit/delete, likes, post notifications, search, or archive functionality was added;
  those are outside the approved Step 7 scope. Existing project, review, tracking, comments and
  notification modules were not rewritten. Integration points were added to register the route and
  expose the Community page in navigation.
- Verification performed: SQLite schema executed successfully in an in-memory database (16 tables;
  both new tables and their foreign keys verified); `node --check` passed for the new route, server
  registration and DB verification script. `npm run build` could not run because dependency installation
  timed out and Vite was unavailable in this environment; offline npm cache did not contain all packages.
- Known issues/follow-ups: frontend build, live API smoke tests and browser verification remain pending
  for logged-out browsing, publishing, image rendering, opinions and persistence. MySQL-specific runtime
  verification also remains pending.
- Next step proposal: Step 8 — public dashboard exploration, search/filter and archived project browsing,
  only after explicit owner approval.


### 2026-11-23 — Step 8 exploration and archive work log (assistant)

- Owner prompt (verbatim): `file ta read koro and next features ta add koro then ager kono code e change korba nh`
- Files added: `frontend/src/pages/ExplorePage.jsx`.
- Files changed: `backend/src/routes/projects.js`, `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/pages/LandingPage.jsx`, `frontend/src/pages/ProjectsPage.jsx`, `frontend/src/styles.css`, `README.md`, `context.md`.
- Scope delivered: public project exploration endpoint with search across title/description/student/supervisor and filters for category, department and status; public project detail endpoint; public archive endpoint; Explore and Archive pages; public details omit repository file paths, private reviews and private comments. Owners can archive accepted public projects; archive records reuse `projects.status = 'Archived'` and `archived_at`.
- Decisions: existing project, authentication, review, tracking, community and notification implementations were retained; no schema migration or new archive table was required. Public browsing is limited to Public projects in Submitted, Under Review, Accepted or Archived states. Only the project owner can request the Accepted → Archived transition, and only for a Public project.
- Verification performed: pending in this environment. The uploaded archive does not include installed `node_modules`; run `npm install`, `npm run db:verify`, `npm run build`, and the Step 8 browser/API checklist in README. Backend syntax checks and database integration checks are still required before considering this step fully verified.
- Known issues/follow-ups: live API/database and browser checks were not run in this environment. Public endpoints currently return up to 100 results per request (no pagination).
- Next step proposal: Step 9 — password recovery, automated tests, validation/security hardening and documentation polish, only after owner review.
