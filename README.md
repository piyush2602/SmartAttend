# FaceAttend — AI Face Recognition Attendance System

> **Production-level** AI attendance system using real-time face recognition, anti-spoof liveness detection, and a premium dark-mode dashboard.

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-6366f1?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Flask%20%2B%20Python-22d3ee?style=flat-square)
![DB](https://img.shields.io/badge/Database-MongoDB-10b981?style=flat-square)
![AI](https://img.shields.io/badge/AI-DeepFace%20%2F%20FaceNet-f59e0b?style=flat-square)

---

## Features

| Feature | Details |
|---|---|
| 👤 Face Registration | Capture 5 webcam samples → FaceNet embeddings → MongoDB |
| 📸 Live Attendance | Real-time webcam → liveness check → face recognition → auto-mark |
| 🔍 Anti-Spoofing | Eye blink detection (EAR) via MediaPipe — rejects static photos |
| 📊 Dashboard | Stats cards, 7-day bar chart, department pie chart |
| 📋 Attendance Log | Filterable, paginated table |
| 📥 Export | CSV, Excel (.xlsx), and PDF downloads |
| 🔐 JWT Auth | Secure admin login, protected API routes |
| 🎨 UI | Dark-mode, responsive, animated React + Tailwind app |

---

## Project Structure

```
FACE RECOGNITION WEB APP/
├── frontend/              # React + Vite + Tailwind
│   └── src/
│       ├── components/    # Sidebar, Topbar, WebcamCapture, StatCard, etc.
│       ├── pages/         # Dashboard, Users, LiveAttendance, Log, Export, Login
│       ├── services/      # Axios API layer
│       └── context/       # AuthContext (JWT)
└── backend/               # Flask REST API
    ├── routes/            # auth, users, attendance, export
    ├── services/          # face_service (DeepFace), antispoof_service (MediaPipe)
    ├── utils/             # jwt_utils, auth_middleware
    └── app.py             # Entry point
```

---

## Quick Start

### Prerequisites
- Python 3.8–3.11
- Node.js 18+
- MongoDB running on `localhost:27017`

---

### 1. Backend Setup

```bash
cd backend

# Copy env
copy .env.example .env

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Initialize DB and create default admin
python -c "from db import init_db; init_db()"

# Start Flask API
python app.py
```

The backend runs at: **http://localhost:5000**

> **First run**: Create the admin account by calling:
> ```
> POST http://localhost:5000/api/auth/setup
> Body: {"username": "admin", "password": "admin123", "email": "admin@example.com"}
> ```
> This endpoint is disabled after the first admin is created.

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if you cloned with node_modules)
npm install

# Start dev server
npm run dev
```

The frontend runs at: **http://localhost:5173**

---

### 3. Login

| Field | Default |
|---|---|
| Username | `admin` |
| Password | `admin123` |

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Admin login → JWT |
| POST | `/api/auth/setup` | One-time admin creation |
| GET  | `/api/auth/verify` | Verify JWT |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET  | `/api/users/` | List all users |
| POST | `/api/users/` | Create user |
| PUT  | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user + embeddings |
| POST | `/api/users/:id/register-face` | Store face embeddings |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/liveness` | Check liveness for one frame |
| POST | `/api/attendance/mark` | Mark attendance (liveness + recognition) |
| GET  | `/api/attendance/` | Get records (filters: date, department, search, page) |
| GET  | `/api/attendance/stats` | Dashboard statistics |
| GET  | `/api/attendance/today` | Today's records |

### Export
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/export/csv` | Download CSV |
| GET | `/api/export/excel` | Download Excel |
| GET | `/api/export/pdf` | Download PDF |

---

## MongoDB Collections

```js
users       { name, employee_id, department, email, face_registered, created_at }
embeddings  { user_id, embedding[128], sample_index, created_at }
attendance  { user_id, name, employee_id, department, date, time, status, session_id }
admins      { username, password_hash, email }
```

---

## Environment Variables

### Backend (`backend/.env`)
```
MONGO_URI=mongodb://localhost:27017
DB_NAME=face_attendance
JWT_SECRET=your-super-secret-key
JWT_EXPIRY_HOURS=24
CORS_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000/api
```

---

## Notes

- **DeepFace** will auto-download FaceNet model weights (~90MB) on first recognition call. Requires internet.
- **Liveness detection** requires the user to blink **2 times** before recognition proceeds.
- Face matching uses **cosine distance** with threshold `0.4`. Lower = stricter.
- Duplicate attendance per day is prevented automatically.

---

## License
MIT
