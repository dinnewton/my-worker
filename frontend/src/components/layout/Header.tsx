import { Bell, Sun, Moon, Bot } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useState } from 'react'
import { NotificationCenter } from '../dashboard/NotificationCenter'
import { clsx } from 'clsx'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const { isDark, toggle } = useThemeStore()
  const { unreadCount } = useNotificationStore()
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-brand-600" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className={clsx(
                'absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center',
              )}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-semibold">
          A
        </div>
      </div>
    </header>
  )
}
