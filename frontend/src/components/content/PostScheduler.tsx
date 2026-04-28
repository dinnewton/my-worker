import { useState } from 'react'
import { Clock, Zap, Loader2, CalendarPlus } from 'lucide-react'
import { format, addHours, parseISO } from 'date-fns'
import { clsx } from 'clsx'
import { PlatformSelector } from './PlatformBadge'
import { useSchedulePost, useOptimalTime } from '../../hooks/useContent'
import type { ContentPost } from '../../types'

interface PostSchedulerProps {
  post: ContentPost
  onScheduled?: () => void
}

export function PostScheduler({ post, onScheduled }: PostSchedulerProps) {
  const platforms: string[] = JSON.parse(post.platforms || '["instagram"]')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms)
  const [selectedDateTime, setSelectedDateTime] = useState(() => {
    const d = addHours(new Date(), 1)
    return format(d, "yyyy-MM-dd'T'HH:mm")
  })
  const [success, setSuccess] = useState(false)

  const primaryPlatform = selectedPlatforms[0] || 'instagram'
  const { data: optimalTime } = useOptimalTime(primaryPlatform)
  const schedulePost = useSchedulePost()

  const handleSchedule = async () => {
    await schedulePost.mutateAsync({
      id: post.id,
      scheduled_at: new Date(selectedDateTime).toISOString(),
      platforms: selectedPlatforms,
    })
    setSuccess(true)
    onScheduled?.()
  }

  const useOptimal = () => {
    if (optimalTime?.optimal_time) {
      const d = parseISO(optimalTime.optimal_time)
      setSelectedDateTime(format(d, "yyyy-MM-dd'T'HH:mm"))
    }
  }

  const minDateTime = format(new Date(), "yyyy-MM-dd'T'HH:mm")

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-5 h-5 text-brand-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Schedule Post</h3>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 truncate">
          Post: <span className="text-gray-700 dark:text-gray-300">{post.title}</span>
        </p>
      </div>

      {/* Platforms */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Publish to</label>
        <PlatformSelector selected={selectedPlatforms} onChange={setSelectedPlatforms} />
      </div>

      {/* Date/Time */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Date & Time</label>
          {optimalTime && (
            <button
              onClick={useOptimal}
              className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
            >
              <Zap className="w-3 h-3" />
              Use optimal time ({format(parseISO(optimalTime.optimal_time), 'h:mm a')})
            </button>
          )}
        </div>
        <input
          type="datetime-local"
          value={selectedDateTime}
          min={minDateTime}
          onChange={(e) => setSelectedDateTime(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Optimal Times Reference */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Best posting times (UTC)
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {[
            { p: 'instagram', times: '8am · 12pm · 7pm' },
            { p: 'facebook',  times: '9am · 1pm · 3pm' },
            { p: 'linkedin',  times: '8am · 12pm · 5pm' },
            { p: 'tiktok',    times: '6am · 2pm · 9pm' },
            { p: 'twitter',   times: '8am · 12pm · 5pm' },
          ].map(({ p, times }) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="text-gray-400 capitalize w-16">{p}</span>
              <span className="text-gray-600 dark:text-gray-400">{times}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSchedule}
        disabled={schedulePost.isPending || success || selectedPlatforms.length === 0}
        className={clsx(
          'w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all',
          success
            ? 'bg-green-600 text-white'
            : 'bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white'
        )}
      >
        {schedulePost.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling...</>
        ) : success ? (
          '✓ Scheduled!'
        ) : (
          <><CalendarPlus className="w-4 h-4" /> Schedule Post</>
        )}
      </button>
    </div>
  )
}
