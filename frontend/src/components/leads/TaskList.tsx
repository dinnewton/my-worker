import { useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { CheckCircle, Circle, Trash2, Zap, Loader2, ChevronDown, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import { useLeadTasks, useUpdateTask, useDeleteTask, useAIGenerateTasks } from '../../hooks/useLeads'
import type { FollowUpTask } from '../../types'

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  low:    { label: 'Low',    color: 'text-gray-500',                       dot: 'bg-gray-400' },
}

const TYPE_ICON: Record<string, string> = {
  call:      '📞',
  email:     '✉️',
  whatsapp:  '💬',
  meeting:   '🤝',
  proposal:  '📄',
  follow_up: '🔄',
  research:  '🔍',
  other:     '📌',
}

function TaskItem({ task, leadId }: { task: FollowUpTask; leadId: number }) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const isOverdue = task.due_date && !task.completed && isPast(new Date(task.due_date))
  const isDueToday = task.due_date && !task.completed && isToday(new Date(task.due_date))
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium

  const toggle = () => updateTask.mutate({
    id: task.id, leadId, completed: !task.completed,
  })

  return (
    <div className={clsx(
      'rounded-lg border transition-colors',
      task.completed
        ? 'border-gray-100 dark:border-gray-700 opacity-60'
        : isOverdue
        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
        : isDueToday
        ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
        : 'border-gray-200 dark:border-gray-700',
    )}>
      <div className="flex items-start gap-2.5 p-3">
        <button onClick={toggle} disabled={updateTask.isPending}
          className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-brand-600 transition-colors">
          {updateTask.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : task.completed
            ? <CheckCircle className="w-4 h-4 text-green-500" />
            : <Circle className="w-4 h-4" />
          }
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
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {task.description && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => deleteTask.mutate({ id: task.id, leadId })}
                className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Del</button>
              <button onClick={() => setConfirming(false)}
                className="text-[10px] px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-gray-500">No</button>
            </div>
          )}
        </div>
      </div>

      {expanded && task.description && (
        <div className="px-10 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{task.description}</p>
        </div>
      )}
    </div>
  )
}

interface TaskListProps {
  leadId: number
}

export function TaskList({ leadId }: TaskListProps) {
  const { data: tasks = [], isLoading } = useLeadTasks(leadId)
  const aiGenerate = useAIGenerateTasks()

  const pending = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  return (
    <div className="space-y-3">
      {/* AI Generate Button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {pending.length} pending · {completed.length} done
        </span>
        <button
          onClick={() => aiGenerate.mutate(leadId)}
          disabled={aiGenerate.isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
        >
          {aiGenerate.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Zap className="w-3.5 h-3.5" />
          }
          AI Generate Tasks
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="text-xs text-center text-gray-400 py-4">
          No tasks yet. Click "AI Generate Tasks" to get started.
        </p>
      )}

      <div className="space-y-2">
        {pending.map((t) => <TaskItem key={t.id} task={t} leadId={leadId} />)}
      </div>

      {completed.length > 0 && (
        <details>
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none py-1">
            {completed.length} completed tasks
          </summary>
          <div className="space-y-2 mt-2">
            {completed.map((t) => <TaskItem key={t.id} task={t} leadId={leadId} />)}
          </div>
        </details>
      )}
    </div>
  )
}
