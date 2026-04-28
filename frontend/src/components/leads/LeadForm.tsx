import { useState } from 'react'
import { X, Loader2, Plus, Tag } from 'lucide-react'
import { clsx } from 'clsx'
import { useCreateLead, useUpdateLead } from '../../hooks/useLeads'
import type { Lead, LeadStatus, LeadSource, LeadPriority } from '../../types'

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'website_form',   label: 'Website Form' },
  { value: 'whatsapp',       label: 'WhatsApp' },
  { value: 'referral',       label: 'Referral' },
  { value: 'linkedin',       label: 'LinkedIn' },
  { value: 'instagram',      label: 'Instagram' },
  { value: 'facebook',       label: 'Facebook' },
  { value: 'social_media',   label: 'Social Media' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'cold_outreach',  label: 'Cold Outreach' },
  { value: 'web_scrape',     label: 'Web Scrape' },
  { value: 'manual',         label: 'Manual Entry' },
]

const PRIORITIES: { value: LeadPriority; label: string }[] = [
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low',    label: '⚪ Low' },
]

const INDUSTRIES = [
  'E-commerce', 'Real Estate', 'Healthcare', 'Education', 'Finance',
  'Technology', 'Hospitality', 'Retail', 'Manufacturing', 'Professional Services',
  'Non-profit', 'Media & Entertainment', 'Construction', 'Automotive', 'Other',
]

interface LeadFormProps {
  lead?: Lead
  defaultStatus?: LeadStatus
  onClose: () => void
  onSuccess?: (lead: Lead) => void
}

export function LeadForm({ lead, defaultStatus, onClose, onSuccess }: LeadFormProps) {
  const isEdit = Boolean(lead)
  const tags: string[] = lead?.tags ? JSON.parse(lead.tags) : []

  const [form, setForm] = useState({
    name:         lead?.name ?? '',
    company:      lead?.company ?? '',
    email:        lead?.email ?? '',
    phone:        lead?.phone ?? '',
    whatsapp:     lead?.whatsapp ?? '',
    website:      lead?.website ?? '',
    industry:     lead?.industry ?? '',
    location:     lead?.location ?? '',
    source:       (lead?.source ?? 'manual') as LeadSource,
    priority:     (lead?.priority ?? 'medium') as LeadPriority,
    deal_value:   lead?.deal_value ?? 0,
    notes:        lead?.notes ?? '',
  })
  const [tagInput, setTagInput] = useState('')
  const [localTags, setLocalTags] = useState<string[]>(tags)
  const [error, setError] = useState('')

  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const isPending = createLead.isPending || updateLead.isPending

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !localTags.includes(t)) {
      setLocalTags([...localTags, t])
    }
    setTagInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }

    const payload = {
      ...form,
      deal_value: Number(form.deal_value),
      tags: localTags,
    }

    try {
      let result: Lead
      if (isEdit && lead) {
        result = await updateLead.mutateAsync({ id: lead.id, ...payload })
      } else {
        result = await createLead.mutateAsync(payload)
      }
      onSuccess?.(result)
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400'
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
            {isEdit ? `Edit Lead — ${lead!.name}` : 'Add New Lead'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Row 1: Name + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="John Smith" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Company</label>
              <input value={form.company} onChange={(e) => set('company', e.target.value)}
                placeholder="Acme Corp" className={inputCls} />
            </div>
          </div>

          {/* Row 2: Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="john@acme.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="+1 555 000 0000" className={inputCls} />
            </div>
          </div>

          {/* Row 3: WhatsApp + Website */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="+1 555 000 0000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input value={form.website} onChange={(e) => set('website', e.target.value)}
                placeholder="https://acme.com" className={inputCls} />
            </div>
          </div>

          {/* Row 4: Industry + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Industry</label>
              <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className={inputCls}>
                <option value="">Select industry…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)}
                placeholder="New York, USA" className={inputCls} />
            </div>
          </div>

          {/* Row 5: Source + Priority + Deal Value */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value as LeadSource)} className={inputCls}>
                {SOURCES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value as LeadPriority)} className={inputCls}>
                {PRIORITIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Deal Value ($)</label>
              <input type="number" min="0" value={form.deal_value}
                onChange={(e) => set('deal_value', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {localTags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
                  <Tag className="w-2.5 h-2.5" />{tag}
                  <button type="button" onClick={() => setLocalTags(localTags.filter((t) => t !== tag))}
                    className="ml-0.5 text-brand-400 hover:text-brand-700">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag…" className={clsx(inputCls, 'flex-1')} />
              <button type="button" onClick={addTag}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={3} placeholder="Any relevant context about this lead…"
              className={clsx(inputCls, 'resize-none')} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit as never} disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white rounded-lg transition-colors">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Lead & Score'}
          </button>
        </div>
      </div>
    </div>
  )
}
