import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, LayoutGrid } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
         isSameMonth, isToday, getDay, addMonths, subMonths, addWeeks, subWeeks,
         startOfWeek as sowFn, endOfWeek as eowFn } from 'date-fns'
import { clsx } from 'clsx'
import { useContentCalendar } from '../../hooks/useContent'
import { PlatformBadge } from './PlatformBadge'
import type { CalendarDay, PostStatus } from '../../types'

const STATUS_COLOR: Record<PostStatus, string> = {
  draft:      'bg-gray-400',
  scheduled:  'bg-yellow-500',
  publishing: 'bg-blue-500 animate-pulse',
  published:  'bg-green-500',
  failed:     'bg-red-500',
}

interface DayPopoverProps {
  date: Date
  posts: CalendarDay[]
  onClose: () => void
}

function DayPopover({ date, posts, onClose }: DayPopoverProps) {
  return (
    <div className="absolute z-20 top-full mt-1 left-0 w-72 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {format(date, 'EEEE, MMM d')}
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>
      {posts.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No posts scheduled</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', STATUS_COLOR[p.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.title}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {p.platforms.map((pl) => (
                    <PlatformBadge key={pl} platform={pl} size="sm" />
                  ))}
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {p.scheduled_at ? format(new Date(p.scheduled_at), 'h:mm a') : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week'>('month')
  const [openDay, setOpenDay] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const { data: calData, isLoading } = useContentCalendar(year, month)

  const getDayPosts = (day: number): CalendarDay[] => {
    if (!calData) return []
    return calData.days[day.toString()] || []
  }

  // Month view days
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  // Week view days
  const weekStart = sowFn(currentDate, { weekStartsOn: 0 })
  const weekEnd = eowFn(currentDate, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const goBack = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else setCurrentDate(subWeeks(currentDate, 1))
  }

  const goForward = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else setCurrentDate(addWeeks(currentDate, 1))
  }

  const headerLabel =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy')
      : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">{headerLabel}</h2>
          <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setView('month')}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === 'month' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Month
            </button>
            <button
              onClick={() => setView('week')}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                view === 'week' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Week
            </button>
          </div>
        </div>
      </div>

      {/* Day Labels */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Month View */}
      {view === 'month' && (
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-700/50">
          {calDays.map((day) => {
            const dayNum = day.getDate()
            const inMonth = isSameMonth(day, currentDate)
            const dayPosts = inMonth ? getDayPosts(dayNum) : []
            const dateKey = format(day, 'yyyy-MM-dd')
            const isOpen = openDay === dateKey

            return (
              <div
                key={dateKey}
                className={clsx(
                  'relative min-h-[90px] p-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors',
                  !inMonth && 'opacity-40',
                  isToday(day) && 'bg-brand-50/50 dark:bg-brand-900/10'
                )}
                onClick={() => setOpenDay(isOpen ? null : dateKey)}
              >
                <div className={clsx(
                  'w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full mb-1',
                  isToday(day) ? 'bg-brand-600 text-white' : 'text-gray-700 dark:text-gray-300'
                )}>
                  {dayNum}
                </div>

                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center gap-1">
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_COLOR[p.status])} />
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{p.title}</p>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <p className="text-[10px] text-gray-400">+{dayPosts.length - 3} more</p>
                  )}
                </div>

                {isOpen && (
                  <DayPopover date={day} posts={dayPosts} onClose={() => setOpenDay(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700/50 min-h-[300px]">
          {weekDays.map((day) => {
            const dayNum = day.getDate()
            const dayPosts = getDayPosts(dayNum)

            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={clsx(
                  'p-3 min-h-[200px]',
                  isToday(day) && 'bg-brand-50/50 dark:bg-brand-900/10'
                )}
              >
                <div className="text-center mb-3">
                  <p className="text-xs text-gray-400">{format(day, 'EEE')}</p>
                  <div className={clsx(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-semibold',
                    isToday(day) ? 'bg-brand-600 text-white' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    {dayNum}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {dayPosts.map((p) => (
                    <div key={p.id} className={clsx(
                      'p-2 rounded-lg text-[11px] cursor-pointer hover:opacity-80 transition-opacity',
                      p.status === 'published' ? 'bg-green-50 dark:bg-green-900/20' :
                      p.status === 'scheduled' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                      'bg-gray-50 dark:bg-gray-700/50'
                    )}>
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{p.title}</p>
                      <p className="text-gray-400 mt-0.5">
                        {p.scheduled_at ? format(new Date(p.scheduled_at), 'h:mm a') : ''}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {p.platforms.slice(0, 2).map((pl) => (
                          <PlatformBadge key={pl} platform={pl} size="sm" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={clsx('w-2 h-2 rounded-full', color.replace(' animate-pulse', ''))} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
