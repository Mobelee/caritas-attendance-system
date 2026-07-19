import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Lock, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setError('Incorrect email or password. Try again.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-red">
            <GraduationCap className="h-6 w-6 text-white" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Caritas University</h1>
          <p className="mt-1 text-sm text-ink-soft">Attendance Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4">
            <label className="label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@caritasuni.edu.ng"
                className="input pl-9"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-9"
              />
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded bg-red-light px-3 py-2 text-sm text-red-dark">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          New here? <Link to="/signup" className="font-medium text-red">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
