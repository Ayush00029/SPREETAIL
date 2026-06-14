# Spreetail Split - Shared Expenses Web Application

A time-bound shared expenses management application built using React (Vite) for the frontend, Express for the backend API, and Prisma ORM with SQLite for database management. It supports group expense tracking, member membership windows (join/leave tracking), and a CSV importing staging engine with 19 distinct logical anomaly checks.

## Tech Stack
- **Frontend**: React, React Router, Axios, Custom CSS (modern dark-themed glassmorphism).
- **Backend**: Node.js, Express, Prisma ORM, JWT authentication.
- **Database**: SQLite (file-based database).
- **AI Tool Used**: Google DeepMind's Antigravity agentic coding assistant.

---

## Local Setup Instructions

### Prerequisites
- Node.js (version 18 or higher recommended)
- npm

### 1. Database & Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Prisma migrations to set up the SQLite database:
   ```bash
   npx prisma migrate dev
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend server will run on [http://localhost:5000](http://localhost:5000).

### 2. Frontend Setup
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The web application will open on [http://localhost:5173](http://localhost:5173).

---

## Deployment Configuration

### Frontend (Vercel)
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `VITE_API_URL` (pointing to your Render API url).

### Backend (Render)
- Deploy using the provided `render.yaml` Blueprint to automatically configure a Node.js web service with a persistent disk mount for your SQLite database.
- Database path will map to `/data/dev.db`.
