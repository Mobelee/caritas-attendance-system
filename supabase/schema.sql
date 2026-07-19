-- ============================================================
-- Caritas University Attendance System — Supabase Schema
-- ============================================================
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Profiles (extends Supabase auth.users)
-- ------------------------------------------------------------
create type user_role as enum ('student', 'lecturer', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. Departments
-- ------------------------------------------------------------
create table departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  code text not null unique
);

-- ------------------------------------------------------------
-- 3. Students
-- ------------------------------------------------------------
create table students (
  id uuid primary key references profiles(id) on delete cascade,
  reg_no text not null unique,
  department_id uuid references departments(id),
  level int not null,                        -- 100, 200, 300, 400
  photo_url text,                             -- Supabase Storage path
  face_descriptor jsonb,                      -- 128-length float array from face-api.js
  face_enrolled_at timestamptz,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. Lecturers
-- ------------------------------------------------------------
create table lecturers (
  id uuid primary key references profiles(id) on delete cascade,
  staff_id text not null unique,
  department_id uuid references departments(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. Courses
-- ------------------------------------------------------------
create table courses (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,                  -- e.g. CPE 415
  title text not null,
  department_id uuid references departments(id),
  level int not null,
  lecturer_id uuid references lecturers(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. Enrollments (student <-> course, auto-syncs to lecturer)
-- ------------------------------------------------------------
create table enrollments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  created_at timestamptz default now(),
  unique (student_id, course_id)
);

-- ------------------------------------------------------------
-- 7. Timetable (recurring weekly slots per course)
-- ------------------------------------------------------------
create table timetable (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade,
  day_of_week int not null,                   -- 0=Sunday .. 6=Saturday
  start_time time not null,
  end_time time not null,
  venue text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 8. Class sessions (an actual instance of a class happening)
-- ------------------------------------------------------------
create type session_status as enum ('scheduled', 'active', 'ended', 'cancelled');

create table class_sessions (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade,
  lecturer_id uuid references lecturers(id),
  timetable_id uuid references timetable(id),
  session_date date not null,
  scheduled_start timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  status session_status default 'scheduled',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 9. Attendance
-- ------------------------------------------------------------
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references class_sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  marked_at timestamptz default now(),
  method text default 'face_recognition',     -- face_recognition | manual
  confidence numeric(5,4),                    -- match confidence 0..1
  unique (session_id, student_id)
);

-- ------------------------------------------------------------
-- 10. Notifications
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references class_sessions(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,                         -- reminder_30 | class_started | attendance_marked
  read boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_course on enrollments(course_id);
create index idx_sessions_course on class_sessions(course_id);
create index idx_sessions_status on class_sessions(status);
create index idx_attendance_session on attendance(session_id);
create index idx_notifications_user on notifications(user_id, read);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table students enable row level security;
alter table lecturers enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table timetable enable row level security;
alter table class_sessions enable row level security;
alter table attendance enable row level security;
alter table notifications enable row level security;

-- Profiles: users see/edit their own row
create policy "profiles_self_select" on profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);

-- Students: student sees own row; lecturers see students enrolled in their courses
create policy "students_self" on students for select using (auth.uid() = id);
create policy "students_self_update" on students for update using (auth.uid() = id);
create policy "students_lecturer_view" on students for select using (
  exists (
    select 1 from enrollments e
    join courses c on c.id = e.course_id
    where e.student_id = students.id and c.lecturer_id = auth.uid()
  )
);

-- Courses: readable by everyone authenticated (needed for course registration browsing)
create policy "courses_read_all" on courses for select using (auth.role() = 'authenticated');
create policy "courses_lecturer_manage" on courses for all using (lecturer_id = auth.uid());

-- Enrollments: student manages own, lecturer reads relevant
create policy "enrollments_student_manage" on enrollments for all using (student_id = auth.uid());
create policy "enrollments_lecturer_read" on enrollments for select using (
  exists (select 1 from courses c where c.id = enrollments.course_id and c.lecturer_id = auth.uid())
);

-- Timetable: readable by all authenticated, writable by owning lecturer
create policy "timetable_read_all" on timetable for select using (auth.role() = 'authenticated');
create policy "timetable_lecturer_manage" on timetable for all using (
  exists (select 1 from courses c where c.id = timetable.course_id and c.lecturer_id = auth.uid())
);

-- Class sessions: readable by enrolled students + owning lecturer
create policy "sessions_lecturer_manage" on class_sessions for all using (lecturer_id = auth.uid());
create policy "sessions_student_read" on class_sessions for select using (
  exists (
    select 1 from enrollments e where e.course_id = class_sessions.course_id and e.student_id = auth.uid()
  )
);

-- Attendance: student reads own, lecturer manages for own sessions
create policy "attendance_student_read" on attendance for select using (student_id = auth.uid());
create policy "attendance_lecturer_manage" on attendance for all using (
  exists (select 1 from class_sessions s where s.id = attendance.session_id and s.lecturer_id = auth.uid())
);

-- Notifications: user reads/updates own
create policy "notifications_self" on notifications for all using (user_id = auth.uid());
