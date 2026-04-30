import { useState } from 'react'
import {
  X, Globe, ExternalLink, Zap, Loader2, Search, CheckCircle,
  ChevronDown, ChevronRight, Plus, Trash2, Send, Download,
  ClipboardList, RotateCcw, Check, Copy,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useWebsite, useUpdateWebsite, useAISEOAudit, useAIGenerateSection,
  useDeletePage, useWebsiteRevisions, useCreateRevision, useUpdateRevision,
  useDeleteRevision, useDeploySite, useExportHTML,
  type WebsiteRevision,
} from '../../hooks/useWebsites'
import { RequirementsModal } from './RequirementsModal'
import type { WebsiteSection, SectionType, WebsiteStatus } from '../../types'

const SECTION_TYPES: { value: SectionType; label: string; emoji: string }[] = [
  { value: 'hero',         label: 'Hero',         emoji: '🚀' },
  { value: 'about',        label: 'About',        emoji: '👥' },
  { value: 'services',     label: 'Services',     emoji: '⚙️' },
  { value: 'portfolio',    label: 'Portfolio',    emoji: '🎨' },
  { value: 'testimonials', label: 'Testimonials', emoji: '💬' },
  { value: 'pricing',      label: 'Pricing',      emoji: '💰' },
  { value: 'faq',          label: 'FAQ',          emoji: '❓' },
  { value: 'contact',      label: 'Contact',      emoji: '📞' },
  { value: 'team',         label: 'Team',         emoji: '👨‍💼' },
  { value: 'stats',        label: 'Stats',        emoji: '📊' },
  { value: 'cta',          label: 'CTA',          emoji: '🎯' },
]

const STATUS_OPTIONS: WebsiteStatus[] = ['planning', 'in_progress', 'review', 'live', 'maintenance', 'paused']

const REVISION_STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  done:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected:    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

const PRIORITY_COLORS = {
  low:    'text-gray-400',
  medium: 'text-yellow-500',
  high:   'text-red-500',
}

function SectionView({ section, index }: { section: WebsiteSection; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const emoji = SECTION_TYPES.find(s => s.value === section.type)?.emoji ?? '📄'

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left">
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{section.type}</p>
          {section.heading && <p className="text-xs text-gray-500 truncate">{section.heading}</p>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-800">
          {section.heading && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Heading</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.heading}</p>
            </div>
          )}
          {section.subheading && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Subheading</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{section.subheading}</p>
            </div>
          )}
          {section.content && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Content</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{section.content}</p>
            </div>
          )}
          {section.items && section.items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Items ({section.items.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {section.items.slice(0, 6).map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{item.icon} {item.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {section.cta_text && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-600 font-medium border border-brand-200 dark:border-brand-700 px-3 py-1 rounded-full">
                {section.cta_text}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RevisionCard({ rev, siteId }: { rev: WebsiteRevision; siteId: number }) {
  const updateRevision = useUpdateRevision()
  const deleteRevision = useDeleteRevision()
  const [confirm, setConfirm] = useState(false)

  const next = rev.status === 'pending' ? 'in_progress'
    : rev.status === 'in_progress' ? 'done'
    : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', REVISION_STATUS_COLORS[rev.status])}>
              {rev.status.replace('_', ' ')}
            </span>
            <span className={clsx('text-[10px] font-semibold', PRIORITY_COLORS[rev.priority])}>
              {rev.priority}
            </span>
            {rev.page_name && <span className="text-[10px] text-gray-400">{rev.page_name}</span>}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 mt-1.5">{rev.description}</p>
          {rev.requested_by && <p className="text-[11px] text-gray-400 mt-1">By: {rev.requested_by}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {next && (
            <button
              onClick={() => updateRevision.mutate({ siteId, rid: rev.id, status: next })}
              disabled={updateRevision.isPending}
              className="p-1 text-gray-400 hover:text-green-500 transition-colors"
              title={`Mark as ${next.replace('_', ' ')}`}>
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => deleteRevision.mutate({ siteId, rid: rev.id })}
                className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded">Del</button>
              <button onClick={() => setConfirm(false)}
                className="px-1.5 py-0.5 text-[10px] border border-gray-200 dark:border-gray-600 rounded text-gray-500">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  siteId: number
  onClose: () => void
}

export function WebsiteEditor({ siteId, onClose }: Props) {
  const { data: site, isLoading } = useWebsite(siteId)
  const updateWebsite = useUpdateWebsite()
  const seoAudit = useAISEOAudit()
  const generateSection = useAIGenerateSection()
  const deletePage = useDeletePage()
  const { data: revisions = [] } = useWebsiteRevisions(siteId)
  const createRevision = useCreateRevision()
  const deploySite = useDeploySite()
  const exportHTML = useExportHTML()

  const [activePage, setActivePage] = useState(0)
  const [addSectionType, setAddSectionType] = useState<SectionType>('services')
  const [showAddSection, setShowAddSection] = useState(false)
  const [seoResult, setSeoResult] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'deploy' | 'revisions' | 'settings'>('content')
  const [showRequirements, setShowRequirements] = useState(false)

  // Revision form
  const [revDesc, setRevDesc] = useState('')
  const [revBy, setRevBy] = useState('')
  const [revPriority, setRevPriority] = useState('medium')

  // Deploy form
  const [deployPlatform, setDeployPlatform] = useState<'netlify' | 'vercel' | 'wordpress'>('netlify')
  const [wpUrl, setWpUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [copiedPreview, setCopiedPreview] = useState(false)

  if (isLoading || !site) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      </>
    )
  }

  const currentPage = site.pages[activePage]
  const sections: WebsiteSection[] = currentPage?.sections ? JSON.parse(currentPage.sections) : []
  const previewUrl = `${window.location.origin}/api/v1/websites/preview/${site.share_token}`
  const liveUrl = site.netlify_deploy_url || site.vercel_deploy_url || site.live_url

  function copyPreview() {
    navigator.clipboard.writeText(previewUrl)
    setCopiedPreview(true)
    setTimeout(() => setCopiedPreview(false), 2000)
  }

  async function handleSEOAudit() {
    const result = await seoAudit.mutateAsync(siteId)
    setSeoResult(result)
    setActiveTab('seo')
  }

  async function handleAddSection() {
    if (!currentPage) return
    await generateSection.mutateAsync({ siteId, pageId: currentPage.id, section_type: addSectionType })
    setShowAddSection(false)
  }

  async function handleDeploy() {
    await deploySite.mutateAsync({
      siteId,
      platform: deployPlatform,
      wp_url: wpUrl || undefined,
      wp_username: wpUser || undefined,
      wp_app_password: wpPass || undefined,
    })
  }

  async function handleAddRevision() {
    if (!revDesc.trim()) return
    await createRevision.mutateAsync({ siteId, description: revDesc, requested_by: revBy || undefined, priority: revPriority })
    setRevDesc('')
    setRevBy('')
  }

  const pendingRevisions = revisions.filter(r => r.status === 'pending' || r.status === 'in_progress')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white truncate">{site.name}</h2>
            <p className="text-xs text-gray-500">{site.client_name} · {site.pages_count} pages</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setShowRequirements(true)}
              title="Client requirements intake"
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                site.requirements_submitted
                  ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : site.requirements_sent
                    ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                    : 'text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}>
              <ClipboardList className="w-4 h-4" />
            </button>
            <button onClick={copyPreview} title="Copy preview link"
              className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {copiedPreview ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress + status */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs font-semibold text-brand-600">{site.progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
              <div className="h-1.5 bg-brand-500 rounded-full transition-all" style={{ width: `${site.progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={site.status}
              onChange={e => updateWebsite.mutate({ id: siteId, status: e.target.value as WebsiteStatus })}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <input type="range" min={0} max={100} value={site.progress}
              onChange={e => updateWebsite.mutate({ id: siteId, progress: Number(e.target.value) })}
              className="w-20 accent-brand-600" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5 overflow-x-auto">
          {(['content', 'seo', 'deploy', 'revisions', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={clsx(
                'py-2.5 px-1 mr-4 text-xs font-medium border-b-2 capitalize transition-colors whitespace-nowrap flex items-center gap-1',
                activeTab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              {t}
              {t === 'revisions' && pendingRevisions.length > 0 && (
                <span className="bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingRevisions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Content tab ── */}
          {activeTab === 'content' && (
            <div className="flex h-full">
              <div className="w-36 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto">
                {site.pages.map((page, i) => (
                  <button key={page.id} onClick={() => setActivePage(i)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 text-xs font-medium border-b border-gray-50 dark:border-gray-800 transition-colors',
                      activePage === i
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                    )}>
                    {page.name}
                    {page.is_published && <span className="block text-[10px] text-green-500 mt-0.5">● Live</span>}
                  </button>
                ))}
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {currentPage ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{currentPage.name}</h3>
                        <p className="text-xs text-gray-400 font-mono">{currentPage.slug}</p>
                      </div>
                      <button onClick={() => setShowAddSection(!showAddSection)}
                        className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
                        <Plus className="w-3.5 h-3.5" /> Add Section
                      </button>
                    </div>
                    {showAddSection && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 space-y-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">AI Generate Section</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {SECTION_TYPES.map(s => (
                            <button key={s.value} onClick={() => setAddSectionType(s.value)}
                              className={clsx(
                                'text-xs px-2 py-1.5 rounded-lg border transition-all',
                                addSectionType === s.value
                                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                                  : 'border-gray-200 dark:border-gray-600 text-gray-500',
                              )}>
                              {s.emoji} {s.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={handleAddSection} disabled={generateSection.isPending}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-brand-600 text-white rounded-lg disabled:opacity-60">
                          {generateSection.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          Generate
                        </button>
                      </div>
                    )}
                    {sections.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No sections yet</div>
                    ) : (
                      <div className="space-y-2">
                        {sections.map((sec, i) => <SectionView key={i} section={sec} index={i} />)}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No pages yet</p>
                )}
              </div>
            </div>
          )}

          {/* ── SEO tab ── */}
          {activeTab === 'seo' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">SEO Analysis</p>
                <button onClick={handleSEOAudit} disabled={seoAudit.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg disabled:opacity-60">
                  {seoAudit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Run Audit
                </button>
              </div>
              {site.seo_score !== null && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className={clsx(
                    'text-5xl font-black mb-1',
                    site.seo_score >= 80 ? 'text-green-500' : site.seo_score >= 60 ? 'text-yellow-500' : 'text-red-500',
                  )}>
                    {site.seo_score}
                  </div>
                  <p className="text-xs text-gray-500">SEO Score</p>
                </div>
              )}
              {seoResult && (
                <div className="space-y-3">
                  {(seoResult.issues as { severity: string; issue: string; fix: string }[] ?? []).map((issue, i) => (
                    <div key={i} className={clsx(
                      'rounded-xl p-3 border text-sm',
                      issue.severity === 'high'   ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' :
                      issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
                    )}>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{issue.issue}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Fix: {issue.fix}</p>
                    </div>
                  ))}
                  {(seoResult.strengths as string[] ?? []).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deploy tab ── */}
          {activeTab === 'deploy' && (
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Deployment</p>
                <button
                  onClick={() => exportHTML.mutate({ siteId, name: site.name })}
                  disabled={exportHTML.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60">
                  {exportHTML.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export HTML
                </button>
              </div>

              {/* Current deploy status */}
              {liveUrl && (
                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                  <Globe className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300">Live on {site.deploy_platform || 'external'}</p>
                    <a href={liveUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline truncate block">{liveUrl}</a>
                  </div>
                </div>
              )}

              {/* Preview link */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preview Link</p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate font-mono">/preview/{site.share_token.slice(0, 16)}…</p>
                  <button onClick={copyPreview} className="shrink-0 text-gray-400 hover:text-brand-600 transition-colors">
                    {copiedPreview ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="shrink-0 text-gray-400 hover:text-brand-600 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Platform selector */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Deploy to Platform</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['netlify', 'vercel', 'wordpress'] as const).map(p => (
                    <button key={p} onClick={() => setDeployPlatform(p)}
                      className={clsx(
                        'py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all',
                        deployPlatform === p
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300',
                      )}>
                      {p === 'netlify' ? '⬆️' : p === 'vercel' ? '▲' : '🌐'} {p}
                    </button>
                  ))}
                </div>

                {deployPlatform === 'wordpress' && (
                  <div className="space-y-2 mb-3">
                    <input value={wpUrl} onChange={e => setWpUrl(e.target.value)} placeholder="https://your-wp-site.com"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <input value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="WordPress username"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <input type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="Application password"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                )}

                <button onClick={handleDeploy} disabled={deploySite.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
                  {deploySite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Deploy to {deployPlatform}
                </button>
                {deploySite.isSuccess && (
                  <p className="text-xs text-green-600 text-center mt-2">Deployed successfully!</p>
                )}
              </div>
            </div>
          )}

          {/* ── Revisions tab ── */}
          {activeTab === 'revisions' && (
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Revision Requests
                {pendingRevisions.length > 0 && (
                  <span className="ml-2 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                    {pendingRevisions.length} pending
                  </span>
                )}
              </p>

              {/* Add revision form */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Log a Revision Request</p>
                <textarea value={revDesc} onChange={e => setRevDesc(e.target.value)} rows={2}
                  placeholder="Describe what needs to be changed…"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                <div className="flex gap-2">
                  <input value={revBy} onChange={e => setRevBy(e.target.value)} placeholder="Requested by (optional)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  <select value={revPriority} onChange={e => setRevPriority(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button onClick={handleAddRevision} disabled={createRevision.isPending || !revDesc.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg disabled:opacity-60">
                    {createRevision.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                </div>
              </div>

              {revisions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No revisions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {revisions.map(rev => (
                    <RevisionCard key={rev.id} rev={rev} siteId={siteId} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Settings tab ── */}
          {activeTab === 'settings' && (
            <div className="p-5 space-y-4">
              {[
                { label: 'Live URL', field: 'live_url', placeholder: 'https://example.com', type: 'text' },
                { label: 'Domain', field: 'domain', placeholder: 'example.com', type: 'text' },
                { label: 'Project Value ($)', field: 'project_value', placeholder: '0', type: 'number' },
                { label: 'Monthly Maintenance ($)', field: 'monthly_maintenance', placeholder: '0', type: 'number' },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type={type}
                    defaultValue={(site as Record<string, unknown>)[field] as string ?? ''}
                    placeholder={placeholder}
                    onBlur={e => updateWebsite.mutate({ id: siteId, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea defaultValue={site.notes ?? ''} rows={3}
                  onBlur={e => updateWebsite.mutate({ id: siteId, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {showRequirements && (
        <RequirementsModal
          siteId={siteId}
          siteName={site.name}
          clientEmail={site.client_email}
          onClose={() => setShowRequirements(false)}
        />
      )}
    </>
  )
}
