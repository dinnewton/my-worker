import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Eye, Users, MousePointerClick, Loader2 } from 'lucide-react'
import { useContentAnalytics } from '../../hooks/useContent'
import { PlatformBadge } from './PlatformBadge'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  linkedin:  '#0A66C2',
  tiktok:    '#000000',
  twitter:   '#1DA1F2',
}

const MOCK_WEEKLY_ENGAGEMENT = [
  { day: 'Mon', likes: 120, comments: 18, shares: 32 },
  { day: 'Tue', likes: 190, comments: 42, shares: 55 },
  { day: 'Wed', likes: 85,  comments: 12, shares: 20 },
  { day: 'Thu', likes: 240, comments: 67, shares: 88 },
  { day: 'Fri', likes: 310, comments: 89, shares: 124 },
  { day: 'Sat', likes: 175, comments: 35, shares: 61 },
  { day: 'Sun', likes: 205, comments: 48, shares: 73 },
]

const MOCK_REACH_TREND = [
  { week: 'W1', reach: 1200, impressions: 3400 },
  { week: 'W2', reach: 1800, impressions: 5200 },
  { week: 'W3', reach: 1400, impressions: 4100 },
  { week: 'W4', reach: 2600, impressions: 7800 },
  { week: 'W5', reach: 3200, impressions: 9600 },
  { week: 'W6', reach: 2900, impressions: 8700 },
]

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bg: string
}

function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}

export function AnalyticsDashboard() {
  const { data, isLoading } = useContentAnalytics()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  const pieData = Object.entries(data?.platform_breakdown ?? {
    instagram: 45, facebook: 25, linkedin: 20, tiktok: 10,
  }).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Reach"
          value={data?.total_reach ?? 0}
          icon={Eye}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          label="Impressions"
          value={data?.total_impressions ?? 0}
          icon={TrendingUp}
          color="text-purple-600"
          bg="bg-purple-50 dark:bg-purple-900/20"
        />
        <StatCard
          label="Total Engagement"
          value={data?.total_engagement ?? 0}
          icon={Users}
          color="text-green-600"
          bg="bg-green-50 dark:bg-green-900/20"
        />
        <StatCard
          label="Avg Engagement Rate"
          value={`${(data?.avg_engagement_rate ?? 0).toFixed(1)}%`}
          icon={MousePointerClick}
          color="text-orange-600"
          bg="bg-orange-50 dark:bg-orange-900/20"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Engagement by Day */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Weekly Engagement</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_WEEKLY_ENGAGEMENT} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="likes"    fill="#3b82f6" radius={[4, 4, 0, 0]} name="Likes" />
              <Bar dataKey="comments" fill="#10b981" radius={[4, 4, 0, 0]} name="Comments" />
              <Bar dataKey="shares"   fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Shares" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Platform Breakdown Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Platform Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map(({ name, value }) => (
              <div key={name} className="flex items-center justify-between">
                <PlatformBadge platform={name} size="sm" showDot />
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{value} posts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reach Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Reach & Impressions Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={MOCK_REACH_TREND} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone" dataKey="reach"
              stroke="#3b82f6" strokeWidth={2} dot={false} name="Reach"
            />
            <Line
              type="monotone" dataKey="impressions"
              stroke="#8b5cf6" strokeWidth={2} dot={false} name="Impressions"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Posts */}
      {(data?.top_posts?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Performing Posts</h3>
          <div className="space-y-3">
            {data!.top_posts.map((post) => {
              const platforms: string[] = JSON.parse(post.platforms || '[]')
              const eng = post.likes + post.comments + post.shares
              return (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {platforms.slice(0, 2).map((p) => <PlatformBadge key={p} platform={p} size="sm" />)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{eng.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">engagements</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
