import { useState } from 'react'
import {
  Plus, Zap, DollarSign, FileText, Send, Eye,
  CheckCircle, XCircle, TrendingUp, Loader2, Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useProposals, useProposalStats } from '../hooks/useProposals'
import { ProposalCard } from '../components/proposals/ProposalCard'
import { ProposalDetail } from '../components/proposals/ProposalDetail'
import { AIGenerateModal } from '../components/proposals/AIGenerateModal'
import type { ProposalStatus, Proposal } from '../types'

const STATUS_TABS: { value: ProposalStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all',      label: 'All',      icon: FileText },
  { value: 'draft',    label: 'Drafts',   icon: FileText },
  { value: 'sent',     label: 'Sent',     icon: Send },
  { value: 'viewed',   label: 'Viewed',   icon: Eye },
  { value: 'accepted', label: 'Accepted', icon: CheckCircle },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
]

function StatCard({
  label, value, icon: Icon, color, bg,
}: { label: string; value: string | number; icon: React.ElementType; color: string; bg: string }) {
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

export function Proposals() {
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)

  const { data: proposals = [], isLoading } = useProposals(statusFilter !== 'all' ? statusFilter : undefined)
  const { data: stats } = useProposalStats()

  const filtered = proposals.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q)
      || p.client_name.toLowerCase().includes(q)
      || p.client_company?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proposals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-generated proposals with PDF export and e-signature
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
          <Zap className="w-4 h-4" /> AI Generate
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Proposals" value={stats.total}
            icon={FileText} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard label="Pipeline Value" value={`$${(stats.total_pipeline_value / 1000).toFixed(1)}k`}
            icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
          <StatCard label="Won Value" value={`$${(stats.won_value / 1000).toFixed(1)}k`}
            icon={CheckCircle} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" />
          <StatCard label="Win Rate" value={`${stats.win_rate}%`}
            icon={TrendingUp} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex-wrap">
          {STATUS_TABS.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {stats && value !== 'all' && (
                <span className="text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">
                  {stats.by_status?.[value] ?? 0}
                </span>
              )}
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
            <FileText className="w-8 h-8 text-brand-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No proposals yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "AI Generate" to create your first proposal in seconds</p>
          <button onClick={() => setShowGenerate(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
            <Zap className="w-4 h-4" /> Generate First Proposal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onClick={() => setSelectedId(proposal.id)}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedId && (
        <ProposalDetail
          proposalId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* AI Generate Modal */}
      {showGenerate && (
        <AIGenerateModal
          onClose={() => setShowGenerate(false)}
          onSuccess={(proposal) => setSelectedId(proposal.id)}
        />
      )}
    </div>
  )
}
