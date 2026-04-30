import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  Rss,
  Globe,
  BarChart2,
  Mail,
  Search,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Brain,
  Receipt,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/proposals', icon: FileText, label: 'Proposals' },
  { to: '/content', icon: Rss, label: 'Content' },
  { to: '/websites', icon: Globe, label: 'Websites' },
  { to: '/campaigns', icon: BarChart2, label: 'Campaigns' },
  { to: '/email', icon: Mail, label: 'Email' },
  { to: '/seo', icon: Search, label: 'SEO' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/invoices', icon: Receipt,       label: 'Invoices' },
  { to: '/agent',    icon: Brain,         label: 'Agent Brain' },
  { to: '/settings', icon: Settings,      label: 'Settings' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        'relative flex flex-col h-screen bg-gray-900 dark:bg-gray-950 border-r border-gray-800 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight animate-fade-in">
            MyWorker
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="animate-fade-in">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Agent status */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
            Agent running 24/7
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  )
}
