import { useState } from 'react'
import { Sparkles, CalendarDays, LayoutGrid, BarChart2, Filter, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { ContentGenerator } from '../components/content/ContentGenerator'
import { ContentCalendar } from '../components/content/ContentCalendar'
import { PostCard } from '../components/content/PostCard'
import { PostScheduler } from '../components/content/PostScheduler'
import { AnalyticsDashboard } from '../components/content/AnalyticsDashboard'
import { PlatformBadge } from '../components/content/PlatformBadge'
import { useContentPosts } from '../hooks/useContent'
import type { ContentPost, PostStatus, SocialPlatform } from '../types'

type Tab = 'generate' | 'calendar' | 'posts' | 'analytics'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'generate',  label: 'Generate',  icon: Sparkles },
  { key: 'calendar',  label: 'Calendar',  icon: CalendarDays },
  { key: 'posts',     label: 'Posts',     icon: LayoutGrid },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
]

const PLATFORM_FILTERS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'twitter',   label: 'X/Twitter' },
]

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '',          label: 'All Status' },
  { value: 'draft',     label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'failed',    label: 'Failed' },
]

export function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('generate')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [schedulingPost, setSchedulingPost] = useState<ContentPost | null>(null)

  const { data: posts = [], isLoading, refetch } = useContentPosts(
    statusFilter || undefined,
    platformFilter !== 'all' ? platformFilter : undefined,
  )

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Content & Social Media</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-powered content creation and scheduling for all platforms
          </p>
        </div>

        {/* Platform Status Row */}
        <div className="hidden lg:flex items-center gap-2">
          {(['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter'] as SocialPlatform[]).map((p) => (
            <PlatformBadge key={p} platform={p} size="sm" showDot />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            )}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Generate Tab ── */}
      {activeTab === 'generate' && <ContentGenerator />}

      {/* ── Calendar Tab ── */}
      {activeTab === 'calendar' && <ContentCalendar />}

      {/* ── Posts Tab ── */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Filter className="w-4 h-4" />
              <span>Filter:</span>
            </div>

            {/* Status filter */}
            <div className="flex gap-1">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                    statusFilter === value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Platform filter */}
            <div className="flex gap-1">
              {PLATFORM_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPlatformFilter(value)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                    platformFilter === value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => refetch()}
              className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Posts Grid + Scheduler side panel */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            <div className="xl:col-span-3">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-64 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <LayoutGrid className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No posts found. Generate some content first!</p>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="mt-3 text-sm text-brand-600 hover:underline"
                  >
                    Go to Generate
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onEdit={(p) => setSchedulingPost(p)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Panel */}
            <div className="xl:col-span-1">
              {schedulingPost ? (
                <PostScheduler
                  post={schedulingPost}
                  onScheduled={() => {
                    setSchedulingPost(null)
                    refetch()
                  }}
                />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 text-center text-gray-400">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Click Edit on a post to schedule it</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === 'analytics' && <AnalyticsDashboard />}
    </div>
  )
}
