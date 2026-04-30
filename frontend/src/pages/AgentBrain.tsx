import { useState } from 'react'
import {
  Brain, Play, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronRight, Zap, Mail, MessageSquare, FileText,
  Globe, BarChart2, Loader2, Trash2, Activity,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAgentRuns, useAgentStatus, useTriggerAgent, useDeleteAgentRun, type AgentRun } from '../hooks/useAgent'

// ─── Types ────────────────────────────────────────────────────────────────────

const TASK_TYPES = [
  { value: 'full_loop',      label: 'Full Loop',       icon: RefreshCw,     color: 'text-brand-600' },
  { value: 'whatsapp_check', label: 'WhatsApp Check',  icon: MessageSquare, color: 'text-green-600'  },
  { value: 'email_leads',    label: 'Email Leads',     icon: Mail,          color: 'text-blue-600'   },
  { value: 'followup_leads', label: 'Follow-ups',      icon: Activity,      color: 'text-orange-600' },
  { value: 'auto_proposals', label: 'Auto Proposals',  icon: FileText,      color: 'text-purple-600' },
  { value: 'website_queue',  label: 'Website Queue',   icon: Globe,         color: 'text-teal-600'   },
  { value: 'daily_summary',  label: 'Daily Summary',   icon: BarChart2,     color: 'text-rose-600'   },
] as const

type TaskValue = typeof TASK_TYPES[number]['value']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusIcon(status: string, size = 'w-4 h-4') {
  if (status === 'success')   return <CheckCircle className={clsx(size, 'text-green-500')} />
  if (status === 'partial')   return <AlertCircle className={clsx(size, 'text-yellow-500')} />
  if (status === 'failed')    return <XCircle className={clsx(size, 'text-red-500')} />
  if (status === 'running')   return <Loader2 className={clsx(size, 'text-brand-500 animate-spin')} />
  if (status === 'skipped')   return <Clock className={clsx(size, 'text-gray-400')} />
  return <Clock className={clsx(size, 'text-gray-400')} />
}

function statusBadge(status: string) {
  const cls: Record<string, string> = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    running: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
    skipped: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide', cls[status] ?? cls.skipped)}>
      {statusIcon(status, 'w-3 h-3')} {status}
    </span>
  )
}

function taskLabel(type: string) {
  return TASK_TYPES.find(t => t.value === type)?.label ?? type
}

function fmt(seconds: number | null) {
  if (!seconds) return '—'
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds / 60).toFixed(1)}m`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

// ─── RunCard ─────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false)
  const del = useDeleteAgentRun()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-shrink-0">{statusIcon(run.status, 'w-5 h-5')}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {taskLabel(run.run_type)}
            </span>
            {statusBadge(run.status)}
            {run.trigger === 'manual' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-brand-100 text-brand-600 rounded-full font-medium">manual</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {run.summary ?? run.error_message ?? 'No summary'}
          </p>
        </div>
        <div className="text-right flex-shrink-0 hidden sm:block">
          <p className="text-xs text-gray-500">{fmtTime(run.started_at)}</p>
          <p className="text-xs text-gray-400">{fmt(run.duration_seconds)} · {run.actions_taken} actions</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); del.mutate(run.id) }}
            className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && run.actions.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Tool Calls</p>
          {run.actions.map(action => {
            let outputPreview = ''
            try { outputPreview = JSON.stringify(JSON.parse(action.tool_output ?? '{}'), null, 0).slice(0, 120) } catch { outputPreview = action.tool_output?.slice(0, 120) ?? '' }
            return (
              <div key={action.id} className="flex items-start gap-2">
                <div className={clsx('mt-0.5 w-2 h-2 rounded-full flex-shrink-0',
                  action.status === 'success' ? 'bg-green-400' : action.status === 'error' ? 'bg-red-400' : 'bg-gray-300'
                )} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400">
                    {action.tool_name}
                  </span>
                  {action.duration_ms && (
                    <span className="text-[10px] text-gray-400 ml-2">{action.duration_ms}ms</span>
                  )}
                  {outputPreview && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono break-all">
                      {outputPreview}
                    </p>
                  )}
                  {action.error && (
                    <p className="text-[11px] text-red-500 mt-0.5">{action.error}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AgentBrain() {
  const [activeFilter, setActiveFilter] = useState<TaskValue | 'all'>('all')
  const { data: runs = [], isLoading } = useAgentRuns(activeFilter !== 'all' ? activeFilter : undefined)
  const { data: status } = useAgentStatus()
  const trigger = useTriggerAgent()
  const [triggering, setTriggering] = useState<string | null>(null)

  async function handleTrigger(taskType: string) {
    setTriggering(taskType)
    try { await trigger.mutateAsync(taskType) } finally { setTriggering(null) }
  }

  // Stats from last_runs
  const lastRuns = status?.last_runs ?? []
  const successCount = lastRuns.filter(r => r.status === 'success').length
  const failedCount  = lastRuns.filter(r => r.status === 'failed').length
  const totalActions = lastRuns.reduce((s, r) => s + r.actions_taken, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-brand-500" />
            AI Agent Brain
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Autonomous Claude agent — runs 24/7 to operate your agency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold',
            status?.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          )}>
            <span className={clsx('w-2 h-2 rounded-full', status?.enabled ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
            {status?.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tasks tracked',     value: lastRuns.length,  color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',   icon: Activity },
          { label: 'Successful',        value: successCount,     color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle },
          { label: 'Failed',            value: failedCount,      color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20',     icon: XCircle },
          { label: 'Total actions',     value: totalActions,     color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-900/20', icon: Zap },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4">
            <div className={clsx('p-2.5 rounded-xl', bg)}>
              <Icon className={clsx('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className={clsx('text-xl font-bold', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Manual triggers */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Trigger Manually</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {TASK_TYPES.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => handleTrigger(value)}
              disabled={triggering === value}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all text-center',
                'border-gray-200 dark:border-gray-600 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10',
                triggering === value && 'opacity-60 cursor-not-allowed',
              )}
            >
              {triggering === value
                ? <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                : <Icon className={clsx('w-5 h-5', color)} />
              }
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Next scheduled runs */}
      {status?.jobs && status.jobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Scheduled Jobs</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {status.jobs.map(job => (
              <div key={job.id} className="text-center">
                <p className="text-[10px] font-mono text-gray-400">{job.id.replace(/_/g, ' ')}</p>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                  {job.next_run ? new Date(job.next_run).toLocaleTimeString(undefined, { timeStyle: 'short' }) : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Run list */}
      <div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex-wrap mb-4">
          {[{ value: 'all', label: 'All' }, ...TASK_TYPES.map(t => ({ value: t.value, label: t.label }))].map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value as TaskValue | 'all')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeFilter === f.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-brand-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No agent runs yet</p>
            <p className="text-sm text-gray-400 mt-1">Trigger a task manually or wait for the hourly loop</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map(run => <RunCard key={run.id} run={run} />)}
          </div>
        )}
      </div>
    </div>
  )
}
