import { clsx } from 'clsx'
import type { SocialPlatform } from '../../types'

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-700 dark:text-pink-400',   bg: 'bg-pink-50 dark:bg-pink-900/20',   dot: 'bg-pink-500' },
  facebook:  { label: 'Facebook',  color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   dot: 'bg-blue-600' },
  linkedin:  { label: 'LinkedIn',  color: 'text-sky-700 dark:text-sky-400',     bg: 'bg-sky-50 dark:bg-sky-900/20',     dot: 'bg-sky-600' },
  tiktok:    { label: 'TikTok',    color: 'text-gray-800 dark:text-gray-200',   bg: 'bg-gray-100 dark:bg-gray-700',     dot: 'bg-gray-900 dark:bg-white' },
  twitter:   { label: 'X/Twitter', color: 'text-gray-700 dark:text-gray-300',   bg: 'bg-gray-100 dark:bg-gray-700',     dot: 'bg-gray-800 dark:bg-gray-200' },
  all:       { label: 'All',       color: 'text-brand-700 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/20', dot: 'bg-brand-500' },
}

interface PlatformBadgeProps {
  platform: string
  size?: 'sm' | 'md'
  showDot?: boolean
}

export function PlatformBadge({ platform, size = 'md', showDot = false }: PlatformBadgeProps) {
  const cfg = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.all
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full font-medium',
      cfg.color, cfg.bg,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
    )}>
      {showDot && <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />}
      {cfg.label}
    </span>
  )
}

interface PlatformSelectorProps {
  selected: string[]
  onChange: (platforms: string[]) => void
  className?: string
}

export function PlatformSelector({ selected, onChange, className }: PlatformSelectorProps) {
  const platforms: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter']

  const toggle = (p: string) => {
    if (selected.includes(p)) {
      onChange(selected.filter((x) => x !== p))
    } else {
      onChange([...selected, p])
    }
  }

  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {platforms.map((p) => {
        const cfg = PLATFORM_CONFIG[p]
        const active = selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
              active
                ? `${cfg.color} ${cfg.bg} border-current`
                : 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            <span className={clsx('w-2 h-2 rounded-full', active ? cfg.dot : 'bg-gray-400')} />
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}
