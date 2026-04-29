import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Megaphone, Zap, Plus, Trash2, Loader2, DollarSign, TrendingUp, Target, X, ChevronDown, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const BASE = '/api/v1/campaigns'

type CampaignStatus = 'draft' | 'active' | 'paused' | 'complete' | 'cancelled'
type CampaignChannel = 'email' | 'social_media' | 'ppc' | 'seo' | 'content' | 'influencer' | 'sms' | 'whatsapp'

interface Campaign {
  id: number; name: string; description: string | null; status: CampaignStatus
  channels: string | null; target_audience: string | null; goals: string | null
  budget: number; spent: number; revenue: number; roi: number
  metrics: string | null; ai_strategy: string | null
  start_date: string | null; end_date: string | null; created_at: string
}

const STATUS_CFG: Record<CampaignStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Draft',     color: 'text-gray-600 bg-gray-100 dark:bg-gray-700',          dot: 'bg-gray-400' },
  active:    { label: 'Active',    color: 'text-green-600 bg-green-50 dark:bg-green-900/20',     dot: 'bg-green-500 animate-pulse' },
  paused:    { label: 'Paused',    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500' },
  complete:  { label: 'Complete',  color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',       dot: 'bg-blue-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-500 bg-red-50 dark:bg-red-900/20',          dot: 'bg-red-400' },
}

const CHANNELS: { value: CampaignChannel; label: string; emoji: string }[] = [
  { value: 'email', label: 'Email', emoji: '✉️' },
  { value: 'social_media', label: 'Social Media', emoji: '📱' },
  { value: 'ppc', label: 'PPC Ads', emoji: '💰' },
  { value: 'seo', label: 'SEO', emoji: '🔍' },
  { value: 'content', label: 'Content', emoji: '✍️' },
  { value: 'influencer', label: 'Influencer', emoji: '⭐' },
  { value: 'sms', label: 'SMS', emoji: '💬' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '📞' },
]

export function Campaigns() {
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<CampaignChannel[]>(['social_media', 'email'])
  const [genForm, setGenForm] = useState({ business_name: '', industry: '', goal: '', target_audience: '', budget: '', duration_weeks: '4' })

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({ queryKey: ['campaigns'], queryFn: async () => (await axios.get(BASE)).data })
  const { data: stats } = useQuery({ queryKey: ['campaign-stats'], queryFn: async () => (await axios.get(`${BASE}/stats`)).data })

  const generate = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/ai/strategy`, { ...genForm, budget: Number(genForm.budget), duration_weeks: Number(genForm.duration_weeks), channels: selectedChannels })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setShowGenerate(false) },
  })
  const del = useMutation({ mutationFn: async (id: number) => axios.delete(`${BASE}/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }) })
  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Partial<Campaign>) => (await axios.patch(`${BASE}/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-channel marketing campaigns with AI strategy and ROI tracking</p></div>
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl">
          <Zap className="w-4 h-4" /> AI Strategy
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Active', value: stats.active, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
            { label: 'Total Spent', value: `$${(stats.total_spent / 1000).toFixed(1)}k`, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
            { label: 'Avg ROI', value: `${stats.avg_roi}%`, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4">
              <p className="text-xs text-gray-500">{label}</p><p className={clsx('text-xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-500 animate-spin" /></div>
      : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No campaigns yet</p>
          <button onClick={() => setShowGenerate(true)} className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 mx-auto">
            <Zap className="w-4 h-4" /> Create AI Campaign Strategy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const cfg = STATUS_CFG[c.status]
            const channels: string[] = c.channels ? JSON.parse(c.channels) : []
            const strategy = c.ai_strategy ? JSON.parse(c.ai_strategy) : null
            const isExpanded = expandedId === c.id

            return (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="font-semibold text-sm text-gray-900 dark:text-white hover:text-brand-600 flex items-center gap-1">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {c.name}
                        </button>
                        <span className={clsx('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {channels.map((ch) => {
                          const meta = CHANNELS.find((x) => x.value === ch)
                          return <span key={ch} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{meta?.emoji} {meta?.label ?? ch}</span>
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.budget > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Budget</p>
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">${c.budget.toLocaleString()}</p>
                        </div>
                      )}
                      {c.roi !== 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">ROI</p>
                          <p className={clsx('text-sm font-bold', c.roi >= 0 ? 'text-green-600' : 'text-red-500')}>{c.roi}%</p>
                        </div>
                      )}
                      <select value={c.status} onChange={(e) => update.mutate({ id: c.id, status: e.target.value as CampaignStatus })}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none">
                        {Object.entries(STATUS_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                      <button onClick={() => del.mutate(c.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                {isExpanded && strategy && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{strategy.overview}</p>
                    {strategy.channel_breakdown?.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {strategy.channel_breakdown.map((ch: { channel: string; budget_allocation: string; tactics: string[] }, i: number) => (
                          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize">{ch.channel.replace('_', ' ')}</p>
                              <span className="text-[10px] text-brand-600 font-bold">{ch.budget_allocation}</span>
                            </div>
                            {ch.tactics?.slice(0, 3).map((t: string, j: number) => (
                              <p key={j} className="text-[10px] text-gray-500 py-0.5">• {t}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {strategy.expected_results && (
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(strategy.expected_results).slice(0, 6).map(([k, v]) => (
                          <div key={k} className="text-center bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{String(v)}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-4 h-4 text-brand-600" /> AI Campaign Strategy</h2>
              <button onClick={() => setShowGenerate(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'business_name', label: 'Business Name', placeholder: 'Acme Corp' },
                  { key: 'industry', label: 'Industry', placeholder: 'Technology' },
                  { key: 'budget', label: 'Budget ($)', placeholder: '5000', type: 'number' },
                  { key: 'duration_weeks', label: 'Duration (weeks)', placeholder: '4', type: 'number' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}><label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input type={type ?? 'text'} value={(genForm as Record<string, string>)[key]} onChange={(e) => setGenForm({ ...genForm, [key]: e.target.value })} placeholder={placeholder} className={inp} /></div>
                ))}
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Campaign Goal</label>
                <input value={genForm.goal} onChange={(e) => setGenForm({ ...genForm, goal: e.target.value })} placeholder="e.g. Generate 100 leads in 30 days" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Target Audience</label>
                <input value={genForm.target_audience} onChange={(e) => setGenForm({ ...genForm, target_audience: e.target.value })} placeholder="e.g. SME owners in East Africa" className={inp} /></div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Channels</label>
                <div className="grid grid-cols-4 gap-2">
                  {CHANNELS.map((ch) => (
                    <button key={ch.value}
                      onClick={() => setSelectedChannels(selectedChannels.includes(ch.value) ? selectedChannels.filter((c) => c !== ch.value) : [...selectedChannels, ch.value])}
                      className={clsx('p-2 rounded-xl border text-center transition-all',
                        selectedChannels.includes(ch.value) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-600')}>
                      <span className="text-lg block">{ch.emoji}</span>
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{ch.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowGenerate(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => generate.mutate()} disabled={generate.isPending || !genForm.business_name || !genForm.goal || selectedChannels.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Strategizing…</> : <><Zap className="w-4 h-4" /> Generate Strategy</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
