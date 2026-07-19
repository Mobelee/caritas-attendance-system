import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { sendPushToUsers } from '../services/pushService.js'

export const notifyRouter = Router()

/**
 * Called by the lecturer's client right after it creates an active
 * class_sessions row. Writes an in-app notification for every enrolled
 * student and pushes it to their subscribed devices.
 */
notifyRouter.post('/class-started/:sessionId', async (req, res) => {
  const { sessionId } = req.params

  const { data: session, error } = await supabaseAdmin
    .from('class_sessions')
    .select('course_id, course:courses(code, title)')
    .eq('id', sessionId)
    .single()

  if (error || !session) return res.status(404).json({ error: 'Session not found' })

  const { data: enrolled } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('course_id', session.course_id)

  const studentIds = (enrolled ?? []).map((e) => e.student_id)
  if (!studentIds.length) return res.json({ notified: 0 })

  const title = `${session.course.code} has started`
  const body = `${session.course.title} is now in session. Attendance is being taken.`

  await supabaseAdmin.from('notifications').insert(
    studentIds.map((student_id) => ({
      user_id: student_id,
      session_id: sessionId,
      title,
      body,
      type: 'class_started'
    }))
  )

  await sendPushToUsers(studentIds, { title, body, url: '/' })

  res.json({ notified: studentIds.length })
})
