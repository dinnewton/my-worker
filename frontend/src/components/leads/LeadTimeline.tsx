import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  MessageSquare, Phone, Mail, MessageCircle, Users, Zap,
  TrendingUp, CheckCircle, FileText, Send, ClipboardList, Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useLeadActivities, useAddActivity } from '../../hooks/useLeads'
import type { ActivityKind } from '../../types'

const KIND_META: Record<ActivityKind, { icon: React.ElementType; color: string; bg: string }> = {
  note:           { icon: MessageSquare, color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-700' },
  call:           { icon: Phone,         color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  email:          { icon: Mail,          color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  whatsapp:       { icon: MessageCircle, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  meeting:        { icon: Users,         color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  status_change:  { icon: TrendingUp,    color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-900/20' },
  score_update:   { icon: Zap,           color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  task_created:   { icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  task_completed: { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  proposal_sent:  { icon: FileText,      color: 'text-pink-600',   bg: 'bg-pink-50 dark:bg-pink-900/20' },
  ai_action:      { icon: Zap,           color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-900/20' },
  form_submit:    { icon: Send,          color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/20' },
}

const LOG_KINDS: { value: ActivityKind; label: string }[] = [
  { value: 'note',    label: 'Note' },
  { value: 'call',    label: 'Call' },
  { value: 'email',   label: 'Email' },
  { value: 'whatsapp',label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
]

interface LeadTimelineProps {
  leadId: number
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const { data: activities = [], isLoading } = useLeadActivities(leadId)
  const addActivity = useAddActivity()

  const [kind, setKind] = useState<ActivityKind>('note')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)

  const handleAdd = async () => {
    if (!title.trim()) return
    await addActivity.mutateAsync({ leadId, kind, title, description: description || undefined })
    setTitle('')
    setDescription('')
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {/* Log activity button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 text-xs font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          + Log activity / note
        </button>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-2.5 border border-gray-200 dark:border-gray-600">
          {/* Kind selector */}
          <div className="flex gap-1.5 flex-wrap">
            {LOG_KINDS.map(({ value, label }) => {
              const meta = KIND_META[value]
              const Icon = meta.icon
              return (
                <button key={value} onClick={() => setKind(value)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                    kind === value ? `${meta.color} ${meta.bg} border-current` : 'border-gray-200 dark:border-gray-600 text-gray-500',
                  )}>
                  <Icon className="w-3 h-3" />{label}
                </button>
              )
            })}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title / summary *"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={!title.trim() || addActivity.isPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {addActivity.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline entries */}
      {isLoading && (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-brand-500 animate-spin" /></div>
      )}
      <div className="relative">
        {activities.length > 0 && (
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        )}
        <div className="space-y-3">
          {activities.map((act) => {
            const meta = KIND_META[act.kind] ?? KIND_META.note
            const Icon = meta.icon
            return (
              <div key={act.id} className="flex gap-3">
                <div className={clsx(
                  'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10',
                  meta.bg,
                )}>
                  <Icon className={clsx('w-4 h-4', meta.color)} />
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{act.title}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {act.description}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {act.created_by} · {format(new Date(act.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            )
          })}
          {!isLoading && activities.length === 0 && (
            <p className="text-xs text-center text-gray-400 py-4">No activity yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
