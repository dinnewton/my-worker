import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { formatDistanceToNow } from 'date-fns'
import {
  Users, FileText, Rss, Globe, Mail, Search,
  Lightbulb, CheckCircle, XCircle, Loader2, Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useWebSocket } from '../../hooks/useWebSocket'
import type { Activity, WSMessage } from '../../types'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  lead_found:       { icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  post_published:   { icon: Rss,         color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  proposal_sent:    { icon: FileText,    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  site_built:       { icon: Globe,       color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  email_sent:       { icon: Mail,        color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  seo_audit:        { icon: Search,      color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  content_created:  { icon: Lightbulb,   color: 'text-pink-600',   bg: 'bg-pink-50 dark:bg-pink-900/20' },
  agent_thinking:   { icon: Zap,         color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-900/20' },
  system:           { icon: Zap,         color: 'text-gray-500',   bg: 'bg-gray-100 dark:bg-gray-700' },
}

function StatusIcon({ status }: { status: Activity['status'] }) {
  if (status === 'success') return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
  if (status === 'failed')  return <XCircle className="w-3.5 h-3.5 text-red-500" />
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
  return null
}

export function ActivityFeed() {
  const queryClient = useQueryClient()
  const [liveItems, setLiveItems] = useState<Activity[]>([])

  const { data: initial = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['activity-feed'],
    queryFn: async () => {
      const { data } = await axios.get<Activity[]>('/api/v1/activity/feed?limit=30')
      return data
    },
    staleTime: 60_000,
  })

  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.event === 'activity') {
      const activity = msg.data as Activity
      setLiveItems((prev) => [{ ...activity, id: Date.now() }, ...prev].slice(0, 20))
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
    }
  }, [queryClient])

  useWebSocket(handleMessage)

  const items = [...liveItems, ...initial].slice(0, 40)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Live Activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-700/50 max-h-[480px] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">
            No activity yet. Agent is warming up...
          </div>
        )}
        {items.map((item, i) => {
          const meta = TYPE_META[item.type] ?? TYPE_META.system
          const Icon = meta.icon
          return (
            <div
              key={`${item.id}-${i}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors animate-slide-in"
            >
              <div className={clsx('p-2 rounded-lg flex-shrink-0 mt-0.5', meta.bg)}>
                <Icon className={clsx('w-4 h-4', meta.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <StatusIcon status={item.status} />
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
              {item.module && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  {item.module}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
