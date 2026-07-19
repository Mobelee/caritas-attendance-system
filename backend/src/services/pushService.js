import webpush from 'web-push'
import 'dotenv/config'
import { supabaseAdmin } from '../lib/supabase.js'

const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@caritasuni.edu.ng',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
} else {
  console.warn('[pushService] VAPID keys not set — push sending is disabled. See README.')
}

/**
 * Sends a push notification to every device a user has subscribed on.
 * Silently drops dead subscriptions (410/404 from the push service).
 */
export async function sendPushToUser(userId, { title, body, url = '/' }) {
  if (!configured) return

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify({ title, body, url })
        )
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[pushService] send failed:', err.message)
        }
      }
    })
  )
}

export async function sendPushToUsers(userIds, payload) {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)))
}
