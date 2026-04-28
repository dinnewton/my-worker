import { useRef, useEffect } from 'react'
import { X, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { useNotificationStore } from '../../store/notificationStore'
import type { Notification } from '../../types'

const TYPE_ICON: Record<Notification['type'], React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const TYPE_COLOR: Record<Notification['type'], string> = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
}

interface NotificationCenterProps {
  onClose: () => void
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const { notifications, markAllRead, markRead, remove } = useNotificationStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 animate-fade-in"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <span className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</span>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
        {notifications.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No notifications</p>
        )}
        {notifications.map((n) => {
          const Icon = TYPE_ICON[n.type]
          return (
            <div
              key={n.id}
              className={clsx(
                'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer',
                !n.read && 'bg-brand-50/50 dark:bg-brand-900/10'
              )}
              onClick={() => markRead(n.id)}
            >
              <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', TYPE_COLOR[n.type])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(n.id) }}
                className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0 mt-1.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
