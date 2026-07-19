import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'

export default function CourseRegistration({ profile }) {
  const [courses, setCourses] = useState([])
  const [enrolledIds, setEnrolledIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: student } = await supabase
      .from('students')
      .select('department_id, level')
      .eq('id', profile.id)
      .single()

    const { data: available } = await supabase
      .from('courses')
      .select('id, code, title, lecturer:lecturers(profile:profiles(full_name))')
      .eq('department_id', student.department_id)
      .eq('level', student.level)
      .order('code')

    const { data: enrolled } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', profile.id)

    setCourses(available ?? [])
    setEnrolledIds(new Set((enrolled ?? []).map((e) => e.course_id)))
  }

  async function toggleEnroll(courseId) {
    setBusyId(courseId)
    if (enrolledIds.has(courseId)) {
      await supabase.from('enrollments').delete().eq('student_id', profile.id).eq('course_id', courseId)
    } else {
      await supabase.from('enrollments').insert({ student_id: profile.id, course_id: courseId })
    }
    await load()
    setBusyId(null)
  }

  return (
    <Shell title="Course registration" subtitle="These sync automatically with your lecturer">
      <ul className="space-y-3">
        {courses.map((course) => {
          const isEnrolled = enrolledIds.has(course.id)
          return (
            <li key={course.id} className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{course.code}</p>
                <p className="truncate text-xs text-ink-soft">
                  {course.title} · {course.lecturer?.profile?.full_name || 'Lecturer TBA'}
                </p>
              </div>
              <button
                onClick={() => toggleEnroll(course.id)}
                disabled={busyId === course.id}
                className={isEnrolled ? 'btn-secondary' : 'btn-primary'}
              >
                {isEnrolled ? (
                  <>
                    <Check className="h-4 w-4" /> Registered
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Register
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Shell>
  )
}
