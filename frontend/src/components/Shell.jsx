import { BellPlus, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from './NotificationBell'
import { enablePushNotifications } from '../hooks/usePushNotifications'
import { useToast } from '../hooks/useToast'

export default function Shell({ title, subtitle, actions, children }) {
  const { signOut, profile } = useAuth()
  const { push } = useToast()
  const showEnablePush =
    typeof Notification !== 'undefined' && Notification.permission === 'default'

  async function handleEnablePush() {
    const result = await enablePushNotifications(profile.id)
    push(result.ok ? 'Push notifications enabled.' : result.reason, result.ok ? 'success' : 'error')
  }

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-red">Caritas University</p>
            <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {showEnablePush && (
              <button
                onClick={handleEnablePush}
                aria-label="Enable notifications"
                className="flex h-9 w-9 items-center justify-center rounded border border-line text-ink-soft hover:bg-canvas"
              >
                <BellPlus className="h-4 w-4" />
              </button>
            )}
            {profile && <NotificationBell userId={profile.id} />}
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded border border-line text-ink-soft hover:bg-canvas"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
