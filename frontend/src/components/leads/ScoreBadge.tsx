import { clsx } from 'clsx'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: 'ring-green-500',  text: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  bar: 'bg-green-500',  label: 'Hot' }
  if (score >= 60) return { ring: 'ring-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', bar: 'bg-yellow-500', label: 'Warm' }
  if (score >= 40) return { ring: 'ring-orange-400', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-400', label: 'Cool' }
  return             { ring: 'ring-gray-300',   text: 'text-gray-500 dark:text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-700',         bar: 'bg-gray-400',   label: 'Cold' }
}

export function ScoreBadge({ score, size = 'md', showLabel = false }: ScoreBadgeProps) {
  const cfg = scoreColor(score)
  const rounded = Math.round(score)

  if (size === 'lg') {
    return (
      <div className={clsx('flex flex-col items-center gap-1 px-4 py-3 rounded-xl ring-2', cfg.ring, cfg.bg)}>
        <span className={clsx('font-bold text-2xl', cfg.text)}>{rounded}</span>
        <span className="text-xs text-gray-400">/ 100</span>
        {showLabel && (
          <span className={clsx('text-xs font-semibold uppercase tracking-wide', cfg.text)}>{cfg.label}</span>
        )}
        <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mt-1">
          <div className={clsx('h-full rounded-full transition-all', cfg.bar)} style={{ width: `${rounded}%` }} />
        </div>
      </div>
    )
  }

  if (size === 'md') {
    return (
      <div className="flex items-center gap-2">
        <span className={clsx(
          'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ring-2',
          cfg.ring, cfg.text, cfg.bg,
        )}>
          {rounded}
        </span>
        {showLabel && <span className={clsx('text-xs font-medium', cfg.text)}>{cfg.label}</span>}
      </div>
    )
  }

  // sm
  return (
    <span className={clsx(
      'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ring-1',
      cfg.ring, cfg.text, cfg.bg,
    )}>
      {rounded}
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const cfg = scoreColor(score)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', cfg.bar)}
          style={{ width: `${Math.round(score)}%` }}
        />
      </div>
      <span className={clsx('text-xs font-semibold w-7 text-right', cfg.text)}>{Math.round(score)}</span>
    </div>
  )
}

export function SourceBadge({ source }: { source: string }) {
  const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    whatsapp:      { label: 'WhatsApp',    color: 'text-green-700 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
    website_form:  { label: 'Website',     color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    referral:      { label: 'Referral',    color: 'text-purple-700 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/20' },
    social_media:  { label: 'Social',      color: 'text-pink-700 dark:text-pink-400',    bg: 'bg-pink-50 dark:bg-pink-900/20' },
    linkedin:      { label: 'LinkedIn',    color: 'text-sky-700 dark:text-sky-400',      bg: 'bg-sky-50 dark:bg-sky-900/20' },
    instagram:     { label: 'Instagram',   color: 'text-pink-700 dark:text-pink-400',    bg: 'bg-pink-50 dark:bg-pink-900/20' },
    facebook:      { label: 'Facebook',    color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    email_campaign:{ label: 'Email',       color: 'text-orange-700 dark:text-orange-400',bg: 'bg-orange-50 dark:bg-orange-900/20' },
    cold_outreach: { label: 'Cold',        color: 'text-gray-600 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-gray-700' },
    manual:        { label: 'Manual',      color: 'text-gray-600 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-gray-700' },
    web_scrape:    { label: 'Web Scrape',  color: 'text-indigo-700 dark:text-indigo-400',bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  }
  const cfg = SOURCE_CONFIG[source] ?? { label: source, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' }
  return (
    <span className={clsx('inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  )
}
