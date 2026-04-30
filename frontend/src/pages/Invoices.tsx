import { useState } from 'react'
import {
  Plus, FileText, DollarSign, TrendingUp, AlertCircle,
  Search, Filter, Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useInvoices, useInvoiceStats, type Invoice } from '../hooks/useInvoices'
import { InvoiceForm } from '../components/invoices/InvoiceForm'
import { InvoiceDetail } from '../components/invoices/InvoiceDetail'

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled'] as const
type StatusFilter = typeof STATUS_OPTIONS[number]

const STATUS_COLORS: Record<Invoice['status'], string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partial:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

function fmt(n: number, currency = 'USD') {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Invoices() {
  const { data: invoices = [], isLoading } = useInvoices()
  const { data: stats } = useInvoiceStats()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.client_name.toLowerCase().includes(q) ||
        (inv.client_company ?? '').toLowerCase().includes(q) ||
        (inv.client_email ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const statCards = [
    {
      label: 'Total Invoiced',
      value: stats ? fmt(stats.total_invoiced) : '—',
      icon: FileText,
      color: 'text-brand-600',
      bg: 'bg-brand-50 dark:bg-brand-900/20',
    },
    {
      label: 'Total Collected',
      value: stats ? fmt(stats.total_paid) : '—',
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Outstanding',
      value: stats ? fmt(stats.total_outstanding) : '—',
      icon: TrendingUp,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      label: 'Overdue',
      value: stats ? String(stats.overdue) : '—',
      sub: stats?.overdue === 1 ? 'invoice' : 'invoices',
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Create, send, and track client payments
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
              <Icon className={clsx('w-5 h-5', color)} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={clsx('text-xl font-bold mt-0.5', color)}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && stats?.by_status[s] != null && (
                <span className="ml-1.5 opacity-70">({stats.by_status[s]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {search || statusFilter !== 'all' ? 'No invoices match your filter.' : 'No invoices yet. Create your first one!'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-semibold">Invoice</th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Due Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedId(inv.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[160px]">
                        {inv.client_name}
                      </p>
                      {inv.client_company && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{inv.client_company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className={clsx(
                        'text-xs',
                        inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-500 dark:text-gray-400'
                      )}>
                        {fmtDate(inv.due_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[inv.status]
                      )}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {fmt(inv.total, inv.currency)}
                      </span>
                      {inv.amount_paid > 0 && inv.amount_paid < inv.total && (
                        <p className="text-xs text-gray-400">
                          paid {fmt(inv.amount_paid, inv.currency)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <InvoiceForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {selectedId != null && (
        <InvoiceDetail
          invoiceId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
