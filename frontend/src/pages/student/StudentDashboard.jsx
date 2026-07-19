import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarDays, CheckCircle2, Circle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function StudentDashboard({ profile }) {
  const [todayClasses, setTodayClasses] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTodaySchedule()

    // Live updates: reflect the instant a lecturer starts/ends a class
    const channel = supabase
      .channel('student-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_sessions' },
        () => loadTodaySchedule()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadTodaySchedule() {
    const dow = new Date().getDay()
    const today = new Date().toISOString().slice(0, 10)

    const { data: timetable } = await supabase
      .from('timetable')
      .select('id, start_time, end_time, venue, course:courses(id, code, title, lecturer:lecturers(id, profile:profiles(full_name)))')
      .eq('day_of_week', dow)
      .in(
        'course_id',
        (
          await supabase.from('enrollments').select('course_id').eq('student_id', profile.id)
        ).data?.map((e) => e.course_id) ?? []
      )
      .order('start_time')

    setTodayClasses(timetable ?? [])

    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('*, course:courses(code, title)')
      .eq('session_date', today)
      .eq('status', 'active')

    setActiveSession(sessions?.[0] ?? null)
    setLoading(false)
  }

  return (
    <Shell title={profile.full_name} subtitle={`Reg No — you're viewing today, ${DAY_NAMES[new Date().getDay()]}`}>
      {activeSession && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red bg-red-light px-4 py-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red" />
          </span>
          <p className="text-sm font-medium text-red-dark">
            {activeSession.course.code} is in session now — attendance is being taken.
          </p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarDays className="h-4 w-4 text-ink-soft" /> Today's classes
        </h2>
        <Link to="/courses" className="flex items-center gap-1.5 text-sm font-medium text-red">
          <BookOpen className="h-4 w-4" /> Manage courses
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading schedule…</p>
      ) : todayClasses.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-soft">No classes scheduled for today.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {todayClasses.map((slot) => (
            <li key={slot.id} className="card flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-red-light">
                <Clock className="h-4 w-4 text-red" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {slot.course.code} · {slot.course.title}
                </p>
                <p className="text-xs text-ink-soft">
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.venue || 'Venue TBA'} ·{' '}
                  {slot.course.lecturer?.profile?.full_name}
                </p>
              </div>
              {activeSession?.course_id === slot.course.id ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-red" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-line" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}
