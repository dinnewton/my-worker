import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Mail, Zap, Plus, Send, Eye, Trash2, Loader2, BarChart2, Users, MousePointer, TrendingUp, X } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const BASE = '/api/v1/email'

type CampaignType = 'newsletter' | 'promotional' | 'welcome' | 'follow_up' | 're_engagement' | 'announcement' | 'drip'
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'archived'

interface Campaign {
  id: number; name: string; subject: string; preview_text: string | null
  campaign_type: CampaignType; status: CampaignStatus
  html_content: string | null; plain_text: string | null; ai_generated: boolean
  segment: string | null; recipient_count: number
  sent_count: number; open_count: number; click_count: number
  open_rate: number; click_rate: number
  scheduled_at: string | null; sent_at: string | null
  created_at: string; updated_at: string
}

const STATUS_CFG: Record<CampaignStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'text-gray-600 bg-gray-100 dark:bg-gray-700' },
  scheduled: { label: 'Scheduled', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  sending:   { label: 'Sending',   color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  sent:      { label: 'Sent',      color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  paused:    { label: 'Paused',    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  archived:  { label: 'Archived',  color: 'text-gray-400 bg-gray-50 dark:bg-gray-800' },
}

const TYPE_LABELS: Record<CampaignType, string> = {
  newsletter: 'Newsletter', promotional: 'Promotional', welcome: 'Welcome',
  follow_up: 'Follow-Up', re_engagement: 'Re-engagement', announcement: 'Announcement', drip: 'Drip',
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: string | number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4">
      <div className={clsx('p-2.5 rounded-xl', bg)}><Icon className={clsx('w-5 h-5', color)} /></div>
      <div><p className="text-xs text-gray-500">{label}</p><p className={clsx('text-xl font-bold', color)}>{value}</p></div>
    </div>
  )
}

export function Email() {
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [preview, setPreview] = useState<Campaign | null>(null)
  const [genForm, setGenForm] = useState({ business_name: '', subject: '', audience: '', key_message: '', cta_text: 'Get Started', campaign_type: 'newsletter' as CampaignType, tone: 'professional' })

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({ queryKey: ['email-campaigns'], queryFn: async () => (await axios.get(BASE)).data })
  const { data: stats } = useQuery({ queryKey: ['email-stats'], queryFn: async () => (await axios.get(`${BASE}/stats`)).data })

  const generate = useMutation({ mutationFn: async (form: typeof genForm) => (await axios.post(`${BASE}/ai/generate`, form)).data, onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-campaigns'] }); setShowGenerate(false) } })
  const markSent = useMutation({ mutationFn: async (id: number) => (await axios.patch(`${BASE}/${id}/send`)).data, onSuccess: () => qc.invalidateQueries({ queryKey: ['email-campaigns'] }) })
  const deleteCampaign = useMutation({ mutationFn: async (id: number) => axios.delete(`${BASE}/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['email-campaigns'] }) })

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Marketing</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated campaigns with analytics tracking</p></div>
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl">
          <Zap className="w-4 h-4" /> AI Generate
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Campaigns" value={stats.total}          icon={Mail}        color="text-blue-600"   bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard label="Emails Sent"     value={stats.total_sent?.toLocaleString() ?? 0} icon={Send}  color="text-green-600"  bg="bg-green-50 dark:bg-green-900/20" />
          <StatCard label="Avg Open Rate"   value={`${stats.avg_open_rate}%`}  icon={Eye}         color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" />
          <StatCard label="Avg Click Rate"  value={`${stats.avg_click_rate}%`} icon={MousePointer} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/20" />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-500 animate-spin" /></div>
      : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No campaigns yet</p>
          <button onClick={() => setShowGenerate(true)} className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
            <Zap className="w-4 h-4" /> Create First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const cfg = STATUS_CFG[c.status]
            return (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{c.name}</h3>
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>
                      {c.ai_generated && <span className="text-[10px] text-brand-600 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> AI</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Subject: {c.subject}</p>
                    {c.segment && <p className="text-xs text-gray-400">Audience: {c.segment}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.html_content && (
                      <button onClick={() => setPreview(c)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors rounded-lg" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {c.status === 'draft' && (
                      <button onClick={() => markSent.mutate(c.id)} disabled={markSent.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
                        <Send className="w-3 h-3" /> Send
                      </button>
                    )}
                    <button onClick={() => deleteCampaign.mutate(c.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {c.status === 'sent' && (
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {[
                      { label: 'Sent', value: c.sent_count.toLocaleString() },
                      { label: 'Opens', value: `${c.open_count.toLocaleString()} (${c.open_rate}%)` },
                      { label: 'Clicks', value: `${c.click_count.toLocaleString()} (${c.click_rate}%)` },
                      { label: 'Date', value: c.sent_at ? format(new Date(c.sent_at), 'MMM d') : '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* AI Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-4 h-4 text-brand-600" /> AI Generate Campaign</h2>
              <button onClick={() => setShowGenerate(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Campaign Type</label>
                  <select value={genForm.campaign_type} onChange={(e) => setGenForm({ ...genForm, campaign_type: e.target.value as CampaignType })} className={inp}>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div><label className="block text-xs text-gray-500 mb-1">Tone</label>
                  <select value={genForm.tone} onChange={(e) => setGenForm({ ...genForm, tone: e.target.value })} className={inp}>
                    {['professional', 'friendly', 'urgent', 'casual', 'formal'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
              </div>
              {[
                { key: 'business_name', label: 'Business Name', placeholder: 'Acme Corp' },
                { key: 'subject', label: 'Subject Line', placeholder: 'Your compelling subject…' },
                { key: 'audience', label: 'Target Audience', placeholder: 'e.g. Small business owners' },
                { key: 'key_message', label: 'Key Message', placeholder: 'What do you want to communicate?' },
                { key: 'cta_text', label: 'CTA Button Text', placeholder: 'Get Started' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}><label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input value={(genForm as Record<string, string>)[key]} onChange={(e) => setGenForm({ ...genForm, [key]: e.target.value })} placeholder={placeholder} className={inp} /></div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowGenerate(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => generate.mutate(genForm)} disabled={generate.isPending || !genForm.business_name || !genForm.subject}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{preview.subject}</h3>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {preview.html_content
                ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: preview.html_content }} />
                : <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{preview.plain_text}</pre>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
