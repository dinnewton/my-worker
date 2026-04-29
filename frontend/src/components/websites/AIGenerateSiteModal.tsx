import { useState } from 'react'
import { X, Zap, Loader2, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useAIGenerateSite } from '../../hooks/useWebsites'
import type { WebsiteTemplate, AIGenerateSiteRequest, Website } from '../../types'

const TEMPLATES: { value: WebsiteTemplate; label: string; emoji: string; desc: string; defaultPages: string[] }[] = [
  { value: 'business',     label: 'Business',     emoji: '🏢', desc: 'Professional company site',       defaultPages: ['Home', 'About', 'Services', 'Portfolio', 'Contact'] },
  { value: 'portfolio',    label: 'Portfolio',    emoji: '🎨', desc: 'Showcase your work',              defaultPages: ['Home', 'Work', 'About', 'Contact'] },
  { value: 'landing_page', label: 'Landing Page', emoji: '🚀', desc: 'Single-page conversion focused',  defaultPages: ['Home'] },
  { value: 'ecommerce',    label: 'E-Commerce',   emoji: '🛒', desc: 'Online store & products',         defaultPages: ['Home', 'Shop', 'About', 'FAQ', 'Contact'] },
  { value: 'blog',         label: 'Blog',         emoji: '✍️', desc: 'Content & articles',              defaultPages: ['Home', 'Blog', 'About', 'Contact'] },
  { value: 'restaurant',   label: 'Restaurant',   emoji: '🍽️', desc: 'Food, menu & reservations',      defaultPages: ['Home', 'Menu', 'About', 'Reservations', 'Contact'] },
  { value: 'agency',       label: 'Agency',       emoji: '📣', desc: 'Marketing or creative agency',    defaultPages: ['Home', 'Services', 'Work', 'Team', 'Blog', 'Contact'] },
  { value: 'saas',         label: 'SaaS',         emoji: '⚡', desc: 'Software product site',           defaultPages: ['Home', 'Features', 'Pricing', 'Blog', 'Contact'] },
]

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Real Estate', 'Retail',
  'Restaurant & Food', 'Creative & Design', 'Consulting', 'Law', 'Construction',
  'Fitness & Wellness', 'Beauty & Fashion', 'Travel & Hospitality', 'Non-profit', 'Other',
]

interface Props {
  onClose: () => void
  onSuccess: (site: Website) => void
}

export function AIGenerateSiteModal({ onClose, onSuccess }: Props) {
  const generate = useAIGenerateSite()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [template, setTemplate] = useState<WebsiteTemplate>('business')
  const [pages, setPages] = useState(TEMPLATES[0].defaultPages)
  const [newPage, setNewPage] = useState('')
  const [colors, setColors] = useState(['#6366f1', '#818cf8'])
  const [services, setServices] = useState<string[]>([])
  const [newService, setNewService] = useState('')

  const [form, setForm] = useState({
    client_name: '', client_email: '', business_name: '',
    industry: '', description: '', target_audience: '',
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleTemplateSelect = (t: typeof TEMPLATES[0]) => {
    setTemplate(t.value)
    setPages(t.defaultPages)
  }

  const handleGenerate = async () => {
    const req: AIGenerateSiteRequest = {
      client_name: form.client_name,
      client_email: form.client_email || undefined,
      business_name: form.business_name,
      industry: form.industry,
      description: form.description,
      template,
      target_audience: form.target_audience || undefined,
      key_services: services,
      brand_colors: colors,
      pages,
    }
    const result = await generate.mutateAsync(req)
    onSuccess(result)
    onClose()
  }

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
              <Zap className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">AI Generate Website</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex px-6 pt-4 gap-1">
          {['Template', 'Business Info', 'Pages & Brand'].map((label, i) => (
            <div key={i} className={clsx(
              'flex items-center gap-1.5 text-xs font-medium',
              step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-brand-600' : 'text-gray-400',
            )}>
              <span className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500',
              )}>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
              {i < 2 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1 — Template */}
          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATES.map((t) => (
                <button key={t.value} onClick={() => handleTemplateSelect(t)}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    template === t.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300',
                  )}>
                  <span className="text-2xl block mb-1">{t.emoji}</span>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Business Info */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Client Name *</label>
                  <input value={form.client_name} onChange={(e) => set('client_name', e.target.value)} placeholder="Jane Smith" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Client Email</label>
                  <input type="email" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} placeholder="jane@acme.com" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Business Name *</label>
                  <input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="Acme Corp" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Industry *</label>
                  <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className={inp}>
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Business Description *</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                  rows={3} placeholder="What does the business do? What makes it unique?"
                  className={clsx(inp, 'resize-none')} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Audience</label>
                <input value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)}
                  placeholder="e.g. Small business owners in Nairobi aged 30-50" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Key Services</label>
                <div className="space-y-2 mb-2">
                  {services.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800 rounded-lg px-3 py-1.5">
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{s}</span>
                      <button onClick={() => setServices(services.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newService} onChange={(e) => setNewService(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newService.trim()) { setServices([...services, newService.trim()]); setNewService('') } }}
                    placeholder="Add service…" className={clsx(inp, 'flex-1')} />
                  <button onClick={() => { if (newService.trim()) { setServices([...services, newService.trim()]); setNewService('') } }}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Pages & Brand */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pages to Generate</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {pages.map((p, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700 text-xs px-3 py-1.5 rounded-full">
                      {p}
                      <button onClick={() => setPages(pages.filter((_, j) => j !== i))} className="text-brand-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newPage} onChange={(e) => setNewPage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newPage.trim()) { setPages([...pages, newPage.trim()]); setNewPage('') } }}
                    placeholder="Add page…" className={clsx(inp, 'flex-1')} />
                  <button onClick={() => { if (newPage.trim()) { setPages([...pages, newPage.trim()]); setNewPage('') } }}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Brand Colors</label>
                <div className="flex gap-3 flex-wrap">
                  {colors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="color" value={c} onChange={(e) => setColors(colors.map((col, j) => j === i ? e.target.value : col))}
                        className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer" />
                      <span className="text-xs text-gray-500 font-mono">{c}</span>
                    </div>
                  ))}
                  {colors.length < 3 && (
                    <button onClick={() => setColors([...colors, '#10b981'])}
                      className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-brand-400">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">⚡ AI will generate complete copy for all {pages.length} pages with {pages.reduce((a) => a + 4, 0)}+ sections</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">This may take 30–60 seconds depending on the number of pages</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="px-5 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              ← Back
            </button>
          )}
          {step === 1 && (
            <button onClick={onClose}
              className="px-5 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 2 && (!form.client_name.trim() || !form.business_name.trim() || !form.industry || !form.description.trim())}
              className="flex-1 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
              Next →
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={generate.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
              {generate.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Website…</>
                : <><Zap className="w-4 h-4" /> Generate Full Website</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
