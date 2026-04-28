import { useState } from 'react'
import {
  X, Mail, Phone, MessageCircle, Globe, Building2, MapPin,
  DollarSign, Zap, Loader2, RefreshCw, Send, Edit2, Trash2,
  AlertTriangle, TrendingUp, Tag, Calendar,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import {
  useAIScoreLead, useAIInsights, useAIOutreach, useDeleteLead,
} from '../../hooks/useLeads'
import { ScoreBadge, ScoreBar } from './ScoreBadge'
import { LeadTimeline } from './LeadTimeline'
import { TaskList } from './TaskList'
import type { Lead, LeadScoreResult } from '../../types'

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  low:    { label: 'Low',    color: 'text-gray-500',                       bg: 'bg-gray-50 dark:bg-gray-800' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:           { label: 'New',           color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  contacted:     { label: 'Contacted',     color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  qualified:     { label: 'Qualified',     color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  proposal_sent: { label: 'Proposal Sent', color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' },
  won:           { label: 'Won',           color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  lost:          { label: 'Lost',          color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
}

type Tab = 'overview' | 'timeline' | 'tasks'

interface OutreachPanelProps {
  leadId: number
  onClose: () => void
}

function OutreachPanel({ leadId, onClose }: OutreachPanelProps) {
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'linkedin' | 'sms' | 'cold_call'>('email')
  const aiOutreach = useAIOutreach()

  const channels = [
    { value: 'email' as const, label: 'Email' },
    { value: 'whatsapp' as const, label: 'WhatsApp' },
    { value: 'linkedin' as const, label: 'LinkedIn' },
    { value: 'sms' as const, label: 'SMS' },
    { value: 'cold_call' as const, label: 'Call Script' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Generate Outreach</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Channel</p>
            <div className="flex gap-2 flex-wrap">
              {channels.map(({ value, label }) => (
                <button key={value} onClick={() => setChannel(value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    channel === value
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400',
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {aiOutreach.data && (
            <div className="space-y-2">
              {aiOutreach.data.subject && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{aiOutreach.data.subject}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Message</p>
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 font-sans">
                  {aiOutreach.data.message}
                </pre>
              </div>
              {aiOutreach.data.follow_up_sequence?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Follow-up sequence</p>
                  {aiOutreach.data.follow_up_sequence.map((step: string, i: number) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400 py-0.5">
                      <span className="font-medium text-brand-600">Step {i + 1}:</span> {step}
                    </p>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(aiOutreach.data.message)}
                className="w-full py-2 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => aiOutreach.mutate({ id: leadId, channel })}
            disabled={aiOutreach.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {aiOutreach.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Zap className="w-4 h-4" /> Generate Message</>}
          </button>
        </div>
      </div>
    </div>
  )
}

interface LeadDetailProps {
  lead: Lead
  onClose: () => void
  onEdit: (lead: Lead) => void
}

export function LeadDetail({ lead, onClose, onEdit }: LeadDetailProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [showOutreach, setShowOutreach] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const aiScore = useAIScoreLead()
  const aiInsights = useAIInsights(lead.id)
  const deleteLead = useDeleteLead()

  const tags: string[] = lead.tags ? JSON.parse(lead.tags) : []
  const keyFactors: string[] = lead.ai_key_factors ? JSON.parse(lead.ai_key_factors) : []
  const priority = PRIORITY_CONFIG[lead.priority] ?? PRIORITY_CONFIG.medium
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
  const scoreResult: LeadScoreResult | null = aiScore.data ?? null

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Slide-in Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{lead.name}</h2>
              <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.color)}>
                {status.label}
              </span>
              <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full', priority.color, priority.bg)}>
                {priority.label}
              </span>
            </div>
            {lead.company && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3.5 h-3.5" /> {lead.company}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ScoreBadge score={lead.score} size="lg" />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Score Bar */}
        <div className="px-5 py-2 border-b border-gray-100 dark:border-gray-800">
          <ScoreBar score={lead.score} />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => aiScore.mutate(lead.id)}
            disabled={aiScore.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-60 transition-colors">
            {aiScore.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Re-score
          </button>
          <button
            onClick={() => setShowOutreach(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
            <Send className="w-3.5 h-3.5" /> Outreach
          </button>
          <button
            onClick={() => onEdit(lead)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <div className="ml-auto">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={handleDelete} disabled={deleteLead.isPending}
                  className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg">
                  {deleteLead.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
          {(['overview', 'timeline', 'tasks'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx(
                'py-2.5 px-1 mr-5 text-xs font-medium border-b-2 transition-colors capitalize',
                tab === t
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'overview' && (
            <div className="p-5 space-y-5">
              {/* Contact Info */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600 transition-colors">
                      <Mail className="w-4 h-4 text-gray-400" /> {lead.email}
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600 transition-colors">
                      <Phone className="w-4 h-4 text-gray-400" /> {lead.phone}
                    </a>
                  )}
                  {lead.whatsapp && (
                    <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors">
                      <MessageCircle className="w-4 h-4" /> {lead.whatsapp}
                    </a>
                  )}
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600 transition-colors">
                      <Globe className="w-4 h-4 text-gray-400" /> {lead.website}
                    </a>
                  )}
                  {lead.location && (
                    <p className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <MapPin className="w-4 h-4 text-gray-400" /> {lead.location}
                    </p>
                  )}
                </div>
              </div>

              {/* Deal Details */}
              <div className="grid grid-cols-2 gap-3">
                {lead.deal_value > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800">
                    <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Deal Value</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                      <DollarSign className="w-4 h-4" />
                      {lead.deal_value >= 1000 ? `${(lead.deal_value / 1000).toFixed(1)}k` : lead.deal_value.toFixed(0)}
                    </p>
                  </div>
                )}
                {lead.industry && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Industry</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{lead.industry}</p>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="flex gap-4 text-xs text-gray-400">
                {lead.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Added {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </span>
                )}
                {lead.last_contact_at && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Last contact {format(new Date(lead.last_contact_at), 'MMM d')}
                  </span>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {(scoreResult?.summary || lead.ai_summary) && (
                <div className="bg-brand-50 dark:bg-brand-900/10 rounded-xl p-4 border border-brand-100 dark:border-brand-800">
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1 mb-2">
                    <Zap className="w-3.5 h-3.5" /> AI Summary
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {scoreResult?.summary ?? lead.ai_summary}
                  </p>
                </div>
              )}

              {/* AI Next Action */}
              {(scoreResult?.next_action || lead.ai_next_action) && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1.5">Recommended Next Action</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {scoreResult?.next_action ?? lead.ai_next_action}
                  </p>
                </div>
              )}

              {/* Key Factors */}
              {keyFactors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">AI Key Factors</p>
                  <ul className="space-y-1.5">
                    {keyFactors.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Insights */}
              {aiInsights.data && (
                <div className="space-y-3">
                  {aiInsights.data.red_flags?.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-800">
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
                      </p>
                      {aiInsights.data.red_flags.map((f: string, i: number) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-300">• {f}</p>
                      ))}
                    </div>
                  )}
                  {aiInsights.data.talking_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Talking Points</p>
                      {aiInsights.data.talking_points.map((p: string, i: number) => (
                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400 py-0.5">✓ {p}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {lead.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="p-5">
              <LeadTimeline leadId={lead.id} />
            </div>
          )}

          {tab === 'tasks' && (
            <div className="p-5">
              <TaskList leadId={lead.id} />
            </div>
          )}
        </div>
      </div>

      {showOutreach && (
        <OutreachPanel leadId={lead.id} onClose={() => setShowOutreach(false)} />
      )}
    </>
  )
}
