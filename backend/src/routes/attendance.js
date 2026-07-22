import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'

export const attendanceRouter = Router()

/**
 * POST /attendance/mark
 * Bypasses client RLS via service role so student attendance marking never fails due to missing RLS policies.
 */
attendanceRouter.post('/mark', async (req, res) => {
  const { session_id, student_id, method, confidence } = req.body

  if (!session_id || !student_id) {
    return res.status(400).json({ error: 'Missing session_id or student_id' })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .upsert(
        {
          session_id,
          student_id,
          marked_at: new Date().toISOString(),
          method: method || 'face_recognition',
          confidence: confidence || 0.95
        },
        { onConflict: 'session_id,student_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[attendance/mark] Error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.json({ ok: true, attendance: data })
  } catch (err) {
    console.error('[attendance/mark] Catch error:', err)
    return res.status(500).json({ error: err.message })
  }
})
