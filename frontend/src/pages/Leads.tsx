import { useState, useMemo } from 'react'
import {
  Plus, Search, Filter, LayoutGrid, List, ClipboardList,
  Code2, Loader2, CheckCircle, Circle, Trash2, Calendar,
  ChevronDown, Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format, isPast, isToday } from 'date-fns'
import { usePipeline, useLeads, useAllTasks, useUpdateTask, useDeleteTask } from '../hooks/useLeads'
import { KanbanBoard, PipelineStatsBar } from '../components/leads/KanbanBoard'
import { LeadDetail } from '../components/leads/LeadDetail'
import { LeadForm } from '../components/leads/LeadForm'
import { EmbedForm } from '../components/leads/EmbedForm'
import { ScoreBadge } from '../components/leads/ScoreBadge'
import { SourceBadge } from '../components/leads/ScoreBadge'
import type { Lead, LeadStatus, FollowUpTask } from '../types'

type MainTab = 'pipeline' | 'clients' | 'tasks' | 'embed'

const STATUS_OPTS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'new',           label: 'New' },
  { value: 'contacted',     label: 'Contacted' },
  { value: 'qualified',     label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'won',           label: 'Won' },
  { value: 'lost',          label: 'Lost' },
]

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500 animate-pulse',
  high:   'bg-orange-500',
  medium: 'bg-yellow-500',
  low:    'bg-gray-400',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  low:    { label: 'Low',    color: 'text-gray-500',                       dot: 'bg-gray-400' },
}

const TYPE_ICON: Record<string, string> = {
  call: '📞', email: '✉️', whatsapp: '💬', meeting: '🤝',
  proposal: '📄', follow_up: '🔄', research: '🔍', other: '📌',
}

// ─── All-Tasks View ────────────────────────────────────────────────────────────

function AllTasksView() {
  const { data: tasks = [], isLoading } = useAllTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'pending') return tasks.filter((t) => !t.completed)
    if (filter === 'done') return tasks.filter((t) => t.completed)
    return tasks
  }, [tasks, filter])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'done'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
              filter === f
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
            )}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} tasks</span>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">All caught up!</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((task) => {
          const isOverdue = task.due_date && !task.completed && isPast(new Date(task.due_date))
          const isDueToday = task.due_date && !task.completed && isToday(new Date(task.due_date))
          const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
          const isExpanded = expandedId === task.id

          return (
            <div key={task.id} className={clsx(
              'bg-white dark:bg-gray-800 rounded-xl border transition-colors',
              task.completed
                ? 'border-gray-100 dark:border-gray-700 opacity-60'
                : isOverdue
                ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/5'
                : isDueToday
                ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-900/5'
                : 'border-gray-200 dark:border-gray-700',
            )}>
              <div className="flex items-start gap-3 p-3.5">
                <button
                  onClick={() => updateTask.mutate({ id: task.id, leadId: task.lead_id, completed: !task.completed })}
                  disabled={updateTask.isPending}
                  className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-brand-600 transition-colors">
                  {updateTask.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : task.completed
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <Circle className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{TYPE_ICON[task.task_type] ?? '📌'}</span>
                    <p className={clsx(
                      'text-sm font-medium flex-1',
                      task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white',
                    )}>
                      {task.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={clsx('flex items-center gap-1 text-[10px] font-medium', priority.color)}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', priority.dot)} />
                      {priority.label}
                    </span>
                    {task.ai_generated && (
                      <span className="text-[10px] text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                    {task.due_date && (
                      <span className={clsx(
                        'flex items-center gap-0.5 text-[10px]',
                        isOverdue ? 'text-red-500 font-semibold' : isDueToday ? 'text-yellow-600 font-semibold' : 'text-gray-400',
                      )}>
                        <Calendar className="w-2.5 h-2.5" />
                        {isOverdue ? 'Overdue · ' : isDueToday ? 'Today · ' : ''}
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                    {(task as FollowUpTask & { lead_name?: string }).lead_name && (
                      <span className="text-[10px] text-gray-400">
                        · {(task as FollowUpTask & { lead_name?: string }).lead_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {task.description && (
                    <button onClick={() => setExpandedId(isExpanded ? null : task.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                  )}
                  {confirmId !== task.id ? (
                    <button onClick={() => setConfirmId(task.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => { deleteTask.mutate({ id: task.id, leadId: task.lead_id }); setConfirmId(null) }}
                        className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Del</button>
                      <button onClick={() => setConfirmId(null)}
                        className="text-[10px] px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-gray-500">No</button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && task.description && (
                <div className="px-10 pb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{task.description}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Clients List View ─────────────────────────────────────────────────────────

interface ClientsListProps {
  onSelectLead: (lead: Lead) => void
}

function ClientsList({ onSelectLead }: ClientsListProps) {
  const { data: leads = [], isLoading } = useLeads()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter((l) => {
      const matchesSearch = !q || l.name.toLowerCase().includes(q)
        || l.company?.toLowerCase().includes(q)
        || l.email?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [leads, search, statusFilter])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTS.map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value as LeadStatus | 'all')}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                statusFilter === value
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No leads found.</p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                  {['Lead', 'Status', 'Score', 'Source', 'Deal', 'Added'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((lead) => (
                  <tr key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          PRIORITY_DOT[lead.priority] ?? 'bg-gray-400',
                        )} />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{lead.name}</p>
                          {lead.company && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{lead.company}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                        lead.status === 'won' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        lead.status === 'lost' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                        lead.status === 'new' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                      )}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={lead.source} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.deal_value > 0 ? (
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          ${lead.deal_value >= 1000 ? `${(lead.deal_value / 1000).toFixed(1)}k` : lead.deal_value}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {lead.created_at ? format(new Date(lead.created_at), 'MMM d') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Leads Page ───────────────────────────────────────────────────────────

export function Leads() {
  const [tab, setTab] = useState<MainTab>('pipeline')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined)
  const [defaultStatus, setDefaultStatus] = useState<LeadStatus | undefined>(undefined)

  const { data: pipeline, isLoading: pipelineLoading } = usePipeline()

  const tabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: 'pipeline', label: 'Pipeline',  icon: LayoutGrid },
    { id: 'clients',  label: 'Clients',   icon: List },
    { id: 'tasks',    label: 'Tasks',     icon: ClipboardList },
    { id: 'embed',    label: 'Embed Form', icon: Code2 },
  ]

  const openAddLead = (status?: LeadStatus) => {
    setEditingLead(undefined)
    setDefaultStatus(status)
    setShowForm(true)
  }

  const openEditLead = (lead: Lead) => {
    setSelectedLead(null)
    setEditingLead(lead)
    setShowForm(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-powered CRM with automated follow-ups and scoring
          </p>
        </div>
        <button
          onClick={() => openAddLead()}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {/* Pipeline Stats (always visible) */}
      {pipeline && <PipelineStatsBar pipeline={pipeline} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-5 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
            )}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {tab === 'pipeline' && (
          pipelineLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : pipeline ? (
            <KanbanBoard
              pipeline={pipeline}
              onSelectLead={setSelectedLead}
              onAddLead={openAddLead}
            />
          ) : null
        )}

        {tab === 'clients' && (
          <ClientsList onSelectLead={setSelectedLead} />
        )}

        {tab === 'tasks' && (
          <AllTasksView />
        )}

        {tab === 'embed' && (
          <EmbedForm />
        )}
      </div>

      {/* Lead Detail Panel */}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onEdit={openEditLead}
        />
      )}

      {/* Add / Edit Lead Form */}
      {showForm && (
        <LeadForm
          lead={editingLead}
          defaultStatus={defaultStatus}
          onClose={() => { setShowForm(false); setEditingLead(undefined) }}
          onSuccess={(lead) => {
            if (!editingLead) setSelectedLead(lead)
          }}
        />
      )}
    </div>
  )
}
