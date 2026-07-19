import cron from 'node-cron'
import { supabaseAdmin } from '../lib/supabase.js'
import { sendPushToUsers } from '../services/pushService.js'

const REMINDER_MINUTES_BEFORE = 30

/**
 * Runs every minute. Finds timetable slots starting in ~30 minutes today
 * that don't have a notification yet, and creates one per enrolled student.
 * A lightweight approach that avoids needing a separate queue for a
 * final-year-project scale deployment.
 */
export function startReminderScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await sendUpcomingReminders()
    } catch (err) {
      console.error('[reminderScheduler] failed:', err.message)
    }
  })
  console.log('[reminderScheduler] started — checking every minute')
}

async function sendUpcomingReminders() {
  const now = new Date()
  const dow = now.getDay()
  const targetTime = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60000)
  const targetHHMM = targetTime.toTimeString().slice(0, 5)

  const { data: slots, error } = await supabaseAdmin
    .from('timetable')
    .select('id, course_id, start_time, venue, course:courses(code, title)')
    .eq('day_of_week', dow)
    .gte('start_time', `${targetHHMM}:00`)
    .lt('start_time', `${addMinuteToHHMM(targetHHMM)}:00`)

  if (error || !slots?.length) return

  for (const slot of slots) {
    // Skip if a reminder was already sent for this slot today
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('type', 'reminder_30')
      .gte('created_at', new Date(now.getTime() - 5 * 60000).toISOString())
      .contains('title', slot.course.code)
      .limit(1)

    if (existing?.length) continue

    const { data: enrolled } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('course_id', slot.course_id)

    const studentIds = (enrolled ?? []).map((e) => e.student_id)
    if (!studentIds.length) continue

    const title = `${slot.course.code} starts in 30 minutes`
    const body = `${slot.course.title} at ${slot.venue || 'venue TBA'}. Be ready for attendance scan.`

    await supabaseAdmin
      .from('notifications')
      .insert(studentIds.map((student_id) => ({ user_id: student_id, title, body, type: 'reminder_30' })))

    await sendPushToUsers(studentIds, { title, body, url: '/' })
  }
}

function addMinuteToHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + 1
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
