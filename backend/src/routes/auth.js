import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

export const authRouter = Router()

/**
 * POST /auth/register
 * Admin-level registration: Creates Auth user + Profile + Student/Lecturer record in one call.
 * Bypasses client-side 429 rate limits and 401 RLS errors.
 */
authRouter.post('/register', async (req, res) => {
  const { email, password, role, full_name, department_id, reg_no, staff_id, level } = req.body

  if (!email || !password || !role || !full_name) {
    return res.status(400).json({ error: 'Please fill in all required fields.' })
  }

  try {
    let userId

    // 1. Create User via Admin API (bypasses client 429 rate limits)
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError) {
      if (createError.message.includes('already been registered')) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users?.users?.find((u) => u.email.toLowerCase() === email.toLowerCase())
        if (existing) {
          userId = existing.id
          await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true })
        } else {
          return res.status(400).json({ error: createError.message })
        }
      } else {
        return res.status(400).json({ error: createError.message })
      }
    } else {
      userId = createData.user.id
    }

    // 2. Upsert Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      role,
      full_name,
      email
    })

    if (profileError) {
      console.error('[register] profile error:', profileError.message)
      return res.status(500).json({ error: 'Profile creation failed: ' + profileError.message })
    }

    // 3. Upsert Role Record (Student or Lecturer)
    if (role === 'student') {
      const { error: studentError } = await supabaseAdmin.from('students').upsert({
        id: userId,
        reg_no: reg_no || `REG-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null,
        level: Number(level) || 100
      })

      if (studentError) {
        console.error('[register] student error:', studentError.message)
        return res.status(500).json({ error: 'Student setup failed: ' + studentError.message })
      }
    } else if (role === 'lecturer') {
      const { error: lecturerError } = await supabaseAdmin.from('lecturers').upsert({
        id: userId,
        staff_id: staff_id || `STAFF-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null
      })

      if (lecturerError) {
        console.error('[register] lecturer error:', lecturerError.message)
        return res.status(500).json({ error: 'Lecturer setup failed: ' + lecturerError.message })
      }
    }

    return res.json({ ok: true, userId, message: 'Registration completed successfully.' })
  } catch (err) {
    console.error('[register] catch error:', err)
    return res.status(500).json({ error: err.message || 'Server registration error.' })
  }
})

/**
 * POST /auth/signup-setup
 * Legacy fallback endpoint for existing sessions.
 */
authRouter.post('/signup-setup', async (req, res) => {
  const { userId, role, full_name, email, department_id, reg_no, staff_id, level } = req.body

  if (!userId || !role || !full_name || !email) {
    return res.status(400).json({ error: 'Missing required signup fields.' })
  }

  try {
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      role,
      full_name,
      email
    })

    if (profileError) {
      return res.status(500).json({ error: profileError.message })
    }

    if (role === 'student') {
      const { error: studentError } = await supabaseAdmin.from('students').upsert({
        id: userId,
        reg_no: reg_no || `REG-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null,
        level: Number(level) || 100
      })

      if (studentError) return res.status(500).json({ error: studentError.message })
    } else if (role === 'lecturer') {
      const { error: lecturerError } = await supabaseAdmin.from('lecturers').upsert({
        id: userId,
        staff_id: staff_id || `STAFF-${Date.now().toString().slice(-6)}`,
        department_id: department_id || null
      })

      if (lecturerError) return res.status(500).json({ error: lecturerError.message })
    }

    return res.json({ ok: true, message: 'Account setup completed.' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * POST /auth/profiles
 * Bulk-fetch profile full_names by ID list using service-role (bypasses RLS).
 * Used by the attendance export so lecturers can see student names even when
 * the profiles RLS policy only allows users to read their own row.
 */
authRouter.post('/profiles', async (req, res) => {
  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array.' })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', ids)

    if (error) {
      console.error('[auth/profiles] error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.json({ ok: true, profiles: data ?? [] })
  } catch (err) {
    console.error('[auth/profiles] catch:', err)
    return res.status(500).json({ error: err.message })
  }
})
