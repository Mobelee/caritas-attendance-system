# Caritas University Attendance System

Facial-recognition attendance management, built mobile-first as a PWA.
Student portal, lecturer portal, and admin panel — one codebase, role-based routing.

## Stack

- **Frontend:** React (Vite), Tailwind, `lucide-react`, `face-api.js`, `xlsx` (SheetJS), PWA via `vite-plugin-pwa` (custom service worker with push support)
- **Backend:** Node.js/Express — reminder cron job, class-start push trigger, seed script
- **Data:** Supabase (Postgres + Auth + Storage + Realtime)

## What's in each portal

- **Student** — sign up, one-time face enrolment, course registration (auto-syncs to lecturer), today's live timetable, in-app + push notifications
- **Lecturer** — sign up, course list, "Start class" (triggers push to enrolled students), timetable builder, live attendance scanner with automatic face matching + manual fallback, Excel export on class end
- **Admin** — departments, courses, lecturer assignment, read-only roster of all students/lecturers with face-enrolment status

## Getting it running

### 1. Supabase project
1. Create a project at supabase.com.
2. Open **SQL Editor** → run `supabase/schema.sql`, then run `supabase/002_additions.sql`.
3. Create a Storage bucket named `student-photos` (public read, authenticated write) — Dashboard → Storage → New bucket.
4. Grab your Project URL, anon key, and **service-role key** from **Project Settings → API**. The service-role key is for the backend only — never ship it to the frontend.

### 2. Face recognition models
`face-api.js` needs its model weight files served statically. Download the
`weights` folder from the face-api.js GitHub repo and place the files in:
```
frontend/public/models/
```
(tiny_face_detector, face_landmark_68, face_recognition model files — about 6 files, a few MB total)

### 3. VAPID keys (for push notifications)
```bash
npx web-push generate-vapid-keys
```
Put the public key in `frontend/.env.local` as `VITE_VAPID_PUBLIC_KEY`, and both
keys in `backend/.env` as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

### 4. Frontend
```bash
cd frontend
cp .env.example .env.local   # fill in Supabase URL/key, API URL, VAPID public key
npm install
npm run dev
```

### 5. Backend
```bash
cd backend
cp .env.example .env          # fill in Supabase URL, service-role key, VAPID keys
npm install
npm run dev
```

### 6. Seed demo data (optional but recommended for a defense/demo)
```bash
cd backend
npm run seed
```
Creates one department, one lecturer, one admin, three students, a course, and
a timetable slot starting 5 minutes from now — enough to walk through the
whole flow live. All demo accounts share the password printed by the script.
**Note:** seeded students still need to go through face enrolment on first
login — the script can't do that part for them (it needs a real camera).

## How the pieces fit together

- **Sign up** — `Signup.jsx` creates the Supabase auth user, then a `profiles`
  row and a `students`/`lecturers` row in the same flow. Students are then
  routed straight into face enrolment; they can't reach the rest of the app
  until it's done (enforced in `App.jsx`, not just hidden in the UI).
- **Face enrolment** — `FaceEnroll.jsx` captures 3 samples, averages them into
  one descriptor, and saves it to `students.face_descriptor`. One-time only.
- **Course registration** — student toggles courses in `CourseRegistration.jsx`.
  Since `courses.lecturer_id` is already set when the course was created, a new
  `enrollments` row is all that's needed — nothing to "sync" separately.
- **Admin panel** — `AdminDashboard.jsx` manages departments, courses, and
  lecturer assignment, and shows every student's face-enrolment status at a
  glance. This is where you set up the academic structure before students and
  lecturers arrive.
- **Timetable** — lecturer adds weekly slots in `TimetableSetup.jsx`. Students'
  "today" view is just a join of their enrollments against `timetable`.
- **Starting a class** — lecturer taps "Start class," which creates an
  `active` row in `class_sessions`, pushes a notification to every enrolled
  student (backend `/notify/class-started/:id`), and opens the scanner.
  Supabase Realtime also pushes the change straight to student dashboards.
- **Reminders** — the backend's cron job (`reminderScheduler.js`) checks every
  minute for slots starting in 30 minutes, writes `notifications` rows, and
  sends real push notifications via `pushService.js`.
- **Notifications UI** — the bell icon in `Shell.jsx` shows unread count and a
  dropdown list (`NotificationBell.jsx`), backed by Supabase Realtime so new
  ones appear instantly without a refresh.
- **Taking attendance** — `AttendanceScanner.jsx` loads the full roster for
  that course (students without a saved descriptor still appear, just flagged
  for manual marking), streams the lecturer's camera through `face-api.js`
  every ~1.2s, and matches by Euclidean distance. A match under
  `MATCH_THRESHOLD` marks attendance instantly. Each roster row also has a
  **"Mark present" fallback button** for when a camera match doesn't land —
  attendance shouldn't be blocked by hardware being fussy on demo day.
- **Ending a class** — writes `status: 'ended'`, then generates the `.xlsx`
  client-side with SheetJS: Name, Reg No, Department, Date & Time, Lecturer
  Name, Present/Absent — and triggers the browser download.

## Deployment

- **Frontend** → Vercel (`frontend/vercel.json` included) or Netlify. Set the
  same env vars as `.env.local` in the hosting dashboard.
- **Backend** → `backend/Dockerfile` for any container host, or `render.yaml`
  for a one-click Render deploy. Set env vars in the host dashboard — never
  commit `.env`.
- **Database** → already hosted, it's Supabase.

## Suggested build/verification order before your defense

1. Run both schema files, create the storage bucket
2. `npm run seed` in the backend, confirm the demo accounts can log in
3. Complete face enrolment for one seeded student on an actual device with a camera
4. Confirm course registration reflects on the lecturer's roster
5. Add a timetable slot, confirm it shows on the student dashboard
6. Start a class, confirm the push notification arrives and the scanner loads
7. Test both the automatic match and the manual "Mark present" fallback
8. End the class, confirm the Excel file downloads with correct data
9. Log in as the admin account, confirm you can add/edit departments and courses

## Notes on the visual system

Flat colors only, no gradients, no emoji — `lucide-react` icons throughout.
Tokens live in `frontend/tailwind.config.js`:
- `red` (#A6151F) — primary brand color, matches the existing Caritas portal header
- `ink` — text, in three weights (default / soft / faint)
- `canvas` / `surface` — page background vs. card background

App icons (`frontend/public/icons/`) are flat red squares with a white "CU"
monogram — regenerate with `gen_icons.py` if you want a different mark.
