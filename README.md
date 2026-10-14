# Capstone Grid

A centralized platform for storing, submitting, organizing, reviewing and exploring university capstone projects.
Students create and submit projects; teachers create sections, review work and give feedback, marks and ratings.

## Tech Stack
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT + bcrypt password hashing, role-based access control

## Project Structure
```
capstone-grid/
├── backend/
│   ├── server.js
│   └── src/
│       ├── db.js
│       ├── middleware/auth.js
│       └── routes/auth.js
├── frontend/
│   ├── index.html        (login)
│   ├── register.html
│   ├── dashboard.html
│   ├── css/style.css
│   └── js/
├── database.sql
├── package.json
├── .env.example
└── README.md
```

## Getting Started
```bash
npm install
cp .env.example .env      # then set a strong JWT_SECRET
npm start
```
Open **http://localhost:5000**

## API (Auth module)
| Method | Endpoint             | Description                          | Access |
| ------ | -------------------- | ------------------------------------ | ------ |
| POST   | /api/auth/register   | Register as student or teacher       | Public |
| POST   | /api/auth/login      | Login (role must match the account)  | Public |
| GET    | /api/auth/me         | Get the logged-in user               | Token  |

## Roadmap
- [x] FR-01 User authentication (register, login, logout, roles)
- [ ] FR-01 Password recovery
- [ ] FR-02 Project submission & file upload
- [ ] FR-03 Project categories
- [ ] FR-04 Sections & teacher assignment
- [ ] FR-05 Project dashboard
- [ ] FR-06 / FR-09 Project & progress tracking
- [ ] FR-07 Messages / comments
- [ ] FR-08 Review & feedback
- [ ] FR-10 Search & filter
- [ ] FR-11 Notifications
- [ ] FR-12 Project archive
- [ ] FR-13 / FR-14 Public posts & opinions
