-- Migration 003: Update departments to the 5 required ones
-- Run this in Supabase SQL Editor to add/update department records

-- Insert the 5 departments (ignore conflicts on code)
INSERT INTO departments (name, code) VALUES
  ('Computer Engineering',                  'CPE'),
  ('Electrical & Electronics Engineering',  'EEE'),
  ('Mechanical Engineering',                'MEE'),
  ('Chemical Engineering',                  'CHE'),
  ('Computer Science',                      'CSC')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
