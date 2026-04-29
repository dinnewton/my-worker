import { Globe, ExternalLink, Zap, Clock, DollarSign, Trash2, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { useState } from 'react'
import { useDeleteWebsite, useUpdateWebsite } from '../../hooks/useWebsites'
import type { WebsiteSummary, WebsiteStatus } from '../../types'

const STATUS_CONFIG: Record<WebsiteStatus, { label: string; color: string; dot: string }> = {
  planning:    { label: 'Planning',     color: 'text-gray-600 bg-gray-100 dark:bg-gray-700',           dot: 'bg-gray-400' },
  in_progress: { label: 'In Progress',  color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',         dot: 'bg-blue-500 animate-pulse' },
  review:      { label: 'In Review',    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',   dot: 'bg-purple-500' },
  live:        { label: 'Live',         color: 'text-green-600 bg-green-50 dark:bg-green-900/20',      dot: 'bg-green-500 animate-pulse' },
  maintenance: { label: 'Maintenance',  color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',  dot: 'bg-orange-500' },
  paused:      { label: 'Paused',       color: 'text-red-500 bg-red-50 dark:bg-red-900/20',            dot: 'bg-red-400' },
}

const TEMPLATE_EMOJI: Record<string, string> = {
  business: '🏢', portfolio: '🎨', landing_page: '🚀', ecommerce: '🛒',
  blog: '✍️', restaurant: '🍽️', agency: '📣', saas: '⚡',
}

const STATUS_ORDER: WebsiteStatus[] = ['planning', 'in_progress', 'review', 'live', 'maintenance', 'paused']

interface WebsiteCardProps {
  site: WebsiteSummary
  onClick: () => void
}

export function WebsiteCard({ site, onClick }: WebsiteCardProps) {
  const cfg = STATUS_CONFIG[site.status]
  const deleteWebsite = useDeleteWebsite()
  const updateWebsite = useUpdateWebsite()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group">
      {/* Progress bar at top */}
      <div className="h-1 bg-gray-100 dark:bg-gray-700">
        <div
          className="h-1 bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
          style={{ width: `${site.progress}%` }}
        />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3 cursor-pointer" onClick={onClick}>
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">{TEMPLATE_EMOJI[site.template] ?? '🌐'}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate group-hover:text-brand-600 transition-colors">
                {site.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{site.client_name}</p>
            </div>
          </div>
          <span className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0', cfg.color)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        </div>

        {/* Domain */}
        {(site.domain || site.live_url) && (
          <a href={site.live_url ?? `https://${site.domain}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline mb-3"
            onClick={(e) => e.stopPropagation()}>
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{site.domain ?? site.live_url}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs text-gray-500">
            {site.pages_count} page{site.pages_count !== 1 ? 's' : ''}
          </span>
          {site.project_value > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-3 h-3" />
              {site.project_value >= 1000 ? `${(site.project_value / 1000).toFixed(1)}k` : site.project_value}
            </span>
          )}
          {site.deadline && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {format(new Date(site.deadline), 'MMM d')}
            </span>
          )}
          {site.ai_generated && (
            <span className="flex items-center gap-0.5 text-[10px] text-brand-500">
              <Zap className="w-2.5 h-2.5" /> AI
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{site.progress}%</span>
        </div>

        {/* Status selector + delete */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <select
            value={site.status}
            onChange={(e) => updateWebsite.mutate({ id: site.id, status: e.target.value as WebsiteStatus })}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500">
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          {!confirmDelete ? (
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => deleteWebsite.mutate(site.id)}
                className="px-2 py-1 text-[10px] bg-red-500 text-white rounded">Del</button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-600 rounded text-gray-500">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
