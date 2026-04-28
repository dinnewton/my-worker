import { Building2, Mail, Phone, MessageCircle, DollarSign, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import { ScoreBadge, SourceBadge } from './ScoreBadge'
import type { Lead } from '../../types'

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500 animate-pulse',
  high:   'bg-orange-500',
  medium: 'bg-yellow-500',
  low:    'bg-gray-400',
}

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
  isDragging?: boolean
}

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const tags: string[] = lead.tags ? JSON.parse(lead.tags) : []

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', String(lead.id))
        e.dataTransfer.setData('fromStatus', lead.status)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      className={clsx(
        'group bg-white dark:bg-gray-800 rounded-xl border p-3.5 cursor-pointer select-none',
        'hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-all',
        isDragging
          ? 'opacity-40 border-brand-400 shadow-lg rotate-1'
          : 'border-gray-200 dark:border-gray-700',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={clsx(
            'w-2 h-2 rounded-full flex-shrink-0 mt-1.5',
            PRIORITY_DOT[lead.priority] ?? 'bg-gray-400',
          )} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
              {lead.name}
            </p>
            {lead.company && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{lead.company}</span>
              </p>
            )}
          </div>
        </div>
        <ScoreBadge score={lead.score} size="sm" />
      </div>

      {/* Contact chips */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        {lead.email && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <Mail className="w-3 h-3" /> Email
          </span>
        )}
        {lead.phone && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <Phone className="w-3 h-3" /> Phone
          </span>
        )}
        {lead.whatsapp && (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <SourceBadge source={lead.source} />
        {lead.deal_value > 0 && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-3 h-3" />
            {lead.deal_value >= 1000
              ? `${(lead.deal_value / 1000).toFixed(1)}k`
              : lead.deal_value.toFixed(0)}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-gray-400">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Drag handle hint on hover */}
      <div className="absolute top-1/2 -left-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
        <GripVertical className="w-4 h-4" />
      </div>
    </div>
  )
}
