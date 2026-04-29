import { useState } from 'react'
import {
  X, Download, Mail, CreditCard, Smartphone, CheckCircle,
  Loader2, ExternalLink, Copy, Check, Clock, AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useInvoice, useMarkInvoicePaid, useSendInvoiceEmail,
  useStripeCheckout, useMpesaPayment, useDownloadInvoicePDF,
  type Invoice,
} from '../../hooks/useInvoices'

const STATUS_COLORS: Record<Invoice['status'], string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partial:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

const STATUS_ICONS: Record<Invoice['status'], typeof CheckCircle> = {
  draft:     Clock,
  sent:      Mail,
  viewed:    ExternalLink,
  paid:      CheckCircle,
  partial:   AlertCircle,
  overdue:   AlertCircle,
  cancelled: X,
}

interface Props {
  invoiceId: number
  onClose: () => void
}

export function InvoiceDetail({ invoiceId, onClose }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const markPaid = useMarkInvoicePaid()
  const sendEmail = useSendInvoiceEmail()
  const stripeCheckout = useStripeCheckout()
  const mpesaPayment = useMpesaPayment()
  const downloadPDF = useDownloadInvoicePDF()

  const [mpesaPhone, setMpesaPhone] = useState('')
  const [showMpesa, setShowMpesa] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleStripe() {
    if (!invoice) return
    if (invoice.stripe_payment_url) {
      window.open(invoice.stripe_payment_url, '_blank')
    } else {
      await stripeCheckout.mutateAsync(invoice.id)
    }
  }

  async function handleMpesa() {
    if (!invoice || !mpesaPhone.trim()) return
    await mpesaPayment.mutateAsync({ id: invoice.id, phone: mpesaPhone.trim() })
    setShowMpesa(false)
    setMpesaPhone('')
  }

  async function handleEmail() {
    if (!invoice) return
    await sendEmail.mutateAsync(invoice.id)
    setEmailSent(true)
    setTimeout(() => setEmailSent(false), 3000)
  }

  function copyShareLink() {
    if (!invoice) return
    const url = `${window.location.origin}/invoice/${invoice.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(s: string | null) {
    if (!s) return '—'
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (isLoading || !invoice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  const items: { description: string; quantity: number; unit_price: number; amount: number }[] =
    (() => { try { return JSON.parse(invoice.items) } catch { return [] } })()

  const isPaid = invoice.status === 'paid'
  const StatusIcon = STATUS_ICONS[invoice.status]
  const isOverdue = invoice.status === 'overdue'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 w-full sm:rounded-2xl sm:max-w-2xl max-h-[95vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">{invoice.invoice_number}</h2>
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[invoice.status])}>
                <StatusIcon className="w-3 h-3" />
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {invoice.client_name}{invoice.client_company ? ` · ${invoice.client_company}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Amount + Due */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4">
              <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mb-1">Total Due</p>
              <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">
                {invoice.currency} {invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              {invoice.amount_paid > 0 && (
                <p className="text-xs text-brand-500 mt-1">
                  Paid: {invoice.currency} {invoice.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
              <div>
                <p className="text-xs text-gray-400">Due Date</p>
                <p className={clsx('text-sm font-medium', isOverdue ? 'text-red-600' : 'text-gray-700 dark:text-gray-200')}>
                  {formatDate(invoice.due_date)}
                </p>
              </div>
              {invoice.sent_at && (
                <div>
                  <p className="text-xs text-gray-400">Sent</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{formatDate(invoice.sent_at)}</p>
                </div>
              )}
              {invoice.paid_at && (
                <div>
                  <p className="text-xs text-gray-400">Paid</p>
                  <p className="text-sm text-green-600 font-medium">{formatDate(invoice.paid_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Client Info */}
          {(invoice.client_email || invoice.client_phone) && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              {invoice.client_email && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="text-gray-700 dark:text-gray-200 truncate">{invoice.client_email}</p>
                </div>
              )}
              {invoice.client_phone && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                  <p className="text-gray-700 dark:text-gray-200">{invoice.client_phone}</p>
                </div>
              )}
            </div>
          )}

          {/* M-Pesa receipt */}
          {invoice.mpesa_receipt && (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">M-Pesa Payment Received</p>
                <p className="text-sm text-green-700 dark:text-green-300">Receipt: {invoice.mpesa_receipt}</p>
              </div>
            </div>
          )}

          {/* Line Items */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line Items</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700/50 px-4 py-2">
                  <span className="col-span-6">Description</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Unit</span>
                  <span className="col-span-2 text-right">Amount</span>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 text-sm">
                    <span className="col-span-6 text-gray-700 dark:text-gray-200">{item.description}</span>
                    <span className="col-span-2 text-center text-gray-500">{item.quantity}</span>
                    <span className="col-span-2 text-right text-gray-500">
                      {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="col-span-2 text-right font-medium text-gray-700 dark:text-gray-200">
                      {(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{invoice.currency} {invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span>{invoice.currency} {invoice.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Discount</span>
                    <span>- {invoice.currency} {invoice.discount_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1.5 border-t border-gray-200 dark:border-gray-600">
                  <span>Total</span>
                  <span className="text-brand-600">{invoice.currency} {invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* M-Pesa STK push form */}
          {showMpesa && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">M-Pesa STK Push</p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Enter the customer's Safaricom phone number. They'll receive a payment prompt on their phone.
              </p>
              <div className="flex gap-2">
                <input
                  value={mpesaPhone}
                  onChange={e => setMpesaPhone(e.target.value)}
                  placeholder="+254712345678"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleMpesa}
                  disabled={mpesaPayment.isPending || !mpesaPhone.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60">
                  {mpesaPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  Send
                </button>
                <button onClick={() => setShowMpesa(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          {/* Payment buttons — hide if paid */}
          {!isPaid && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleStripe}
                disabled={stripeCheckout.isPending}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-60">
                {stripeCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Pay with Card
              </button>
              <button
                onClick={() => setShowMpesa(v => !v)}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl">
                <Smartphone className="w-4 h-4" />
                M-Pesa STK Push
              </button>
            </div>
          )}

          {/* Secondary actions */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => downloadPDF.mutate({ id: invoice.id, number: invoice.invoice_number })}
              disabled={downloadPDF.isPending}
              className="flex flex-col items-center gap-1 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              {downloadPDF.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
            <button
              onClick={handleEmail}
              disabled={sendEmail.isPending}
              className="flex flex-col items-center gap-1 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              {sendEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : emailSent ? <Check className="w-4 h-4 text-green-500" /> : <Mail className="w-4 h-4" />}
              {emailSent ? 'Sent!' : 'Email'}
            </button>
            <button
              onClick={copyShareLink}
              className="flex flex-col items-center gap-1 py-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            {!isPaid && (
              <button
                onClick={() => markPaid.mutate(invoice.id)}
                disabled={markPaid.isPending}
                className="flex flex-col items-center gap-1 py-2.5 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors">
                {markPaid.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Mark Paid
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
