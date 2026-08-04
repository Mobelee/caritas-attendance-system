-- Migration 005: Allow authenticated users to read profiles table
-- Run this in Supabase SQL Editor

DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
DROP POLICY IF EXISTS "profiles_lecturer_read" ON profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;

CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');
