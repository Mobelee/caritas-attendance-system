-- ============================================================
-- Additions — run this AFTER supabase/schema.sql
-- Adds: push subscriptions, admin write access, storage bucket note
-- ============================================================

-- ------------------------------------------------------------
-- Push subscriptions (Web Push API)
-- ------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "push_subs_self" on push_subscriptions for all using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Self-signup: a newly authenticated user may create their own
-- profile/student/lecturer row (id must equal their own auth.uid())
-- ------------------------------------------------------------
create policy "profiles_self_insert" on profiles for insert with check (auth.uid() = id);
create policy "students_self_insert" on students for insert with check (auth.uid() = id);
create policy "lecturers_self_insert" on lecturers for insert with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Admin role: full read/write across the academic structure
-- (departments/courses/lecturer assignment are managed by admins)
-- ------------------------------------------------------------
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer;

-- Public read so the signup form can populate a department dropdown
-- before the user has a session yet. Departments contain nothing sensitive.
create policy "departments_public_read" on departments for select using (true);
create policy "departments_admin_write" on departments for all using (is_admin());

create policy "courses_admin_write" on courses for all using (is_admin());
create policy "profiles_admin_read" on profiles for select using (is_admin());
create policy "students_admin_all" on students for all using (is_admin());
create policy "lecturers_admin_all" on lecturers for all using (is_admin());
create policy "timetable_admin_write" on timetable for all using (is_admin());
create policy "attendance_student_insert" on attendance for insert with check (student_id = auth.uid());

-- Departments table needs RLS enabled (was created without it in schema.sql)
alter table departments enable row level security;

-- ------------------------------------------------------------
-- Storage bucket (run once, or create via Dashboard > Storage)
-- ------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('student-photos', 'student-photos', true)
-- on conflict (id) do nothing;
