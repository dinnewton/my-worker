import { useState } from 'react'
import {
  Plus, Zap, DollarSign, FileText, Send, Eye,
  CheckCircle, XCircle, TrendingUp, Loader2, Search,
  Receipt, CreditCard, AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useProposals, useProposalStats } from '../hooks/useProposals'
import { useInvoices, useInvoiceStats } from '../hooks/useInvoices'
import { ProposalCard } from '../components/proposals/ProposalCard'
import { ProposalDetail } from '../components/proposals/ProposalDetail'
import { AIGenerateModal } from '../components/proposals/AIGenerateModal'
import { InvoiceForm } from '../components/invoices/InvoiceForm'
import { InvoiceDetail } from '../components/invoices/InvoiceDetail'
import type { ProposalStatus, Proposal } from '../types'
import type { Invoice } from '../hooks/useInvoices'

const STATUS_TABS: { value: ProposalStatus | 'all'; label: string; icon: typeof FileText }[] = [
  { value: 'all',      label: 'All',      icon: FileText },
  { value: 'draft',    label: 'Drafts',   icon: FileText },
  { value: 'sent',     label: 'Sent',     icon: Send },
  { value: 'viewed',   label: 'Viewed',   icon: Eye },
  { value: 'accepted', label: 'Accepted', icon: CheckCircle },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
]

const INVOICE_STATUS_COLORS: Record<Invoice['status'], string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partial:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

function StatCard({
  label, value, icon: Icon, color, bg,
}: { label: string; value: string | number; icon: typeof FileText; color: string; bg: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4">
      <div className={clsx('p-2.5 rounded-xl', bg)}>
        <Icon className={clsx('w-5 h-5', color)} />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={clsx('text-xl font-bold', color)}>{value}</p>
      </div>
    </div>
  )
}

function InvoiceRow({ invoice, onClick }: { invoice: Invoice; onClick: () => void }) {
  const isOverdue = invoice.status === 'overdue'
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md transition-all text-left">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
          <Receipt className="w-5 h-5 text-brand-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{invoice.invoice_number}</p>
            <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', INVOICE_STATUS_COLORS[invoice.status])}>
              {invoice.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {invoice.client_name}{invoice.client_company ? ` · ${invoice.client_company}` : ''}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className={clsx('font-bold text-sm', isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-white')}>
          {invoice.currency} {invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        {invoice.due_date && (
          <p className={clsx('text-xs mt-0.5', isOverdue ? 'text-red-500' : 'text-gray-400')}>
            {isOverdue ? 'Overdue · ' : 'Due '}
            {new Date(invoice.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
    </button>
  )
}

export function Proposals() {
  const [activeTab, setActiveTab] = useState<'proposals' | 'invoices'>('proposals')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')

  const { data: proposals = [], isLoading } = useProposals(statusFilter !== 'all' ? statusFilter : undefined)
  const { data: proposalStats } = useProposalStats()
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices()
  const { data: invoiceStats } = useInvoiceStats()

  const filteredProposals = proposals.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q)
      || p.client_name.toLowerCase().includes(q)
      || (p.client_company?.toLowerCase().includes(q) ?? false)
  })

  const filteredInvoices = invoices.filter(inv => {
    if (!invoiceSearch) return true
    const q = invoiceSearch.toLowerCase()
    return inv.invoice_number.toLowerCase().includes(q)
      || inv.client_name.toLowerCase().includes(q)
      || (inv.client_company?.toLowerCase().includes(q) ?? false)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proposals & Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-generated proposals, e-signatures, and payment collection
          </p>
        </div>
        {activeTab === 'proposals' ? (
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
            <Zap className="w-4 h-4" /> AI Generate
          </button>
        ) : (
          <button
            onClick={() => setShowInvoiceForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      {/* Main Tab Strip */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('proposals')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'proposals'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}>
          <FileText className="w-4 h-4" />
          Proposals
          {proposalStats && (
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">
              {proposalStats.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'invoices'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}>
          <Receipt className="w-4 h-4" />
          Invoices
          {invoiceStats && (
            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">
              {invoiceStats.total}
            </span>
          )}
        </button>
      </div>

      {/* ── PROPOSALS TAB ── */}
      {activeTab === 'proposals' && (
        <>
          {proposalStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Proposals" value={proposalStats.total}
                icon={FileText} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
              <StatCard label="Pipeline Value" value={`$${(proposalStats.total_pipeline_value / 1000).toFixed(1)}k`}
                icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
              <StatCard label="Won Value" value={`$${(proposalStats.won_value / 1000).toFixed(1)}k`}
                icon={CheckCircle} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" />
              <StatCard label="Win Rate" value={`${proposalStats.win_rate}%`}
                icon={TrendingUp} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search proposals…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex-wrap">
              {STATUS_TABS.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setStatusFilter(value)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    statusFilter === value
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {proposalStats && value !== 'all' && (
                    <span className="text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">
                      {proposalStats.by_status?.[value] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-brand-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No proposals yet</p>
              <p className="text-sm text-gray-400 mt-1">Click "AI Generate" to create your first proposal in seconds</p>
              <button onClick={() => setShowGenerate(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
                <Zap className="w-4 h-4" /> Generate First Proposal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onClick={() => setSelectedId(proposal.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── INVOICES TAB ── */}
      {activeTab === 'invoices' && (
        <>
          {invoiceStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Invoiced" value={`$${(invoiceStats.total_invoiced / 1000).toFixed(1)}k`}
                icon={Receipt} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
              <StatCard label="Total Paid" value={`$${(invoiceStats.total_paid / 1000).toFixed(1)}k`}
                icon={CheckCircle} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" />
              <StatCard label="Outstanding" value={`$${(invoiceStats.total_outstanding / 1000).toFixed(1)}k`}
                icon={CreditCard} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/20" />
              <StatCard label="Overdue" value={invoiceStats.overdue}
                icon={AlertCircle} color="text-red-600" bg="bg-red-50 dark:bg-red-900/20" />
            </div>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
              placeholder="Search invoices…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {invoicesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-brand-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No invoices yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first invoice to start collecting payments</p>
              <button onClick={() => setShowInvoiceForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
                <Plus className="w-4 h-4" /> Create First Invoice
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map(inv => (
                <InvoiceRow key={inv.id} invoice={inv} onClick={() => setSelectedInvoiceId(inv.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {selectedId && (
        <ProposalDetail proposalId={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {showGenerate && (
        <AIGenerateModal
          onClose={() => setShowGenerate(false)}
          onSuccess={(proposal: Proposal) => setSelectedId(proposal.id)}
        />
      )}
      {showInvoiceForm && (
        <InvoiceForm
          onClose={() => setShowInvoiceForm(false)}
          onSuccess={() => setShowInvoiceForm(false)}
        />
      )}
      {selectedInvoiceId && (
        <InvoiceDetail invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
      )}
    </div>
  )
}
