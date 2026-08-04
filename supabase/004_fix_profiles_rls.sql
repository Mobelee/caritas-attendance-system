-- Migration 004: Fix profiles RLS & strengthen spreadsheet data access
-- Run this in Supabase SQL Editor

-- 1. Allow lecturers to read any student profile
--    (needed for course roster / attendance export to show full names)
CREATE POLICY "profiles_lecturer_read" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lecturers WHERE id = auth.uid()
    )
  );

-- 2. Allow all authenticated users to self-update profile
--    (belt-and-suspenders; already exists via profiles_self_update)
-- Already covered — no change needed.

-- 3. Allow lecturers to read all student rows enrolled in their courses
--    (already handled by students_lecturer_view, confirming it exists)
-- Already covered by schema.sql — no change needed.
