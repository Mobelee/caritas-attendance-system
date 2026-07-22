import { useEffect, useState } from 'react'
import { Check, Filter, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'

export default function CourseRegistration({ profile }) {
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [enrolledIds, setEnrolledIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: student } = await supabase
      .from('students')
      .select('department_id, level')
      .eq('id', profile.id)
      .single()

    const { data: depts } = await supabase.from('departments').select('id, name, code').order('name')
    setDepartments(depts ?? [])

    // Set default filter to student's own department if available
    if (student?.department_id) {
      setSelectedDept('all') // show all by default so student sees all options, or can filter
    }

    const { data: available } = await supabase
      .from('courses')
      .select('id, code, title, level, department_id, department:departments(name, code), lecturer:lecturers(profile:profiles(full_name))')
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

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.code.toLowerCase().includes(search.toLowerCase()) ||
      course.title.toLowerCase().includes(search.toLowerCase())
    const matchesDept = selectedDept === 'all' || course.department_id === selectedDept
    const matchesLevel = selectedLevel === 'all' || course.level === Number(selectedLevel)
    return matchesSearch && matchesDept && matchesLevel
  })

  return (
    <Shell title="Course registration" subtitle="Register for courses across departments and levels">
      {/* Search and Filters */}
      <div className="card mb-6 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            placeholder="Search by course code or title (e.g. CEE 415)..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">Filter by Department</label>
            <select
              className="input text-xs"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs">Filter by Level</label>
            <select
              className="input text-xs"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              {[100, 200, 300, 400, 500].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl} Level
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {filteredCourses.map((course) => {
          const isEnrolled = enrolledIds.has(course.id)
          return (
            <li key={course.id} className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{course.code}</p>
                  <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                    {course.level}L
                  </span>
                  {course.department?.code && (
                    <span className="rounded bg-red-light px-1.5 py-0.5 text-[10px] font-medium text-red">
                      {course.department.code}
                    </span>
                  )}
                </div>
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
        {filteredCourses.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-soft">No courses found matching your criteria.</p>
          </div>
        )}
      </ul>
    </Shell>
  )
}
