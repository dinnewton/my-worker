import { useState, useCallback } from 'react'
import { Plus, DollarSign, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { LeadCard } from './LeadCard'
import { useMoveLeadStage } from '../../hooks/useLeads'
import type { Lead, LeadStatus, PipelineStats } from '../../types'

const COLUMNS: {
  status: LeadStatus
  label: string
  accent: string
  header: string
  dropBg: string
}[] = [
  { status: 'new',           label: 'New',           accent: 'border-blue-400',   header: 'text-blue-600 dark:text-blue-400',   dropBg: 'bg-blue-50/60 dark:bg-blue-900/10' },
  { status: 'contacted',     label: 'Contacted',     accent: 'border-yellow-400', header: 'text-yellow-600 dark:text-yellow-400', dropBg: 'bg-yellow-50/60 dark:bg-yellow-900/10' },
  { status: 'qualified',     label: 'Qualified',     accent: 'border-purple-400', header: 'text-purple-600 dark:text-purple-400', dropBg: 'bg-purple-50/60 dark:bg-purple-900/10' },
  { status: 'proposal_sent', label: 'Proposal Sent', accent: 'border-pink-400',   header: 'text-pink-600 dark:text-pink-400',     dropBg: 'bg-pink-50/60 dark:bg-pink-900/10' },
  { status: 'won',           label: 'Won ✓',         accent: 'border-green-400',  header: 'text-green-600 dark:text-green-400',   dropBg: 'bg-green-50/60 dark:bg-green-900/10' },
  { status: 'lost',          label: 'Lost',          accent: 'border-red-300',    header: 'text-red-500 dark:text-red-400',        dropBg: 'bg-red-50/60 dark:bg-red-900/10' },
]

interface KanbanBoardProps {
  pipeline: PipelineStats
  onSelectLead: (lead: Lead) => void
  onAddLead: (status?: LeadStatus) => void
}

export function KanbanBoard({ pipeline, onSelectLead, onAddLead }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const moveStage = useMoveLeadStage()

  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, toStatus: LeadStatus) => {
      e.preventDefault()
      const leadId = Number(e.dataTransfer.getData('leadId'))
      const fromStatus = e.dataTransfer.getData('fromStatus') as LeadStatus
      setDragOverCol(null)
      setDraggingId(null)
      if (leadId && fromStatus !== toStatus) {
        await moveStage.mutateAsync({ id: leadId, status: toStatus })
      }
    },
    [moveStage],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null)
    }
  }, [])

  const leadsForStatus = (status: LeadStatus): Lead[] =>
    pipeline.columns.find((c) => c.status === status)?.leads ?? []

  const valueForStatus = (status: LeadStatus): number =>
    pipeline.columns.find((c) => c.status === status)?.total_value ?? 0

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[600px]">
      {COLUMNS.map((col) => {
        const colLeads = leadsForStatus(col.status)
        const colValue = valueForStatus(col.status)
        const isOver = dragOverCol === col.status

        return (
          <div
            key={col.status}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
            className={clsx(
              'flex flex-col rounded-xl border-t-2 flex-shrink-0 w-[220px]',
              'bg-gray-50 dark:bg-gray-800/50 border-x border-b border-gray-200 dark:border-gray-700',
              col.accent,
              isOver && col.dropBg,
              isOver && 'ring-2 ring-brand-400 ring-offset-1 transition-all',
            )}
          >
            {/* Column Header */}
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={clsx('text-xs font-bold uppercase tracking-wide', col.header)}>
                    {col.label}
                  </span>
                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
                    {colLeads.length}
                  </span>
                </div>
                <button
                  onClick={() => onAddLead(col.status)}
                  className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  title="Add lead"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {colValue > 0 && (
                <p className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  {colValue >= 1000 ? `${(colValue / 1000).toFixed(1)}k` : colValue.toFixed(0)}
                </p>
              )}
            </div>

            {/* Cards */}
            <div
              className={clsx(
                'flex-1 p-2 space-y-2 overflow-y-auto min-h-[80px] transition-colors',
                isOver && col.dropBg,
              )}
            >
              {colLeads.length === 0 && (
                <div className={clsx(
                  'h-20 rounded-lg border-2 border-dashed flex items-center justify-center',
                  isOver
                    ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/10'
                    : 'border-gray-200 dark:border-gray-600',
                )}>
                  {isOver ? (
                    <span className="text-xs text-brand-500 font-medium">Drop here</span>
                  ) : (
                    <span className="text-xs text-gray-400">No leads</span>
                  )}
                </div>
              )}
              {colLeads.map((lead) => (
                <div key={lead.id} className="relative">
                  <LeadCard
                    lead={lead}
                    isDragging={draggingId === lead.id}
                    onClick={() => onSelectLead(lead)}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface PipelineStatsBarProps {
  pipeline: PipelineStats
}

export function PipelineStatsBar({ pipeline }: PipelineStatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        {
          label: 'Total Leads', value: pipeline.total_leads,
          icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
          label: 'Pipeline Value', value: `$${(pipeline.total_pipeline_value / 1000).toFixed(1)}k`,
          icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        },
        {
          label: 'Avg Score', value: `${Math.round(pipeline.avg_score)}/100`,
          icon: null, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20',
        },
        {
          label: 'Conversion Rate', value: `${pipeline.conversion_rate.toFixed(1)}%`,
          icon: null, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20',
        },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          {Icon && (
            <div className={clsx('p-2 rounded-lg', bg)}>
              <Icon className={clsx('w-4 h-4', color)} />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={clsx('text-lg font-bold', color)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
