import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CalendarClock, Play, Plus, Trash2, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'
import { useToast } from '../../hooks/useToast'

export default function LecturerDashboard({ profile }) {
  const [courses, setCourses] = useState([])
  const [departmentId, setDepartmentId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState({ code: '', title: '', level: 400 })

  const navigate = useNavigate()
  const { push } = useToast()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: lecturer } = await supabase
      .from('lecturers')
      .select('department_id')
      .eq('id', profile.id)
      .single()
    setDepartmentId(lecturer?.department_id || null)

    const { data } = await supabase
      .from('courses')
      .select('id, code, title, level, enrollments:enrollments(count)')
      .eq('lecturer_id', profile.id)
      .order('code')
    setCourses(data ?? [])
  }

  async function handleAddCourse(e) {
    e.preventDefault()
    if (!form.code.trim() || !form.title.trim()) {
      push('Please provide course code and title', 'error')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('courses').insert({
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      level: Number(form.level),
      department_id: departmentId,
      lecturer_id: profile.id
    })

    setSubmitting(false)
    if (error) {
      push(error.message || 'Failed to add course', 'error')
      return
    }

    push(`Course ${form.code.toUpperCase()} added successfully!`)
    setForm({ code: '', title: '', level: 400 })
    setShowAddModal(false)
    load()
  }

  async function handleDeleteCourse(courseId, courseCode) {
    if (!window.confirm(`Are you sure you want to delete ${courseCode}?`)) return

    setDeletingId(courseId)
    const { error } = await supabase.from('courses').delete().eq('id', courseId).eq('lecturer_id', profile.id)
    setDeletingId(null)

    if (error) {
      push(error.message || 'Failed to delete course', 'error')
      return
    }

    push(`${courseCode} deleted.`)
    load()
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

    fetch(`${import.meta.env.VITE_API_URL}/notify/class-started/${session.id}`, { method: 'POST' }).catch(() => {})

    navigate(`/scan/${session.id}`)
  }

  return (
    <Shell
      title={profile.full_name}
      subtitle="Your courses & management"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Course
          </button>
          <Link to="/timetable" className="btn-secondary">
            <CalendarClock className="h-4 w-4" /> Timetable
          </Link>
        </div>
      }
    >
      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Add New Course</h3>
              <button onClick={() => setShowAddModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="label">Course Code</label>
                <input
                  required
                  placeholder="e.g. CEE 412"
                  className="input"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Course Title</label>
                <input
                  required
                  placeholder="e.g. Control Systems & Automation"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Level</label>
                <select
                  className="input"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                >
                  {[100, 200, 300, 400, 500].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} Level
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Adding…' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.id} className="card flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink">{course.code}</p>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                  {course.level}L
                </span>
              </div>
              <p className="truncate text-xs text-ink-soft">{course.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                <Users className="h-3.5 w-3.5" /> {course.enrollments?.[0]?.count ?? 0} enrolled
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startClass(course.id)} className="btn-primary">
                <Play className="h-4 w-4" /> Start class
              </button>
              <button
                onClick={() => handleDeleteCourse(course.id, course.code)}
                disabled={deletingId === course.id}
                className="p-2 text-ink-soft hover:text-red hover:bg-red-light rounded"
                title="Delete course"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        {courses.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-soft mb-3">No courses assigned to you yet.</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary mx-auto">
              <Plus className="h-4 w-4" /> Create your first course
            </button>
          </div>
        )}
      </ul>
    </Shell>
  )
}
