import { useState } from 'react'
import { Plus, Zap, Globe, BarChart2, Loader2, Search, TrendingUp, Calculator, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useWebsites, useWebsiteStats } from '../hooks/useWebsites'
import { WebsiteCard } from '../components/websites/WebsiteCard'
import { WebsiteEditor } from '../components/websites/WebsiteEditor'
import { AIGenerateSiteModal } from '../components/websites/AIGenerateSiteModal'
import { PricingCalculator } from '../components/websites/PricingCalculator'
import type { WebsiteStatus, Website } from '../types'

const STATUS_FILTERS: { value: WebsiteStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'planning',    label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
  { value: 'live',        label: 'Live' },
  { value: 'maintenance', label: 'Maintenance' },
]

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string | number; icon: typeof Globe; color: string; bg: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4">
      <div className={clsx('p-2.5 rounded-xl', bg)}>
        <Icon className={clsx('w-5 h-5', color)} />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={clsx('text-xl font-bold', color)}>{value}</p>
      </div>
    </div>
  )
}

export function Websites() {
  const [statusFilter, setStatusFilter] = useState<WebsiteStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)

  const { data: sites = [], isLoading } = useWebsites(statusFilter !== 'all' ? statusFilter : undefined)
  const { data: stats } = useWebsiteStats()

  const filtered = sites.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.client_name.toLowerCase().includes(q) || s.domain?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Website Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-generated client websites with content, SEO, deployment, and revision tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalculator(v => !v)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors border',
              showCalculator
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            )}>
            <Calculator className="w-4 h-4" /> Pricing
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
            <Zap className="w-4 h-4" /> AI Generate Site
          </button>
        </div>
      </div>

      {/* Pricing Calculator (inline collapse) */}
      {showCalculator && (
        <div className="relative">
          <button onClick={() => setShowCalculator(false)}
            className="absolute top-3 right-3 z-10 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4" />
          </button>
          <PricingCalculator />
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Sites"   value={stats.total}       icon={Globe}      color="text-blue-600"   bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard label="Live Sites"    value={stats.live}        icon={TrendingUp} color="text-green-600"  bg="bg-green-50 dark:bg-green-900/20" />
          <StatCard label="In Progress"   value={stats.in_progress} icon={BarChart2}  color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" />
          <StatCard label="Total Value"   value={`$${(stats.total_value / 1000).toFixed(1)}k`} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-brand-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No websites yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "AI Generate Site" to build a complete website in minutes</p>
          <button onClick={() => setShowGenerate(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
            <Zap className="w-4 h-4" /> Build First Website
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((site) => (
            <WebsiteCard key={site.id} site={site} onClick={() => setSelectedId(site.id)} />
          ))}
        </div>
      )}

      {selectedId && (
        <WebsiteEditor siteId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {showGenerate && (
        <AIGenerateSiteModal
          onClose={() => setShowGenerate(false)}
          onSuccess={(site: Website) => setSelectedId(site.id)}
        />
      )}
    </div>
  )
}
