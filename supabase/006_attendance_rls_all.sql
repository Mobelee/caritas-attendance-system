-- Migration 006: Fix Attendance RLS Policy for Students
-- Run this in Supabase SQL Editor to allow students to mark their own attendance

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_student_read" ON attendance;
DROP POLICY IF EXISTS "attendance_student_manage" ON attendance;
DROP POLICY IF EXISTS "attendance_student_insert" ON attendance;
DROP POLICY IF EXISTS "attendance_student_all" ON attendance;

CREATE POLICY "attendance_student_all" ON attendance
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
