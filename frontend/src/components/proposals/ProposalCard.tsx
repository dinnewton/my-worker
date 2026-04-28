import { format } from 'date-fns'
import { DollarSign, Send, Eye, CheckCircle, XCircle, FileText, Clock, Trash2, Download, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { useUpdateProposalStatus, useDeleteProposal, useDownloadPDF } from '../../hooks/useProposals'
import type { ProposalSummary, ProposalStatus } from '../../types'
import { useState } from 'react'

const STATUS_CONFIG: Record<ProposalStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  draft:    { label: 'Draft',    icon: FileText,    color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-700' },
  sent:     { label: 'Sent',     icon: Send,        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  viewed:   { label: 'Viewed',   icon: Eye,         color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  accepted: { label: 'Accepted', icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  rejected: { label: 'Rejected', icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  expired:  { label: 'Expired',  icon: Clock,       color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
}

const TEMPLATE_LABELS: Record<string, string> = {
  digital_marketing: 'Digital Marketing',
  web_development:   'Web Development',
  seo:               'SEO',
  social_media:      'Social Media',
  email_marketing:   'Email Marketing',
  content_creation:  'Content Creation',
  full_service:      'Full Service',
  custom:            'Custom',
}

interface ProposalCardProps {
  proposal: ProposalSummary
  onClick: () => void
}

export function ProposalCard({ proposal, onClick }: ProposalCardProps) {
  const statusCfg = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon
  const updateStatus = useUpdateProposalStatus()
  const deleteProposal = useDeleteProposal()
  const downloadPDF = useDownloadPDF()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const shareUrl = `${window.location.origin}/proposals/share/${proposal.id}`

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
            {proposal.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {proposal.client_name}{proposal.client_company ? ` · ${proposal.client_company}` : ''}
          </p>
        </div>
        <span className={clsx(
          'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0',
          statusCfg.color, statusCfg.bg,
        )}>
          <StatusIcon className="w-3 h-3" />
          {statusCfg.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
          {TEMPLATE_LABELS[proposal.template_type] ?? 'Custom'}
        </span>
        {proposal.value > 0 && (
          <span className="flex items-center gap-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-3.5 h-3.5" />
            {proposal.value >= 1000 ? `${(proposal.value / 1000).toFixed(1)}k` : proposal.value.toFixed(0)}
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {format(new Date(proposal.created_at), 'MMM d, yyyy')}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap">
        {proposal.status === 'draft' && (
          <button
            onClick={() => updateStatus.mutate({ id: proposal.id, status: 'sent' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
            <Send className="w-3 h-3" /> Mark Sent
          </button>
        )}
        <button
          onClick={() => downloadPDF.mutate({ id: proposal.id, clientName: proposal.client_name })}
          disabled={downloadPDF.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Download className="w-3 h-3" /> PDF
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(shareUrl)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ExternalLink className="w-3 h-3" /> Share
        </button>
        <div className="ml-auto">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => deleteProposal.mutate(proposal.id)}
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
