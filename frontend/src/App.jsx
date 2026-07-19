import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Signup from './pages/Signup'
import FaceEnrollment from './pages/FaceEnrollment'
import StudentDashboard from './pages/student/StudentDashboard'
import CourseRegistration from './pages/student/CourseRegistration'
import LecturerDashboard from './pages/lecturer/LecturerDashboard'
import AttendanceScanner from './pages/lecturer/AttendanceScanner'
import TimetableSetup from './pages/lecturer/TimetableSetup'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  const { session, profile, loading } = useAuth()
  const [faceEnrolled, setFaceEnrolled] = useState(null) // null = unknown yet

  useEffect(() => {
    if (profile?.role === 'student') {
      supabase
        .from('students')
        .select('face_enrolled_at')
        .eq('id', profile.id)
        .single()
        .then(({ data }) => setFaceEnrolled(Boolean(data?.face_enrolled_at)))
    }
  }, [profile])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-ink-soft">Loading…</p>
      </div>
    )
  }

  if (!session || !profile) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (profile.role === 'student') {
    // Block access to the rest of the app until face enrolment is done —
    // attendance simply can't be taken for this student otherwise.
    if (faceEnrolled === false) {
      return (
        <Routes>
          <Route path="*" element={<FaceEnrollment profile={profile} />} />
        </Routes>
      )
    }
    if (faceEnrolled === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <p className="text-sm text-ink-soft">Loading…</p>
        </div>
      )
    }
    return (
      <Routes>
        <Route path="/" element={<StudentDashboard profile={profile} />} />
        <Route path="/courses" element={<CourseRegistration profile={profile} />} />
        <Route path="/onboarding/face-enroll" element={<FaceEnrollment profile={profile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'lecturer') {
    return (
      <Routes>
        <Route path="/" element={<LecturerDashboard profile={profile} />} />
        <Route path="/scan/:sessionId" element={<AttendanceScanner profile={profile} />} />
        <Route path="/timetable" element={<TimetableSetup profile={profile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  if (profile.role === 'admin') {
    return (
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-sm text-ink-soft">No portal configured for this role yet.</p>
    </div>
  )
}
