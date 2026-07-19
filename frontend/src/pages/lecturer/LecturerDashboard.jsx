import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CalendarClock, Play, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'
import { useToast } from '../../hooks/useToast'

export default function LecturerDashboard({ profile }) {
  const [courses, setCourses] = useState([])
  const navigate = useNavigate()
  const { push } = useToast()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('courses')
      .select('id, code, title, enrollments:enrollments(count)')
      .eq('lecturer_id', profile.id)
      .order('code')
    setCourses(data ?? [])
  }

  async function startClass(courseId) {
    const now = new Date()
    const { data: session, error } = await supabase
      .from('class_sessions')
      .insert({
        course_id: courseId,
        lecturer_id: profile.id,
        session_date: now.toISOString().slice(0, 10),
        scheduled_start: now.toISOString(),
        actual_start: now.toISOString(),
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      push('Could not start class — try again.', 'error')
      return
    }

    // Fire-and-forget: notifies + pushes to enrolled students. Doesn't
    // block navigation to the scanner if the backend is unreachable.
    fetch(`${import.meta.env.VITE_API_URL}/notify/class-started/${session.id}`, { method: 'POST' }).catch(() => {})

    navigate(`/scan/${session.id}`)
  }

  return (
    <Shell
      title={profile.full_name}
      subtitle="Your courses"
      actions={
        <Link to="/timetable" className="btn-secondary">
          <CalendarClock className="h-4 w-4" /> Timetable
        </Link>
      }
    >
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.id} className="card flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{course.code}</p>
              <p className="truncate text-xs text-ink-soft">{course.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                <Users className="h-3.5 w-3.5" /> {course.enrollments?.[0]?.count ?? 0} enrolled
              </p>
            </div>
            <button onClick={() => startClass(course.id)} className="btn-primary">
              <Play className="h-4 w-4" /> Start class
            </button>
          </li>
        ))}
        {courses.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-soft">No courses assigned to you yet.</p>
          </div>
        )}
      </ul>
    </Shell>
  )
}
