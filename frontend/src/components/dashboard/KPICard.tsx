import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { clsx } from 'clsx'

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  prefix?: string
  suffix?: string
}

export function KPICard({
  label,
  value,
  delta,
  icon: Icon,
  iconColor = 'text-brand-600',
  iconBg = 'bg-brand-50 dark:bg-brand-900/20',
  prefix = '',
  suffix = '',
}: KPICardProps) {
  const hasDelta = delta !== undefined
  const isPositive = (delta ?? 0) > 0
  const isNegative = (delta ?? 0) < 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
        </div>
        <div className={clsx('p-2.5 rounded-lg', iconBg)}>
          <Icon className={clsx('w-5 h-5', iconColor)} />
        </div>
      </div>

      {hasDelta && (
        <div className="mt-3 flex items-center gap-1.5">
          {isPositive && <TrendingUp className="w-4 h-4 text-green-500" />}
          {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
          {!isPositive && !isNegative && <Minus className="w-4 h-4 text-gray-400" />}
          <span
            className={clsx(
              'text-xs font-medium',
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-400'
            )}
          >
            {isPositive ? '+' : ''}
            {delta} from last week
          </span>
        </div>
      )}
    </div>
  )
}
