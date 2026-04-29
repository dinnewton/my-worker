import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Search, Zap, Plus, Trash2, Loader2, TrendingUp, AlertTriangle, CheckCircle, X, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const BASE = '/api/v1/seo'

interface SEOProject {
  id: number; client_name: string; website_url: string; status: string
  keywords: string | null; technical_issues: string | null; recommendations: string | null
  seo_score: number | null; technical_score: number | null; content_score: number | null; authority_score: number | null
  estimated_monthly_traffic: number | null; notes: string | null
  last_audit_at: string | null; created_at: string
}

function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const color = !score ? 'text-gray-300' : score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'
  return (
    <div className="text-center">
      <div className={clsx('text-3xl font-black', color)}>{score ?? '—'}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}

export function SEO() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<SEOProject | null>(null)
  const [auditResult, setAuditResult] = useState<Record<string, unknown> | null>(null)
  const [addForm, setAddForm] = useState({ client_name: '', website_url: '', notes: '' })
  const [keywords, setKeywords] = useState('')

  const { data: projects = [], isLoading } = useQuery<SEOProject[]>({ queryKey: ['seo-projects'], queryFn: async () => (await axios.get(BASE)).data })
  const { data: stats } = useQuery({ queryKey: ['seo-stats'], queryFn: async () => (await axios.get(`${BASE}/stats`)).data })

  const create = useMutation({ mutationFn: async (form: typeof addForm) => (await axios.post(BASE, form)).data, onSuccess: () => { qc.invalidateQueries({ queryKey: ['seo-projects'] }); setShowAdd(false) } })
  const del = useMutation({ mutationFn: async (id: number) => axios.delete(`${BASE}/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['seo-projects'] }); setSelected(null) } })
  const audit = useMutation({
    mutationFn: async ({ id, kws }: { id: number; kws: string[] }) => (await axios.post(`${BASE}/${id}/audit`, { target_keywords: kws })).data,
    onSuccess: (data) => { setAuditResult(data); qc.invalidateQueries({ queryKey: ['seo-projects'] }) },
  })

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">SEO Tools</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered SEO audits, keyword research & recommendations</p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Projects', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Active', value: stats.active, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
            { label: 'Avg SEO Score', value: stats.avg_score, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Audited', value: stats.audited, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={clsx('text-xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Project List */}
        <div className="space-y-3">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-500 animate-spin" /></div>
          : projects.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No SEO projects yet</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-brand-600 font-medium">+ Add First Project</button>
            </div>
          ) : projects.map((p) => (
            <div key={p.id}
              onClick={() => { setSelected(p); setAuditResult(null) }}
              className={clsx(
                'bg-white dark:bg-gray-800 rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all',
                selected?.id === p.id ? 'border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900' : 'border-gray-200 dark:border-gray-700',
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{p.client_name}</p>
                  <a href={`https://${p.website_url.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    {p.website_url} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="text-right flex-shrink-0">
                  {p.seo_score !== null && (
                    <div className={clsx('text-2xl font-black', p.seo_score >= 80 ? 'text-green-500' : p.seo_score >= 60 ? 'text-yellow-500' : 'text-red-500')}>
                      {p.seo_score}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">{p.last_audit_at ? format(new Date(p.last_audit_at), 'MMM d') : 'Not audited'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{selected.client_name}</h3>
              <div className="flex gap-2">
                <button onClick={() => del.mutate(selected.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Score rings */}
            <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
              <ScoreRing score={selected.seo_score} label="Overall" />
              <ScoreRing score={selected.technical_score} label="Technical" />
              <ScoreRing score={selected.content_score} label="Content" />
              <ScoreRing score={selected.authority_score} label="Authority" />
            </div>

            {/* Run audit */}
            <div className="space-y-2">
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
                placeholder="Target keywords (comma separated)…" className={inp} />
              <button
                onClick={() => audit.mutate({ id: selected.id, kws: keywords.split(',').map((k) => k.trim()).filter(Boolean) })}
                disabled={audit.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {audit.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditing…</> : <><Search className="w-4 h-4" /> Run AI SEO Audit</>}
              </button>
            </div>

            {/* Audit results */}
            {(auditResult || selected.technical_issues) && (() => {
              const issues = JSON.parse((auditResult?.technical_issues as string) ?? selected.technical_issues ?? '[]')
              const recs = JSON.parse((auditResult?.recommendations as string) ?? selected.recommendations ?? '[]')
              return (
                <div className="space-y-3">
                  {issues.slice(0, 4).map((issue: { severity: string; issue: string; fix: string }, i: number) => (
                    <div key={i} className={clsx('rounded-xl p-3 border text-xs',
                      issue.severity === 'high' ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' :
                      issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800')}>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{issue.issue}</p>
                      <p className="text-gray-500 mt-0.5">Fix: {issue.fix}</p>
                    </div>
                  ))}
                  {recs.slice(0, 3).map((r: { action: string; expected_impact: string }, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div><p className="font-medium text-gray-800 dark:text-gray-200">{r.action}</p>
                        <p className="text-gray-500">{r.expected_impact}</p></div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">New SEO Project</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs text-gray-500 mb-1">Client Name</label>
                <input value={addForm.client_name} onChange={(e) => setAddForm({ ...addForm, client_name: e.target.value })} placeholder="Acme Corp" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Website URL</label>
                <input value={addForm.website_url} onChange={(e) => setAddForm({ ...addForm, website_url: e.target.value })} placeholder="acme.com" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} className={clsx(inp, 'resize-none')} /></div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => create.mutate(addForm)} disabled={create.isPending || !addForm.client_name || !addForm.website_url}
                className="flex-1 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                {create.isPending ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
