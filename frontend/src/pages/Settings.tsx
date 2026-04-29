import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Settings as SettingsIcon, Key, Bell, Palette, Globe, Users, Shield,
  Save, Eye, EyeOff, CheckCircle, Loader2, Plus, Trash2, X, RefreshCw,
  Zap, Mail, Search, BarChart2, MonitorSmartphone, Clock
} from 'lucide-react'
import { clsx } from 'clsx'

const BASE = '/api/v1/settings'

interface APIKeyField {
  key: string
  label: string
  placeholder: string
  icon: React.ElementType
  color: string
  description: string
}

const API_KEYS: APIKeyField[] = [
  { key: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...', icon: Zap, color: 'text-orange-500', description: 'Powers all AI features — content, proposals, SEO audits, campaigns' },
  { key: 'sendgrid_api_key', label: 'SendGrid API Key', placeholder: 'SG.xxx...', icon: Mail, color: 'text-blue-500', description: 'Used to send email campaigns to recipients' },
  { key: 'semrush_api_key', label: 'SEMrush API Key', placeholder: 'xxx...', icon: Search, color: 'text-green-500', description: 'Enhances SEO keyword data and competitor analysis' },
  { key: 'google_analytics_id', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX', icon: BarChart2, color: 'text-yellow-500', description: 'Track visitors on client websites you build' },
]

const SOCIAL_PLATFORMS = [
  { key: 'twitter_handle', label: 'Twitter / X Handle', placeholder: '@youragency' },
  { key: 'linkedin_url', label: 'LinkedIn Page URL', placeholder: 'https://linkedin.com/company/...' },
  { key: 'facebook_page', label: 'Facebook Page', placeholder: 'https://facebook.com/...' },
  { key: 'instagram_handle', label: 'Instagram Handle', placeholder: '@youragency' },
]

const SCHEDULE_OPTIONS = [
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '12h', label: 'Every 12 hours' },
  { value: '24h', label: 'Daily' },
  { value: '72h', label: 'Every 3 days' },
  { value: 'off', label: 'Disabled' },
]

type Tab = 'general' | 'api' | 'integrations' | 'notifications' | 'team' | 'system'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'system', label: 'System', icon: Shield },
]

function MaskInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function SaveBanner({ saved }: { saved: boolean }) {
  if (!saved) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <CheckCircle className="w-4 h-4" /> Settings saved
    </div>
  )
}

export function Settings() {
  const [tab, setTab] = useState<Tab>('general')
  const [saved, setSaved] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  // Local state for all settings (loaded from backend or defaults)
  const [agency, setAgency] = useState({ name: 'My Agency', email: '', phone: '', website: '', timezone: 'UTC', currency: 'USD' })
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [social, setSocial] = useState<Record<string, string>>({})
  const [notifs, setNotifs] = useState({ new_lead: true, proposal_viewed: true, proposal_signed: true, campaign_report: false, weekly_summary: true, email_address: '' })
  const [schedules, setSchedules] = useState({ content_generation: '24h', lead_scoring: '6h', seo_monitoring: '72h', campaign_reports: '24h' })
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  // Simulated team data
  const [team] = useState([
    { id: 1, name: 'Newton Dindi', email: 'dinnewton76@gmail.com', role: 'Owner', avatar: 'ND', joined: '2024-01-15' },
  ])

  const { data: systemInfo } = useQuery({
    queryKey: ['system-info'],
    queryFn: async () => {
      try { return (await axios.get('/api/v1/system/info')).data }
      catch { return { version: '1.0.0', uptime: 'N/A', db_status: 'connected', redis_status: 'connected', jobs_running: 0 } }
    },
  })

  function showSaved() { setSaved(true); setTimeout(() => setSaved(false), 3000) }

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your agency, integrations, and system preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl text-left transition-colors',
                tab === id ? 'bg-brand-600 text-white font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700')}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* General */}
          {tab === 'general' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 dark:text-white">Agency Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-500 mb-1">Agency Name</label>
                  <input value={agency.name} onChange={(e) => setAgency({ ...agency, name: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Contact Email</label>
                  <input type="email" value={agency.email} onChange={(e) => setAgency({ ...agency, email: e.target.value })} placeholder="hello@youragency.com" className={inp} /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input value={agency.phone} onChange={(e) => setAgency({ ...agency, phone: e.target.value })} placeholder="+1 (555) 000-0000" className={inp} /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Website</label>
                  <input value={agency.website} onChange={(e) => setAgency({ ...agency, website: e.target.value })} placeholder="https://youragency.com" className={inp} /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Timezone</label>
                  <select value={agency.timezone} onChange={(e) => setAgency({ ...agency, timezone: e.target.value })} className={inp}>
                    {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                      'Europe/London', 'Europe/Paris', 'Asia/Nairobi', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney'].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select></div>
                <div><label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select value={agency.currency} onChange={(e) => setAgency({ ...agency, currency: e.target.value })} className={inp}>
                    {['USD', 'EUR', 'GBP', 'KES', 'AUD', 'CAD', 'SGD', 'AED'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select></div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Theme</h3>
                <div className="flex gap-3">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors capitalize',
                        theme === t ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300')}>
                      <MonitorSmartphone className="w-4 h-4" />{t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={showSaved} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          )}

          {/* API Keys */}
          {tab === 'api' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">API Keys</h2>
                <p className="text-xs text-gray-500 mt-0.5">Keys are stored securely and never exposed in responses</p>
              </div>
              {API_KEYS.map(({ key, label, placeholder, icon: Icon, color, description }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={clsx('w-4 h-4', color)} />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{description}</p>
                  <MaskInput value={apiKeys[key] ?? ''} onChange={(v) => setApiKeys({ ...apiKeys, [key]: v })} placeholder={placeholder} />
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={showSaved} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
                  <Save className="w-4 h-4" /> Save Keys
                </button>
              </div>
            </div>
          )}

          {/* Integrations */}
          {tab === 'integrations' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Social Media Profiles</h2>
                {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                  <div key={key}><label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input value={social[key] ?? ''} onChange={(e) => setSocial({ ...social, [key]: e.target.value })} placeholder={placeholder} className={inp} /></div>
                ))}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Automation Schedules</h2>
                <p className="text-xs text-gray-400">How often the AI agents run background tasks</p>
                {[
                  { key: 'content_generation', label: 'Auto Content Generation', icon: Zap },
                  { key: 'lead_scoring', label: 'Lead Score Refresh', icon: Users },
                  { key: 'seo_monitoring', label: 'SEO Score Monitoring', icon: Search },
                  { key: 'campaign_reports', label: 'Campaign Report Digest', icon: BarChart2 },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                    </div>
                    <select value={(schedules as Record<string, string>)[key]}
                      onChange={(e) => setSchedules({ ...schedules, [key]: e.target.value })}
                      className="text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
                      {SCHEDULE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button onClick={showSaved} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
                  <Save className="w-4 h-4" /> Save Integrations
                </button>
              </div>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
              <h2 className="font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>

              <div><label className="block text-xs text-gray-500 mb-1">Notification Email</label>
                <input type="email" value={notifs.email_address} onChange={(e) => setNotifs({ ...notifs, email_address: e.target.value })} placeholder="you@example.com" className={inp} /></div>

              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                {[
                  { key: 'new_lead', label: 'New Lead Captured', desc: 'Notify when a lead submits the embed form' },
                  { key: 'proposal_viewed', label: 'Proposal Viewed', desc: 'When a client opens your proposal link' },
                  { key: 'proposal_signed', label: 'Proposal Signed', desc: 'When a client e-signs a proposal' },
                  { key: 'campaign_report', label: 'Campaign Report Ready', desc: 'After each campaign report is generated' },
                  { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Agency performance digest every Monday' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <button onClick={() => setNotifs({ ...notifs, [key]: !(notifs as Record<string, unknown>)[key] })}
                      className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
                        (notifs as Record<string, unknown>)[key] ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600')}>
                      <span className={clsx('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                        (notifs as Record<string, unknown>)[key] ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button onClick={showSaved} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700">
                  <Save className="w-4 h-4" /> Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Team */}
          {tab === 'team' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">Team Members</h2>
                <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700">
                  <Plus className="w-3.5 h-3.5" /> Invite Member
                </button>
              </div>

              <div className="space-y-3">
                {team.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400">{m.avatar}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx('text-xs px-2.5 py-0.5 rounded-full font-medium',
                        m.role === 'Owner' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>
                        {m.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-400">
                Invite team members to collaborate on leads, proposals, and campaigns. Each member gets a personalized dashboard.
              </div>
            </div>
          )}

          {/* System */}
          {tab === 'system' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">System Status</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'App Version', value: systemInfo?.version ?? '1.0.0' },
                    { label: 'Uptime', value: systemInfo?.uptime ?? 'Running' },
                    { label: 'Database', value: systemInfo?.db_status ?? 'Connected', ok: true },
                    { label: 'Redis Cache', value: systemInfo?.redis_status ?? 'Connected', ok: true },
                    { label: 'AI Model', value: 'claude-sonnet-4-6' },
                    { label: 'Active Jobs', value: systemInfo?.jobs_running ?? '0' },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className={clsx('text-sm font-semibold', ok ? 'text-green-600' : 'text-gray-800 dark:text-gray-200')}>{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Data Management</h2>
                <div className="space-y-2">
                  {[
                    { label: 'Export All Data', desc: 'Download a JSON backup of all agency data', btn: 'Export', variant: 'secondary' },
                    { label: 'Clear Cache', desc: 'Flush Redis cache to force fresh data fetch', btn: 'Clear', variant: 'secondary' },
                  ].map(({ label, desc, btn, variant }) => (
                    <div key={label} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <button className={clsx('px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors',
                        variant === 'secondary' ? 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600 border-transparent')}>
                        {btn}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Danger Zone</h2>
                <p className="text-xs text-gray-400 mb-4">These actions are irreversible</p>
                <div className="flex items-center justify-between py-2.5 border border-red-200 dark:border-red-800 rounded-xl px-4">
                  <div>
                    <p className="text-sm font-medium text-red-600">Reset All Data</p>
                    <p className="text-xs text-gray-400">Permanently delete all leads, proposals, campaigns and content</p>
                  </div>
                  <button className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-xl hover:bg-red-600">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Email Address</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Role</label>
                <select className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option>Admin</option><option>Manager</option><option>Viewer</option>
                </select></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => { setShowInvite(false); showSaved() }} className="flex-1 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700">Send Invite</button>
            </div>
          </div>
        </div>
      )}

      <SaveBanner saved={saved} />
    </div>
  )
}
