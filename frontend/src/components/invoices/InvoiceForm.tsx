import { useState } from 'react'
import { Plus, Trash2, Loader2, X, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { useCreateInvoice, type LineItem } from '../../hooks/useInvoices'

const CURRENCIES = ['USD', 'KES', 'EUR', 'GBP', 'AUD', 'CAD', 'ZAR', 'NGN']

const TEMPLATES: { label: string; items: Omit<LineItem, 'amount'>[] }[] = [
  {
    label: 'Web Development',
    items: [
      { description: 'Website Design & UX', quantity: 1, unit_price: 1500 },
      { description: 'Frontend Development', quantity: 1, unit_price: 2000 },
      { description: 'Backend & Database', quantity: 1, unit_price: 1500 },
      { description: 'SEO Setup & Optimization', quantity: 1, unit_price: 500 },
    ],
  },
  {
    label: 'Social Media Management',
    items: [
      { description: 'Social Media Strategy', quantity: 1, unit_price: 800 },
      { description: 'Content Creation (16 posts)', quantity: 1, unit_price: 1200 },
      { description: 'Community Management', quantity: 1, unit_price: 600 },
      { description: 'Monthly Analytics Report', quantity: 1, unit_price: 300 },
    ],
  },
  {
    label: 'SEO Package',
    items: [
      { description: 'Technical SEO Audit', quantity: 1, unit_price: 500 },
      { description: 'Keyword Research & Strategy', quantity: 1, unit_price: 400 },
      { description: 'On-page Optimization (10 pages)', quantity: 10, unit_price: 80 },
      { description: 'Monthly Link Building', quantity: 1, unit_price: 800 },
    ],
  },
  {
    label: 'Full Digital Package',
    items: [
      { description: 'Website Development', quantity: 1, unit_price: 4000 },
      { description: 'SEO & Content Marketing', quantity: 1, unit_price: 1200 },
      { description: 'Social Media Management', quantity: 1, unit_price: 1500 },
      { description: 'Email Marketing Setup', quantity: 1, unit_price: 800 },
      { description: 'Monthly Reporting', quantity: 1, unit_price: 300 },
    ],
  },
]

interface Props {
  proposalId?: number
  proposalClient?: { name: string; email?: string; company?: string }
  onClose: () => void
  onSuccess: () => void
}

export function InvoiceForm({ proposalId, proposalClient, onClose, onSuccess }: Props) {
  const create = useCreateInvoice()

  const [client, setClient] = useState({
    client_name: proposalClient?.name ?? '',
    client_email: proposalClient?.email ?? '',
    client_phone: '',
    client_company: proposalClient?.company ?? '',
    client_address: '',
  })
  const [items, setItems] = useState<Omit<LineItem, 'amount'>[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ])
  const [currency, setCurrency] = useState('USD')
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxAmt   = subtotal * taxRate / 100
  const total    = subtotal + taxAmt - discount

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof Omit<LineItem, 'amount'>, val: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  function applyTemplate(tpl: typeof TEMPLATES[0]) {
    setItems(tpl.items)
  }

  async function handleSubmit() {
    await create.mutateAsync({
      ...client,
      items,
      currency,
      tax_rate: taxRate,
      discount_amount: discount,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      notes: notes || undefined,
      proposal_id: proposalId,
    })
    onSuccess()
  }

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">New Invoice</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Quick Templates */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Quick Templates</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map(tpl => (
                <button key={tpl.label} onClick={() => applyTemplate(tpl)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-700 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client Info */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-400 mb-1">Client Name *</label>
                <input value={client.client_name} onChange={e => setClient(c => ({ ...c, client_name: e.target.value }))}
                  placeholder="Jane Doe" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Company</label>
                <input value={client.client_company} onChange={e => setClient(c => ({ ...c, client_company: e.target.value }))}
                  placeholder="Acme Ltd" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" value={client.client_email} onChange={e => setClient(c => ({ ...c, client_email: e.target.value }))}
                  placeholder="jane@example.com" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone (for M-Pesa)</label>
                <input value={client.client_phone} onChange={e => setClient(c => ({ ...c, client_phone: e.target.value }))}
                  placeholder="+254712345678" className={inp} />
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tax Rate (%)</label>
              <input type="number" min="0" max="100" value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value))} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Line Items</p>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-12 gap-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-700 items-center">
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Service description…"
                    className="col-span-6 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    className="col-span-2 px-2 py-1.5 text-sm text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  <input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                    className="col-span-2 px-2 py-1.5 text-sm text-right rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {(item.quantity * item.unit_price).toLocaleString()}
                    </span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 ml-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({taxRate}%)</span>
                  <span>{currency} {taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>- {currency} {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-600">
                <span>Total Due</span>
                <span className="text-brand-600">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Discount input */}
            <div className="flex items-center gap-3 mt-3">
              <label className="text-xs text-gray-400 whitespace-nowrap">Discount ({currency})</label>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                className="w-32 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Payment instructions, bank details, or any additional information…"
              className={clsx(inp, 'resize-none')} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleSubmit}
            disabled={create.isPending || !client.client_name || items.every(i => !i.description)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Invoice
          </button>
        </div>
      </div>
    </div>
  )
}
