import { useState } from 'react'
import {
  X, Download, Send, ExternalLink, Edit2, CheckCircle, XCircle,
  Zap, Loader2, DollarSign, Clock, Calendar, Copy, Check,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { useProposal, useUpdateProposalStatus, useDownloadPDF } from '../../hooks/useProposals'
import type { ProposalSection, ProposalMilestone, PricingItem, ProposalStatus } from '../../types'

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}

const STATUS_ACTIONS: Partial<Record<ProposalStatus, { label: string; to: ProposalStatus; color: string }[]>> = {
  draft:  [{ label: 'Mark as Sent',     to: 'sent',     color: 'bg-blue-600 hover:bg-blue-700' }],
  sent:   [
    { label: 'Mark as Viewed',    to: 'viewed',   color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Mark as Accepted',  to: 'accepted', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Mark as Rejected',  to: 'rejected', color: 'bg-red-600 hover:bg-red-700' },
  ],
  viewed: [
    { label: 'Mark as Accepted',  to: 'accepted', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Mark as Rejected',  to: 'rejected', color: 'bg-red-600 hover:bg-red-700' },
  ],
}

interface ProposalDetailProps {
  proposalId: number
  onClose: () => void
}

export function ProposalDetail({ proposalId, onClose }: ProposalDetailProps) {
  const { data: proposal, isLoading } = useProposal(proposalId)
  const updateStatus = useUpdateProposalStatus()
  const downloadPDF = useDownloadPDF()
  const { copied, copy } = useCopy()

  if (isLoading || !proposal) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      </>
    )
  }

  const sections: ProposalSection[] = proposal.sections ? JSON.parse(proposal.sections) : []
  const milestones: ProposalMilestone[] = proposal.timeline ? JSON.parse(proposal.timeline) : []
  const deliverables: string[] = proposal.deliverables ? JSON.parse(proposal.deliverables) : []
  const pricing: PricingItem[] = proposal.pricing_breakdown ? JSON.parse(proposal.pricing_breakdown) : []
  const winTips: string[] = proposal.ai_win_tips ? JSON.parse(proposal.ai_win_tips) : []
  const actions = STATUS_ACTIONS[proposal.status as ProposalStatus] ?? []
  const shareUrl = `${window.location.origin}/proposals/share/${proposal.share_token}`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white text-base leading-snug">{proposal.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {proposal.client_name}{proposal.client_company ? ` · ${proposal.client_company}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          {proposal.value > 0 && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ${proposal.value >= 1000 ? `${(proposal.value / 1000).toFixed(1)}k` : proposal.value.toFixed(0)}
              </span>
            </div>
          )}
          {proposal.timeline_weeks > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{proposal.timeline_weeks} weeks</span>
            </div>
          )}
          {proposal.valid_until && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Valid until {format(new Date(proposal.valid_until), 'MMM d, yyyy')}
              </span>
            </div>
          )}
          {proposal.signature_name && (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">
                Signed by {proposal.signature_name}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <button
            onClick={() => downloadPDF.mutate({ id: proposal.id, clientName: proposal.client_name })}
            disabled={downloadPDF.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {downloadPDF.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
          <button onClick={() => copy(shareUrl)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Share Link'}
          </button>
          {actions.map((action) => (
            <button key={action.to}
              onClick={() => updateStatus.mutate({ id: proposal.id, status: action.to })}
              disabled={updateStatus.isPending}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60 transition-colors',
                action.color,
              )}>
              <Send className="w-3.5 h-3.5" /> {action.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Cover Letter */}
          {proposal.cover_letter && (
            <section>
              <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wide mb-3">Cover Letter</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {proposal.cover_letter.split('\n\n').map((p, i) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{p}</p>
                ))}
              </div>
            </section>
          )}

          {/* Sections */}
          {sections.map((sec, i) => (
            <section key={i}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 pb-1 border-b border-gray-100 dark:border-gray-800">
                {sec.heading}
              </h3>
              {sec.content.split('\n\n').map((p, j) => (
                <p key={j} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">{p}</p>
              ))}
            </section>
          ))}

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 pb-1 border-b border-gray-100 dark:border-gray-800">
                Deliverables
              </h3>
              <ul className="space-y-1.5">
                {deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Timeline */}
          {milestones.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">
                Project Timeline
              </h3>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-full flex-shrink-0 mt-0.5 min-w-[60px] text-center">
                      {m.week}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{m.milestone}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pricing */}
          {pricing.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">
                Investment
              </h3>
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {pricing.map((item, i) => (
                  <div key={i} className={clsx(
                    'flex items-center justify-between px-4 py-3 text-sm',
                    i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800',
                  )}>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.item}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">
                      {item.price > 0 ? `$${item.price.toLocaleString()}` : 'Included'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white">
                  <span className="font-bold">Total Investment</span>
                  <span className="font-bold text-lg">${proposal.value.toLocaleString()}</span>
                </div>
              </div>
              {proposal.monthly_retainer > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Monthly retainer: <strong className="text-gray-700 dark:text-gray-300">${proposal.monthly_retainer.toLocaleString()}/mo</strong>
                </p>
              )}
            </section>
          )}

          {/* AI Win Tips */}
          {winTips.length > 0 && (
            <section className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800">
              <h3 className="text-xs font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5 mb-3">
                <Zap className="w-3.5 h-3.5" /> AI Tips to Win This Deal
              </h3>
              {winTips.map((tip, i) => (
                <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300 py-0.5">
                  {i + 1}. {tip}
                </p>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
