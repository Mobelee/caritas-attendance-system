import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

export const authRouter = Router()

/**
 * POST /auth/signup-setup
 * Guarantees profile + student/lecturer row creation using service-role key
 * if client-side insertion encounters RLS policy restrictions.
 */
authRouter.post('/signup-setup', async (req, res) => {
  const { userId, role, full_name, email, department_id, reg_no, staff_id, level } = req.body

  if (!userId || !role || !full_name || !email) {
    return res.status(400).json({ error: 'Missing required signup fields.' })
  }

  try {
    // 1. Upsert Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      role,
      full_name,
      email
    })

    if (profileError) {
      console.error('[signup-setup] profile error:', profileError.message)
      return res.status(500).json({ error: profileError.message })
    }

    // 2. Insert Role-specific Record
    if (role === 'student') {
      const { error: studentError } = await supabaseAdmin.from('students').upsert({
        id: userId,
        reg_no: reg_no || `REG-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null,
        level: Number(level) || 100
      })

      if (studentError) {
        console.error('[signup-setup] student error:', studentError.message)
        return res.status(500).json({ error: studentError.message })
      }
    } else if (role === 'lecturer') {
      const { error: lecturerError } = await supabaseAdmin.from('lecturers').upsert({
        id: userId,
        staff_id: staff_id || `STAFF-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null
      })

      if (lecturerError) {
        console.error('[signup-setup] lecturer error:', lecturerError.message)
        return res.status(500).json({ error: lecturerError.message })
      }
    }

    return res.json({ ok: true, message: 'Account and profile setup completed successfully.' })
  } catch (err) {
    console.error('[signup-setup] exception:', err)
    return res.status(500).json({ error: err.message })
  }
})
