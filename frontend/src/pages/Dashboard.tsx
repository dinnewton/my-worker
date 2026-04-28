import { Users, Rss, FileText, Globe, DollarSign } from 'lucide-react'
import { KPICard } from '../components/dashboard/KPICard'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { useKPIs } from '../hooks/useKPIs'
import { useNotificationStore } from '../store/notificationStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { WSMessage } from '../types'

export function Dashboard() {
  const { data: kpis, isLoading } = useKPIs()
  const addNotification = useNotificationStore((s) => s.add)
  const queryClient = useQueryClient()

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.event === 'activity') {
        const d = msg.data as { type: string; title: string; status: string }
        addNotification({
          title: d.title,
          message: `Module update: ${d.type.replace(/_/g, ' ')}`,
          type: d.status === 'failed' ? 'error' : d.status === 'running' ? 'info' : 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['kpis'] })
        queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      }
    },
    [addNotification, queryClient]
  )

  useWebSocket(handleMessage)

  const skeleton = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-28'

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className={skeleton} />)
        ) : (
          <>
            <KPICard
              label="Active Leads"
              value={kpis?.active_leads ?? 0}
              delta={kpis?.leads_delta}
              icon={Users}
              iconColor="text-blue-600"
              iconBg="bg-blue-50 dark:bg-blue-900/20"
            />
            <KPICard
              label="Posts Published"
              value={kpis?.posts_published ?? 0}
              delta={kpis?.posts_delta}
              icon={Rss}
              iconColor="text-green-600"
              iconBg="bg-green-50 dark:bg-green-900/20"
            />
            <KPICard
              label="Proposals Sent"
              value={kpis?.proposals_sent ?? 0}
              delta={kpis?.proposals_delta}
              icon={FileText}
              iconColor="text-purple-600"
              iconBg="bg-purple-50 dark:bg-purple-900/20"
            />
            <KPICard
              label="Sites Built"
              value={kpis?.sites_built ?? 0}
              icon={Globe}
              iconColor="text-orange-600"
              iconBg="bg-orange-50 dark:bg-orange-900/20"
            />
            <KPICard
              label="Revenue"
              value={kpis?.revenue ?? 0}
              delta={kpis?.revenue_delta}
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50 dark:bg-emerald-900/20"
              prefix="$"
            />
          </>
        )}
      </div>

      {/* Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ActivityFeed />
        </div>

        {/* Quick stats / agent status */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Agent Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Lead Scanner', status: 'Running', color: 'text-green-500', dot: 'bg-green-500' },
                { label: 'Content Publisher', status: 'Scheduled', color: 'text-yellow-500', dot: 'bg-yellow-500' },
                { label: 'Proposal Writer', status: 'On-demand', color: 'text-blue-500', dot: 'bg-blue-500' },
                { label: 'KPI Monitor', status: 'Running', color: 'text-green-500', dot: 'bg-green-500' },
              ].map(({ label, status, color, dot }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dot} animate-pulse-slow`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </div>
                  <span className={`text-xs font-medium ${color}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Add Lead', href: '/leads' },
                { label: 'Create Proposal', href: '/proposals' },
                { label: 'Write Content', href: '/content' },
                { label: 'Run SEO Audit', href: '/seo' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block w-full text-center py-2 px-3 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 dark:hover:bg-brand-900/20 dark:hover:text-brand-400 transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
