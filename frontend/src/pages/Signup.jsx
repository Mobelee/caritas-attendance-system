import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

const LEVELS = [100, 200, 300, 400, 500]

export default function Signup() {
  const navigate = useNavigate()
  const { push } = useToast()
  const [role, setRole] = useState('student')
  const [departments, setDepartments] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    department_id: '',
    reg_no: '',
    staff_id: '',
    level: 100
  })

  useEffect(() => {
    supabase.from('departments').select('id, name, code').order('name').then(({ data }) => {
      setDepartments(data ?? [])
    })
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password
    })

    if (authError) {
      push(authError.message, 'error')
      setSubmitting(false)
      return
    }

    const userId = authData.user.id

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role,
      full_name: form.full_name,
      email: form.email
    })

    if (profileError) {
      push('Account created but profile setup failed — contact admin.', 'error')
      setSubmitting(false)
      return
    }

    if (role === 'student') {
      await supabase.from('students').insert({
        id: userId,
        reg_no: form.reg_no,
        department_id: form.department_id || null,
        level: Number(form.level)
      })
      navigate('/onboarding/face-enroll')
    } else {
      await supabase.from('lecturers').insert({
        id: userId,
        staff_id: form.staff_id,
        department_id: form.department_id || null
      })
      navigate('/')
    }

    setSubmitting(false)
    push('Account created.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-red">
            <GraduationCap className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-soft">Caritas University Attendance Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={role === 'student' ? 'btn-primary' : 'btn-secondary'}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole('lecturer')}
              className={role === 'lecturer' ? 'btn-primary' : 'btn-secondary'}
            >
              Lecturer
            </button>
          </div>

          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
          </div>

          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>

          <div>
            <label className="label">Password</label>
            <input required type="password" minLength={6} className="input" value={form.password} onChange={(e) => update('password', e.target.value)} />
          </div>

          <div>
            <label className="label">Department</label>
            <select required className="input" value={form.department_id} onChange={(e) => update('department_id', e.target.value)}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {role === 'student' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Reg number</label>
                <input required className="input" value={form.reg_no} onChange={(e) => update('reg_no', e.target.value)} placeholder="2021/CEE/001" />
              </div>
              <div>
                <label className="label">Level</label>
                <select className="input" value={form.level} onChange={(e) => update('level', e.target.value)}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Staff ID</label>
              <input required className="input" value={form.staff_id} onChange={(e) => update('staff_id', e.target.value)} />
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Already have an account? <Link to="/login" className="font-medium text-red">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
