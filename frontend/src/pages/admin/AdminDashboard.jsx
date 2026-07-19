import { useEffect, useState } from 'react'
import { Building2, BookOpen, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'
import { useToast } from '../../hooks/useToast'

const TABS = [
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'people', label: 'People', icon: Users }
]

export default function AdminDashboard() {
  const [tab, setTab] = useState('departments')

  return (
    <Shell title="Admin" subtitle="Academic structure and assignments">
      <div className="mb-6 flex gap-2 border-b border-line">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === key ? 'border-red text-red' : 'border-transparent text-ink-soft'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'courses' && <CoursesTab />}
      {tab === 'people' && <PeopleTab />}
    </Shell>
  )
}

function DepartmentsTab() {
  const { push } = useToast()
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({ name: '', code: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments(data ?? [])
  }

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('departments').insert(form)
    if (error) return push(error.message, 'error')
    setForm({ name: '', code: '' })
    push('Department added.')
    load()
  }

  async function remove(id) {
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (error) return push('Could not delete — it may still have courses attached.', 'error')
    load()
  }

  return (
    <div>
      <form onSubmit={add} className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Department name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Engineering" />
        </div>
        <div className="w-full sm:w-32">
          <label className="label">Code</label>
          <input required className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CPE" />
        </div>
        <button type="submit" className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
      </form>

      <ul className="space-y-2">
        {departments.map((d) => (
          <li key={d.id} className="card flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{d.name}</p>
              <p className="text-xs text-ink-faint">{d.code}</p>
            </div>
            <button onClick={() => remove(d.id)} className="flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-red-light hover:text-red">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoursesTab() {
  const { push } = useToast()
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [form, setForm] = useState({ code: '', title: '', department_id: '', level: 100, lecturer_id: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: courseData }, { data: deptData }, { data: lecturerData }] = await Promise.all([
      supabase.from('courses').select('*, department:departments(name), lecturer:lecturers(profile:profiles(full_name))').order('code'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('lecturers').select('id, profile:profiles(full_name)')
    ])
    setCourses(courseData ?? [])
    setDepartments(deptData ?? [])
    setLecturers(lecturerData ?? [])
  }

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('courses').insert({ ...form, lecturer_id: form.lecturer_id || null })
    if (error) return push(error.message, 'error')
    setForm({ code: '', title: '', department_id: '', level: 100, lecturer_id: '' })
    push('Course added.')
    load()
  }

  async function assignLecturer(courseId, lecturerId) {
    const { error } = await supabase.from('courses').update({ lecturer_id: lecturerId || null }).eq('id', courseId)
    if (error) return push(error.message, 'error')
    load()
  }

  async function remove(id) {
    await supabase.from('courses').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <form onSubmit={add} className="card mb-6 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Course code</label>
            <input required className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CPE 415" />
          </div>
          <div>
            <label className="label">Level</label>
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
              {[100, 200, 300, 400, 500].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title</label>
          <input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Embedded Systems Design" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <select required className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Select</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Lecturer</label>
            <select className="input" value={form.lecturer_id} onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })}>
              <option value="">Unassigned</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.profile?.full_name}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full"><Plus className="h-4 w-4" /> Add course</button>
      </form>

      <ul className="space-y-2">
        {courses.map((c) => (
          <li key={c.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{c.code} · {c.title}</p>
              <p className="text-xs text-ink-faint">{c.department?.name} · Level {c.level}</p>
            </div>
            <select
              className="input sm:w-48"
              value={c.lecturer?.id ?? ''}
              onChange={(e) => assignLecturer(c.id, e.target.value)}
            >
              <option value="">Unassigned</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.profile?.full_name}</option>)}
            </select>
            <button onClick={() => remove(c.id)} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-red-light hover:text-red">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PeopleTab() {
  const [students, setStudents] = useState([])
  const [lecturers, setLecturers] = useState([])

  useEffect(() => {
    supabase.from('students').select('reg_no, level, face_enrolled_at, profile:profiles(full_name, email), department:departments(code)').then(({ data }) => setStudents(data ?? []))
    supabase.from('lecturers').select('staff_id, profile:profiles(full_name, email), department:departments(code)').then(({ data }) => setLecturers(data ?? []))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Lecturers ({lecturers.length})</h2>
        <ul className="space-y-2">
          {lecturers.map((l) => (
            <li key={l.staff_id} className="card flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{l.profile?.full_name}</p>
                <p className="text-xs text-ink-faint">{l.staff_id} · {l.department?.code} · {l.profile?.email}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Students ({students.length})</h2>
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.reg_no} className="card flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{s.profile?.full_name}</p>
                <p className="text-xs text-ink-faint">{s.reg_no} · {s.department?.code} · Level {s.level}</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${s.face_enrolled_at ? 'bg-red-light text-red-dark' : 'bg-canvas text-ink-faint'}`}>
                {s.face_enrolled_at ? 'Face enrolled' : 'Not enrolled'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
