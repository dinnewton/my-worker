import { useState } from 'react'
import { X, Zap, Loader2, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAIGenerateProposal } from '../../hooks/useProposals'
import type { AIGenerateProposalRequest, ProposalTemplate, Proposal } from '../../types'

const TEMPLATES: { value: ProposalTemplate; label: string; emoji: string; services: string[] }[] = [
  {
    value: 'digital_marketing', label: 'Digital Marketing', emoji: '📣',
    services: ['Social Media Management', 'PPC Advertising', 'Email Marketing', 'Analytics & Reporting'],
  },
  {
    value: 'web_development', label: 'Web Development', emoji: '💻',
    services: ['Custom Website Design', 'Frontend Development', 'Backend Development', 'CMS Integration', 'Hosting & Maintenance'],
  },
  {
    value: 'seo', label: 'SEO', emoji: '🔍',
    services: ['Technical SEO Audit', 'On-Page Optimization', 'Link Building', 'Content Strategy', 'Monthly Reporting'],
  },
  {
    value: 'social_media', label: 'Social Media', emoji: '📱',
    services: ['Content Creation', 'Community Management', 'Paid Social Ads', 'Influencer Outreach', 'Analytics'],
  },
  {
    value: 'email_marketing', label: 'Email Marketing', emoji: '✉️',
    services: ['Email Strategy', 'Template Design', 'List Management', 'Automation Flows', 'A/B Testing'],
  },
  {
    value: 'content_creation', label: 'Content Creation', emoji: '✍️',
    services: ['Blog Writing', 'Video Scripts', 'Graphic Design', 'Copywriting', 'Brand Voice Guidelines'],
  },
  {
    value: 'full_service', label: 'Full Service', emoji: '🚀',
    services: ['Strategy & Consulting', 'Web Development', 'Social Media', 'SEO', 'Paid Advertising', 'Content Creation'],
  },
  {
    value: 'custom', label: 'Custom', emoji: '⚙️',
    services: [],
  },
]

interface AIGenerateModalProps {
  leadId?: number
  onClose: () => void
  onSuccess: (proposal: Proposal) => void
}

export function AIGenerateModal({ leadId, onClose, onSuccess }: AIGenerateModalProps) {
  const generate = useAIGenerateProposal()

  const [step, setStep] = useState<1 | 2>(1)
  const [template, setTemplate] = useState<ProposalTemplate>('digital_marketing')
  const [form, setForm] = useState({
    client_name: '',
    client_company: '',
    client_email: '',
    budget: '',
    timeline_weeks: '4',
    notes: '',
  })
  const [services, setServices] = useState<string[]>(TEMPLATES[0].services)
  const [newService, setNewService] = useState('')

  const selectedTemplate = TEMPLATES.find((t) => t.value === template) ?? TEMPLATES[0]

  const handleTemplateSelect = (t: typeof TEMPLATES[0]) => {
    setTemplate(t.value)
    if (t.services.length > 0) setServices(t.services)
  }

  const handleGenerate = async () => {
    if (!form.client_name.trim()) return
    const req: AIGenerateProposalRequest = {
      lead_id: leadId,
      client_name: form.client_name,
      client_company: form.client_company || undefined,
      client_email: form.client_email || undefined,
      template_type: template,
      services,
      budget: Number(form.budget) || 0,
      timeline_weeks: Number(form.timeline_weeks) || 4,
      notes: form.notes || undefined,
    }
    const result = await generate.mutateAsync(req)
    onSuccess(result)
    onClose()
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
              <Zap className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">AI Generate Proposal</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map((s) => (
            <div key={s} className={clsx(
              'flex items-center gap-1.5 text-xs font-medium',
              step >= s ? 'text-brand-600' : 'text-gray-400',
            )}>
              <span className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500',
              )}>{s}</span>
              {s === 1 ? 'Template & Client' : 'Services & Budget'}
              {s < 2 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-5">
              {/* Template Grid */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Proposal Type</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.value} onClick={() => handleTemplateSelect(t)}
                      className={clsx(
                        'p-3 rounded-xl border-2 text-left transition-all',
                        template === t.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300',
                      )}>
                      <span className="text-xl block mb-1">{t.emoji}</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Info */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Client Name *</label>
                    <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      placeholder="Jane Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Company</label>
                    <input value={form.client_company} onChange={(e) => setForm({ ...form, client_company: e.target.value })}
                      placeholder="Acme Corp" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      placeholder="jane@acme.com" className={inputCls} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* Services */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Services to Include</p>
                <div className="space-y-2 mb-3">
                  {services.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800 rounded-lg px-3 py-2">
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{s}</span>
                      <button onClick={() => setServices(services.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newService} onChange={(e) => setNewService(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newService.trim()) { setServices([...services, newService.trim()]); setNewService('') } }}
                    placeholder="Add custom service…" className={clsx(inputCls, 'flex-1')} />
                  <button onClick={() => { if (newService.trim()) { setServices([...services, newService.trim()]); setNewService('') } }}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Budget & Timeline */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Budget ($)</label>
                  <input type="number" min="0" value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="5000" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Timeline (weeks)</label>
                  <select value={form.timeline_weeks} onChange={(e) => setForm({ ...form, timeline_weeks: e.target.value })}
                    className={inputCls}>
                    {[2, 4, 6, 8, 12, 16, 24].map((w) => (
                      <option key={w} value={w}>{w} weeks</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Additional context for AI</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3} placeholder="Specific requirements, goals, pain points…"
                  className={clsx(inputCls, 'resize-none')} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          {step === 1 ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={() => setStep(2)} disabled={!form.client_name.trim()}
                className="flex-1 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                Next →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)}
                className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                ← Back
              </button>
              <button onClick={handleGenerate} disabled={generate.isPending || services.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {generate.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Zap className="w-4 h-4" /> Generate Proposal</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
