import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  MessageCircle, Send, Zap, Plus, Trash2, Loader2, Search, X,
  CheckCheck, Check, Clock, AlertCircle, Users, BarChart2,
  FileText, Globe, CreditCard, Megaphone, Bot, Settings,
  ChevronRight, Shield, Phone, Star, Filter,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format, isToday, isYesterday } from 'date-fns'

const BASE = '/api/v1/whatsapp'

// ── Types ──────────────────────────────────────────────────────────────────

type MsgDirection = 'inbound' | 'outbound'
type MsgStatus = 'sent' | 'delivered' | 'read' | 'failed'
type MsgType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'interactive'
type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected'
type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed'

interface Contact {
  id: number; wa_id: string; phone: string | null; name: string | null; profile_name: string | null
  is_qualified: boolean; lead_score: number; suggested_action: string | null
  opt_in: boolean; unread_count: number
  last_message_at: string | null; last_message_preview: string | null; created_at: string
}
interface Message {
  id: number; contact_id: number; direction: MsgDirection; message_type: MsgType
  body: string | null; status: MsgStatus; is_ai_generated: boolean
  media_url: string | null; media_caption: string | null; created_at: string
}
interface Template {
  id: number; name: string; category: string; language: string
  header_text: string | null; body_text: string | null; footer_text: string | null
  buttons: string | null; variables: string | null; status: TemplateStatus; use_count: number; created_at: string
}
interface Broadcast {
  id: number; name: string; message_body: string | null; target_filter: string
  recipient_count: number; sent_count: number; delivered_count: number; failed_count: number
  status: BroadcastStatus; sent_at: string | null; created_at: string
}
interface Stats {
  total_contacts: number; qualified_leads: number; total_messages: number
  inbound_today: number; broadcasts_sent: number; auto_reply_enabled: boolean; configured: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function msgTime(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

function StatusIcon({ status }: { status: MsgStatus }) {
  if (status === 'read')      return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
  if (status === 'sent')      return <Check className="w-3.5 h-3.5 text-gray-400" />
  if (status === 'failed')    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
  return null
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  return <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', color)}>{score}</span>
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'conversations' | 'templates' | 'broadcasts' | 'setup'

export function WhatsApp() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('conversations')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'qualified' | 'unread'>('all')
  const [replyText, setReplyText] = useState('')
  const [showQuickSend, setShowQuickSend] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showBroadcastForm, setShowBroadcastForm] = useState(false)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ name: '', message_body: '', target_filter: 'all' })
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'MARKETING', language: 'en', header_text: '', body_text: '', footer_text: '', variables: '' })
  const [aiTemplateForm, setAiTemplateForm] = useState({ purpose: '', category: 'MARKETING', variables: '' })
  const [quickSendForm, setQuickSendForm] = useState({ type: 'proposal' as 'proposal' | 'invoice' | 'site_preview', link: '', note: '' })
  const [addContactForm, setAddContactForm] = useState({ wa_id: '', name: '', phone: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: stats } = useQuery<Stats>({ queryKey: ['wa-stats'], queryFn: async () => (await axios.get(`${BASE}/stats`)).data, refetchInterval: 30_000 })
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ['wa-contacts'], queryFn: async () => (await axios.get(`${BASE}/contacts`)).data, refetchInterval: 10_000 })
  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['wa-messages', selectedContact?.id],
    queryFn: async () => (await axios.get(`${BASE}/contacts/${selectedContact!.id}/messages`)).data,
    enabled: !!selectedContact,
    refetchInterval: 5_000,
  })
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ['wa-templates'], queryFn: async () => (await axios.get(`${BASE}/templates`)).data })
  const { data: broadcasts = [] } = useQuery<Broadcast[]>({ queryKey: ['wa-broadcasts'], queryFn: async () => (await axios.get(`${BASE}/broadcasts`)).data })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMsg = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/send`, { contact_id: selectedContact!.id, body: replyText })).data,
    onSuccess: () => { setReplyText(''); qc.invalidateQueries({ queryKey: ['wa-messages', selectedContact?.id] }); qc.invalidateQueries({ queryKey: ['wa-contacts'] }) },
  })
  const aiReply = useMutation({
    mutationFn: async (cid: number) => (await axios.post(`${BASE}/contacts/${cid}/ai-reply`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-messages', selectedContact?.id] }); qc.invalidateQueries({ queryKey: ['wa-contacts'] }) },
  })
  const quickSend = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/quick-send`, { contact_id: selectedContact!.id, ...quickSendForm })).data,
    onSuccess: () => { setShowQuickSend(false); qc.invalidateQueries({ queryKey: ['wa-messages', selectedContact?.id] }) },
  })
  const createTemplate = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/templates`, { ...templateForm, variables: templateForm.variables.split(',').map(v => v.trim()).filter(Boolean) })).data,
    onSuccess: () => { setShowTemplateForm(false); qc.invalidateQueries({ queryKey: ['wa-templates'] }) },
  })
  const aiTemplate = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/templates/ai`, { ...aiTemplateForm, variables: aiTemplateForm.variables.split(',').map(v => v.trim()).filter(Boolean) })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-templates'] }) },
  })
  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => axios.delete(`${BASE}/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-templates'] }),
  })
  const createBroadcast = useMutation({
    mutationFn: async () => (await axios.post(`${BASE}/broadcasts`, broadcastForm)).data,
    onSuccess: () => { setShowBroadcastForm(false); qc.invalidateQueries({ queryKey: ['wa-broadcasts'] }) },
  })
  const sendBroadcast = useMutation({
    mutationFn: async (id: number) => (await axios.post(`${BASE}/broadcasts/${id}/send`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-broadcasts'] }),
  })
  const deleteBroadcast = useMutation({
    mutationFn: async (id: number) => axios.delete(`${BASE}/broadcasts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-broadcasts'] }),
  })
  const aiBroadcast = useMutation({
    mutationFn: async (p: { goal: string; audience: string }) => (await axios.post(`${BASE}/broadcasts/ai-message`, p)).data,
    onSuccess: (data) => setBroadcastForm(f => ({ ...f, message_body: data.message })),
  })

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'

  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    const matchFilter = filter === 'all' || (filter === 'qualified' && c.is_qualified) || (filter === 'unread' && c.unread_count > 0)
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] -m-6">
      {/* Top stat bar */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-500" /> WhatsApp Business
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered conversations, lead qualification & broadcasts</p>
          </div>
          <div className="flex items-center gap-2">
            {stats?.auto_reply_enabled && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full">
                <Bot className="w-3.5 h-3.5" /> AI Auto-Reply On
              </span>
            )}
            {!stats?.configured && (
              <button onClick={() => setTab('setup')} className="flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100">
                <Settings className="w-3.5 h-3.5" /> Connect WhatsApp
              </button>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Contacts', value: stats.total_contacts, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Qualified Leads', value: stats.qualified_leads, icon: Star, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Total Messages', value: stats.total_messages, icon: MessageCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { label: 'Inbound Today', value: stats.inbound_today, icon: BarChart2, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { label: 'Broadcasts Sent', value: stats.broadcasts_sent, icon: Megaphone, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
                <div className={clsx('p-2 rounded-xl', bg)}><Icon className={clsx('w-4 h-4', color)} /></div>
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p><p className={clsx('text-lg font-bold', color)}>{value}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {([
            { id: 'conversations', label: 'Conversations', icon: MessageCircle },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
            { id: 'setup', label: 'Setup & Config', icon: Settings },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === id ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conversations Tab ── */}
      {tab === 'conversations' && (
        <div className="flex flex-1 min-h-0">
          {/* Contact list */}
          <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
            <div className="p-3 space-y-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="flex gap-1">
                {(['all', 'qualified', 'unread'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={clsx('flex-1 py-1 text-[10px] font-medium rounded-lg capitalize transition-colors',
                      filter === f ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No contacts yet</p>
                  <p className="text-[10px] text-gray-300 mt-1">Messages arrive when WhatsApp is connected</p>
                </div>
              ) : filteredContacts.map(c => (
                <button key={c.id} onClick={() => setSelectedContact(c)}
                  className={clsx('w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50',
                    selectedContact?.id === c.id && 'bg-green-50 dark:bg-green-900/10 border-l-2 border-l-green-500')}>
                  <div className="flex items-start gap-2.5">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                        {(c.name || c.wa_id)[0].toUpperCase()}
                      </div>
                      {c.is_qualified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <Star className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name || c.wa_id}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {c.last_message_at ? msgTime(c.last_message_at) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="text-xs text-gray-400 truncate">{c.last_message_preview || c.phone}</p>
                        {c.unread_count > 0 && (
                          <span className="flex-shrink-0 text-[10px] font-bold bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            {c.unread_count > 9 ? '9+' : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation thread */}
          {selectedContact ? (
            <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-gray-900">
              {/* Chat header */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                    {(selectedContact.name || selectedContact.wa_id)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedContact.name || selectedContact.wa_id}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{selectedContact.phone || selectedContact.wa_id}
                      {selectedContact.is_qualified && <span className="ml-1 text-green-600 font-medium">· Qualified Lead</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={selectedContact.lead_score} />
                  <button onClick={() => setShowQuickSend(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <Send className="w-3.5 h-3.5" /> Quick Send
                  </button>
                  <button onClick={() => aiReply.mutate(selectedContact.id)} disabled={aiReply.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-green-500 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50">
                    {aiReply.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    AI Reply
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {msgsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-green-500 animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No messages yet</p>
                  </div>
                ) : messages.map((m, i) => {
                  const isOut = m.direction === 'outbound'
                  const showDate = i === 0 || format(new Date(messages[i - 1].created_at), 'yyyy-MM-dd') !== format(new Date(m.created_at), 'yyyy-MM-dd')
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] text-gray-500 bg-white dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm">
                            {isToday(new Date(m.created_at)) ? 'Today' : isYesterday(new Date(m.created_at)) ? 'Yesterday' : format(new Date(m.created_at), 'MMMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className={clsx('flex', isOut ? 'justify-end' : 'justify-start')}>
                        <div className={clsx('max-w-xs lg:max-w-sm xl:max-w-md px-3 py-2 rounded-2xl shadow-sm text-sm',
                          isOut
                            ? 'bg-[#d9fdd3] dark:bg-green-900/40 text-gray-800 dark:text-gray-100 rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm')}>
                          {m.is_ai_generated && (
                            <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 mb-0.5">
                              <Bot className="w-2.5 h-2.5" /> AI
                            </div>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          <div className={clsx('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
                            <span className="text-[10px] text-gray-400">{format(new Date(m.created_at), 'HH:mm')}</span>
                            {isOut && <StatusIcon status={m.status} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) { e.preventDefault(); sendMsg.mutate() } }}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={() => sendMsg.mutate()}
                  disabled={!replyText.trim() || sendMsg.isPending}
                  className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full disabled:opacity-50 transition-colors">
                  {sendMsg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-gray-900">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Select a conversation</p>
                <p className="text-sm text-gray-400 mt-1">or wait for incoming messages</p>
              </div>
            </div>
          )}

          {/* Right panel — contact info when selected */}
          {selectedContact && (
            <div className="w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
              <div className="p-4 text-center border-b border-gray-100 dark:border-gray-700">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
                  {(selectedContact.name || selectedContact.wa_id)[0].toUpperCase()}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{selectedContact.name || selectedContact.wa_id}</p>
                <p className="text-xs text-gray-400">{selectedContact.phone}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {selectedContact.is_qualified && (
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Qualified</span>
                  )}
                  <ScoreBadge score={selectedContact.lead_score} />
                </div>
              </div>

              <div className="p-4 space-y-4">
                {selectedContact.qualification_notes && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">AI Notes</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{selectedContact.qualification_notes}</p>
                  </div>
                )}

                {selectedContact.suggested_action && selectedContact.suggested_action !== 'none' && (
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3">
                    <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide mb-1">Suggested Action</p>
                    <p className="text-xs text-orange-700 dark:text-orange-400 capitalize">{selectedContact.suggested_action.replace(/_/g, ' ')}</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Quick Actions</p>
                  <div className="space-y-1.5">
                    {[
                      { type: 'proposal' as const, label: 'Send Proposal', icon: FileText, color: 'text-blue-600' },
                      { type: 'invoice' as const, label: 'Send Invoice', icon: CreditCard, color: 'text-purple-600' },
                      { type: 'site_preview' as const, label: 'Send Site Preview', icon: Globe, color: 'text-green-600' },
                    ].map(({ type, label, icon: Icon, color }) => (
                      <button key={type}
                        onClick={() => { setQuickSendForm(f => ({ ...f, type })); setShowQuickSend(true) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                        <Icon className={clsx('w-3.5 h-3.5', color)} />
                        <span className="text-gray-700 dark:text-gray-200">{label}</span>
                        <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <label className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">Opt-in status</span>
                    <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full',
                      selectedContact.opt_in ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {selectedContact.opt_in ? 'Opted In' : 'Opted Out'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Templates Tab ── */}
      {tab === 'templates' && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Reusable message templates for proposals, follow-ups, and broadcasts</p>
            <div className="flex gap-2">
              <button onClick={() => aiTemplate.mutate()} disabled={aiTemplate.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-green-500 text-green-600 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50">
                {aiTemplate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} AI Generate
              </button>
              <button onClick={() => setShowTemplateForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-600 text-white rounded-xl hover:bg-green-700">
                <Plus className="w-3.5 h-3.5" /> New Template
              </button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <p className="text-sm text-gray-400 mt-1">Create reusable templates for common messages</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {templates.map(t => {
                const statusColor = t.status === 'approved' ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : t.status === 'rejected' ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                  : t.status === 'pending' ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'text-gray-600 bg-gray-100 dark:bg-gray-700'
                return (
                  <div key={t.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{t.category}</span>
                          <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize', statusColor)}>{t.status}</span>
                        </div>
                      </div>
                      <button onClick={() => deleteTemplate.mutate(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {t.header_text && <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">{t.header_text}</p>}
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{t.body_text}</p>
                    {t.footer_text && <p className="text-[10px] text-gray-400 mt-1">{t.footer_text}</p>}
                    {t.buttons && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {JSON.parse(t.buttons).map((b: { text: string }, i: number) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">{b.text}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] text-gray-400">Used {t.use_count}×</span>
                      <span className="text-[10px] text-gray-400">{t.language.toUpperCase()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Broadcasts Tab ── */}
      {tab === 'broadcasts' && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Send bulk messages to your opted-in contact list</p>
            <button onClick={() => setShowBroadcastForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-600 text-white rounded-xl hover:bg-green-700">
              <Plus className="w-3.5 h-3.5" /> New Broadcast
            </button>
          </div>

          {broadcasts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No broadcasts yet</p>
              <p className="text-sm text-gray-400 mt-1">Reach your entire contact list in one click</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map(b => {
                const statusCfg = {
                  draft:   { color: 'text-gray-600 bg-gray-100', label: 'Draft' },
                  sending: { color: 'text-yellow-600 bg-yellow-50', label: 'Sending…' },
                  sent:    { color: 'text-green-600 bg-green-50', label: 'Sent' },
                  failed:  { color: 'text-red-600 bg-red-50', label: 'Failed' },
                }[b.status]
                return (
                  <div key={b.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{b.name}</h3>
                          <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusCfg.color)}>{statusCfg.label}</span>
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full capitalize">{b.target_filter}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{b.message_body}</p>
                        {b.status === 'sent' && (
                          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            {[
                              { label: 'Recipients', value: b.recipient_count },
                              { label: 'Sent', value: b.sent_count },
                              { label: 'Delivered', value: b.delivered_count },
                              { label: 'Failed', value: b.failed_count },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p className="text-[10px] text-gray-400">{label}</p>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {b.status === 'draft' && (
                          <button onClick={() => sendBroadcast.mutate(b.id)} disabled={sendBroadcast.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
                            <Send className="w-3 h-3" /> Send
                          </button>
                        )}
                        <button onClick={() => deleteBroadcast.mutate(b.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Setup Tab ── */}
      {tab === 'setup' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-2xl space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">WhatsApp Business API Setup</h2>
              </div>

              <div className={clsx('rounded-xl p-4 text-sm', stats?.configured ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400')}>
                {stats?.configured ? '✅ WhatsApp Business API is connected and ready.' : '⚠️ WhatsApp Business API is not configured. Follow the steps below.'}
              </div>

              <ol className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                {[
                  { n: 1, title: 'Create a Meta Business Account', desc: 'Go to business.facebook.com and create or use an existing business account.' },
                  { n: 2, title: 'Set up WhatsApp Business App', desc: 'In Meta for Developers, create a new app → WhatsApp product → add a phone number.' },
                  { n: 3, title: 'Get your credentials', desc: 'Copy your Phone Number ID and generate a permanent Access Token from the API settings.' },
                  { n: 4, title: 'Configure environment variables', desc: 'Add to your backend .env file:', code: `WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id\nWHATSAPP_ACCESS_TOKEN=your_permanent_token\nWHATSAPP_VERIFY_TOKEN=myworker_wh_verify_2024\nWHATSAPP_APP_SECRET=your_app_secret\nWHATSAPP_AUTO_REPLY=true` },
                  { n: 5, title: 'Register the webhook in Meta', desc: 'In Meta Developer Console → WhatsApp → Configuration, set the Webhook URL to:', code: `https://your-domain.com/api/v1/whatsapp/webhook\nVerify Token: myworker_wh_verify_2024` },
                  { n: 6, title: 'Subscribe to webhook fields', desc: 'Enable: messages, message_status, messaging_referrals' },
                ].map(({ n, title, desc, code }) => (
                  <li key={n} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold flex items-center justify-center">{n}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                      {code && (
                        <pre className="mt-2 bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{code}</pre>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Test with Demo Mode</h3>
              <p className="text-xs text-gray-500">Without WhatsApp configured, the system still saves conversations and AI replies — they just won't be delivered via WhatsApp. You can add test contacts manually.</p>
              <button onClick={() => setShowAddContact(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">
                <Plus className="w-3.5 h-3.5" /> Add Test Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Send Modal ── */}
      {showQuickSend && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Quick Send</h3>
              <button onClick={() => setShowQuickSend(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={quickSendForm.type} onChange={e => setQuickSendForm(f => ({ ...f, type: e.target.value as typeof f.type }))} className={inp}>
                  <option value="proposal">Proposal</option>
                  <option value="invoice">Invoice</option>
                  <option value="site_preview">Site Preview</option>
                </select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Link</label>
                <input value={quickSendForm.link} onChange={e => setQuickSendForm(f => ({ ...f, link: e.target.value }))} placeholder="https://..." className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
                <textarea value={quickSendForm.note} onChange={e => setQuickSendForm(f => ({ ...f, note: e.target.value }))} rows={2} className={clsx(inp, 'resize-none')} /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowQuickSend(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => quickSend.mutate()} disabled={!quickSendForm.link || quickSend.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60">
                {quickSend.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Form Modal ── */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">New Template</h3>
              <button onClick={() => setShowTemplateForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Template Name</label>
                  <input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="proposal_follow_up" className={inp} /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select value={templateForm.category} onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Header (optional)</label>
                <input value={templateForm.header_text} onChange={e => setTemplateForm(f => ({ ...f, header_text: e.target.value }))} placeholder="Your proposal is ready!" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Body *</label>
                <textarea value={templateForm.body_text} onChange={e => setTemplateForm(f => ({ ...f, body_text: e.target.value }))} rows={5} placeholder="Hi {{name}}, your proposal for {{service}} is ready. Click the link to review: {{link}}" className={clsx(inp, 'resize-none')} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Footer (optional)</label>
                <input value={templateForm.footer_text} onChange={e => setTemplateForm(f => ({ ...f, footer_text: e.target.value }))} placeholder="Reply STOP to opt out" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Variables (comma separated)</label>
                <input value={templateForm.variables} onChange={e => setTemplateForm(f => ({ ...f, variables: e.target.value }))} placeholder="name, service, link" className={inp} /></div>

              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">AI Quick Generate</p>
                <div className="flex gap-2">
                  <input value={aiTemplateForm.purpose} onChange={e => setAiTemplateForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. follow up after sending proposal" className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={() => aiTemplate.mutate()} disabled={!aiTemplateForm.purpose || aiTemplate.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {aiTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Generate
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowTemplateForm(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => createTemplate.mutate()} disabled={!templateForm.name || !templateForm.body_text || createTemplate.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60">
                {createTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Form Modal ── */}
      {showBroadcastForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">New Broadcast</h3>
              <button onClick={() => setShowBroadcastForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Broadcast Name</label>
                <input value={broadcastForm.name} onChange={e => setBroadcastForm(f => ({ ...f, name: e.target.value }))} placeholder="April Promo Blast" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Target Audience</label>
                <select value={broadcastForm.target_filter} onChange={e => setBroadcastForm(f => ({ ...f, target_filter: e.target.value }))} className={inp}>
                  <option value="all">All Contacts</option>
                  <option value="qualified">Qualified Leads Only</option>
                  <option value="unqualified">Unqualified (Nurture)</option>
                </select></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Message</label>
                  <button onClick={() => aiBroadcast.mutate({ goal: broadcastForm.name, audience: broadcastForm.target_filter })} disabled={aiBroadcast.isPending || !broadcastForm.name}
                    className="flex items-center gap-1 text-[10px] font-medium text-green-600 hover:text-green-700 disabled:opacity-50">
                    {aiBroadcast.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} AI Write
                  </button>
                </div>
                <textarea value={broadcastForm.message_body} onChange={e => setBroadcastForm(f => ({ ...f, message_body: e.target.value }))} rows={5} placeholder="Type your message or use AI Write…" className={clsx(inp, 'resize-none')} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowBroadcastForm(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => createBroadcast.mutate()} disabled={!broadcastForm.name || !broadcastForm.message_body || createBroadcast.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60">
                {createBroadcast.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Contact Modal ── */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add Test Contact</h3>
              <button onClick={() => setShowAddContact(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">WhatsApp Number (E.164)</label>
                <input value={addContactForm.wa_id} onChange={e => setAddContactForm(f => ({ ...f, wa_id: e.target.value }))} placeholder="+254700000000" className={inp} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Name</label>
                <input value={addContactForm.name} onChange={e => setAddContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" className={inp} /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddContact(false)} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  await axios.post(`${BASE}/contacts/manual`, { wa_id: addContactForm.wa_id, name: addContactForm.name })
                  qc.invalidateQueries({ queryKey: ['wa-contacts'] })
                  setShowAddContact(false)
                }}
                disabled={!addContactForm.wa_id}
                className="flex-1 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60">
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
