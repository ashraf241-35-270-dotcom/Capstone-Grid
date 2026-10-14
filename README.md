# FoodBridge — Full Stack Food Donation Platform

FoodBridge connects **food donors** (restaurants, hotels, individuals) with **receivers**
(NGOs, people in need), reducing food waste. An **admin** oversees the whole system.

## Tech Stack
| Layer      | Technology |
|------------|------------|
| Frontend   | React.js (React Router, Axios) |
| Backend    | Node.js + Express.js |
| Database   | MySQL |
| Auth       | JWT + bcrypt (password hashing) |
| Extra APIs | Google Maps API (location), Nodemailer (Email API) |

## Project Structure
```
foodbridge/
├── database.sql              # MySQL schema (run this first)
├── backend/
│   ├── server.js             # Express app entry point
│   ├── config/db.js          # MySQL connection pool
│   ├── middleware/auth.js    # JWT verification + role-based access
│   ├── controllers/          # Business logic (auth, donations, admin)
│   ├── routes/                # /api/auth, /api/donations, /api/admin
│   └── utils/email.js        # Sends email notifications
└── frontend/
    └── src/
        ├── api/axios.js      # Pre-configured API client
        ├── context/AuthContext.js  # Global login state
        ├── components/       # Navbar, FoodCard, PrivateRoute
        └── pages/             # Login, Register, Donor/Receiver/Admin dashboards
```

## How the System Works (for your presentation)

1. **Register/Login** — A user signs up as a Donor or Receiver. Passwords are hashed
   with bcrypt; login returns a JWT token used to authenticate future requests.
2. **Role-Based Access** — Middleware (`verifyToken`, `allowRoles`) checks the JWT
   and blocks routes that don't match the user's role (donor/receiver/admin).
3. **Donor Dashboard** — Donor adds food (name, quantity, expiry, pickup address).
   It's stored in the `donations` table with status `available`.
4. **Receiver Dashboard** — Receiver browses `available` donations and sends a
   request. This creates a row in `requests` and flips the donation to `requested`,
   also emailing the donor.
5. **Status Tracking** — Donation status moves: `available → requested → delivered`.
   The donor marks it `delivered` once handed over.
6. **Admin Dashboard** — Admin sees stats (total users, donations, delivered count),
   can disable misbehaving users, and remove inappropriate donation listings.

## Setup Instructions

### 1. Database
```bash
mysql -u root -p < database.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # fill in your MySQL password, JWT secret, email credentials
npm run dev                # starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm start                  # starts on http://localhost:3000
```

## API Endpoints (Quick Reference)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Create account |
| POST | /api/auth/login | Public | Log in, get JWT |
| POST | /api/donations | Donor | Add a new donation |
| GET  | /api/donations/mine | Donor | View own donations |
| PUT  | /api/donations/:id/status | Donor | Update status |
| GET  | /api/donations/available | Receiver | Browse available food |
| POST | /api/donations/request | Receiver | Request a donation |
| GET  | /api/donations/requests/mine | Receiver | View own requests |
| GET  | /api/admin/stats | Admin | Dashboard statistics |
| GET  | /api/admin/users | Admin | List all users |
| PUT  | /api/admin/users/:id/toggle | Admin | Enable/disable a user |
| GET  | /api/admin/donations | Admin | List all donations |
| DELETE | /api/admin/donations/:id | Admin | Remove a donation |

## Notes on Google Maps API
The `latitude`/`longitude` fields are already in the database and forms are ready
to accept them. To fully integrate Google Maps (e.g., an address-autocomplete box
or a map showing nearby donations), add the `@react-google-maps/api` package on the
frontend and use your `REACT_APP_GOOGLE_MAPS_API_KEY`.
