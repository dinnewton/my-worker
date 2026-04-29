import { useState, useRef, useEffect } from 'react'

type DrawEvent = {
  preventDefault(): void
  clientX: number; clientY: number
  touches?: { clientX: number; clientY: number }[]
}
import {
  X, Download, Send, CheckCircle,
  Zap, Loader2, DollarSign, Clock, Calendar, Copy, Check,
  Mail, PenLine, Trash2, RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import axios from 'axios'
import { useProposal, useUpdateProposalStatus, useDownloadPDF, useDeleteProposal } from '../../hooks/useProposals'
import type { ProposalSection, ProposalMilestone, PricingItem, ProposalStatus } from '../../types'

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}

// ── Canvas E-Signature ──────────────────────────────────────────────────────

function SignatureCanvas({ onSign, onCancel }: { onSign: (name: string, dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'draw' | 'type'>('draw')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: DrawEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches?.length) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: DrawEvent) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
    setDrawing(true)
  }

  function draw(e: DrawEvent) {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y); ctx.stroke()
    setHasStrokes(true)
  }

  function endDraw() { setDrawing(false) }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  function renderTypedSig(text: string) {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1e1b4b'
    ctx.font = 'italic 42px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  }

  function handleSign() {
    const canvas = canvasRef.current!
    if (mode === 'type' && name.trim()) renderTypedSig(name)
    onSign(name, canvas.toDataURL('image/png'))
  }

  const canSign = name.trim() && (mode === 'type' || hasStrokes)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PenLine className="w-4 h-4 text-brand-600" /> E-Sign Proposal
          </h3>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Legal Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe"
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div className="flex gap-2">
            {(['draw', 'type'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={clsx('flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors',
                  mode === m ? 'bg-brand-600 text-white' : 'border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700')}>
                {m === 'draw' ? 'Draw Signature' : 'Type Signature'}
              </button>
            ))}
          </div>

          {mode === 'draw' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">Draw your signature below</p>
                <button onClick={clear} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef} width={420} height={140}
                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-crosshair touch-none bg-white"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-2">Your typed signature</p>
              <canvas ref={canvasRef} width={420} height={140} className="hidden" />
              <div className="w-full h-[140px] border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center bg-white dark:bg-gray-700">
                <span className="text-4xl italic text-indigo-900 dark:text-indigo-300" style={{ fontFamily: 'Georgia, serif' }}>
                  {name || 'Your signature'}
                </span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 leading-relaxed">
            By signing you agree to the terms of this proposal. This digital signature is legally binding under the Electronic Signatures in Global and National Commerce Act (ESIGN).
          </p>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={handleSign} disabled={!canSign}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50">
            <CheckCircle className="w-4 h-4" /> Sign & Accept
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const STATUS_ACTIONS: Partial<Record<ProposalStatus, { label: string; to: ProposalStatus; color: string }[]>> = {
  draft:  [{ label: 'Mark Sent',     to: 'sent',     color: 'bg-blue-600 hover:bg-blue-700' }],
  sent:   [
    { label: 'Mark Viewed',   to: 'viewed',   color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Mark Accepted', to: 'accepted', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Mark Rejected', to: 'rejected', color: 'bg-red-600 hover:bg-red-700' },
  ],
  viewed: [
    { label: 'Mark Accepted', to: 'accepted', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Mark Rejected', to: 'rejected', color: 'bg-red-600 hover:bg-red-700' },
  ],
}

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

interface Props { proposalId: number; onClose: () => void }

export function ProposalDetail({ proposalId, onClose }: Props) {
  const { data: proposal, isLoading } = useProposal(proposalId)
  const updateStatus = useUpdateProposalStatus()
  const downloadPDF  = useDownloadPDF()
  const deleteP      = useDeleteProposal()
  const { copied, copy } = useCopy()

  const [showSign, setShowSign]   = useState(false)
  const [signing, setSigning]     = useState(false)
  const [emailSending, setEmail]  = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  if (isLoading || !proposal) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      </>
    )
  }

  const sections: ProposalSection[]   = proposal.sections        ? JSON.parse(proposal.sections) : []
  const milestones: ProposalMilestone[] = proposal.timeline      ? JSON.parse(proposal.timeline) : []
  const deliverables: string[]          = proposal.deliverables  ? JSON.parse(proposal.deliverables) : []
  const pricing: PricingItem[]          = proposal.pricing_breakdown ? JSON.parse(proposal.pricing_breakdown) : []
  const winTips: string[]               = proposal.ai_win_tips   ? JSON.parse(proposal.ai_win_tips) : []
  const actions = STATUS_ACTIONS[proposal.status as ProposalStatus] ?? []
  const shareUrl = `${window.location.origin}/proposals/share/${proposal.share_token}`

  async function handleSendEmail() {
    setEmail(true)
    try {
      await axios.post(`/api/v1/proposals/${proposal.id}/send-email`)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch { /* noop */ }
    setEmail(false)
  }

  async function handleSign(signerName: string) {
    setSigning(true)
    try {
      await axios.post(`/api/v1/proposals/share/${proposal.share_token}/sign`, { signature_name: signerName })
      updateStatus.mutate({ id: proposal.id, status: 'accepted' })
    } catch { /* noop */ }
    setSigning(false)
    setShowSign(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this proposal permanently?')) return
    await deleteP.mutateAsync(proposal.id)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-900 dark:text-white text-base leading-snug">{proposal.title}</h2>
              <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_COLORS[proposal.status as ProposalStatus])}>
                {proposal.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {proposal.client_name}{proposal.client_company ? ` · ${proposal.client_company}` : ''}
              {proposal.client_email && <span className="ml-2 text-xs text-gray-400">({proposal.client_email})</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleDelete} disabled={deleteP.isPending}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          {proposal.value > 0 && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ${proposal.value >= 1000 ? `${(proposal.value / 1000).toFixed(1)}k` : proposal.value.toFixed(0)}
              </span>
              {proposal.monthly_retainer > 0 && (
                <span className="text-xs text-gray-400">+ ${proposal.monthly_retainer.toLocaleString()}/mo</span>
              )}
            </div>
          )}
          {proposal.timeline_weeks > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{proposal.timeline_weeks} weeks</span>
            </div>
          )}
          {proposal.valid_until && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Valid until {format(new Date(proposal.valid_until), 'MMM d, yyyy')}
              </span>
            </div>
          )}
          {proposal.signature_name && (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">
                Signed by {proposal.signature_name}
                {proposal.signature_date && ` on ${format(new Date(proposal.signature_date), 'MMM d')}`}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <button
            onClick={() => downloadPDF.mutate({ id: proposal.id, clientName: proposal.client_name })}
            disabled={downloadPDF.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            {downloadPDF.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>

          <button onClick={() => copy(shareUrl)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Share Link'}
          </button>

          {proposal.client_email && (
            <button onClick={handleSendEmail} disabled={emailSending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-200 dark:border-blue-700 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Mail className="w-3.5 h-3.5" />}
              {emailSent ? 'Sent!' : 'Email Client'}
            </button>
          )}

          {proposal.status !== 'accepted' && proposal.status !== 'rejected' && (
            <button onClick={() => setShowSign(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-brand-200 dark:border-brand-700 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20">
              <PenLine className="w-3.5 h-3.5" /> E-Sign
            </button>
          )}

          {actions.map((action) => (
            <button key={action.to}
              onClick={() => updateStatus.mutate({ id: proposal.id, status: action.to })}
              disabled={updateStatus.isPending}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60', action.color)}>
              <Send className="w-3.5 h-3.5" /> {action.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {proposal.cover_letter && (
            <section>
              <h3 className="text-xs font-bold text-brand-600 uppercase tracking-wide mb-3">Cover Letter</h3>
              {proposal.cover_letter.split('\n\n').map((p, i) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{p}</p>
              ))}
            </section>
          )}

          {sections.map((sec, i) => (
            <section key={i}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 pb-1 border-b border-gray-100 dark:border-gray-800">{sec.heading}</h3>
              {sec.content.split('\n\n').map((p, j) => (
                <p key={j} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">{p}</p>
              ))}
            </section>
          ))}

          {deliverables.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 pb-1 border-b border-gray-100 dark:border-gray-800">Deliverables</h3>
              <ul className="space-y-1.5">
                {deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />{d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {milestones.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">Project Timeline</h3>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-full flex-shrink-0 mt-0.5 min-w-[60px] text-center">{m.week}</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{m.milestone}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pricing.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">Investment</h3>
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {pricing.map((item, i) => (
                  <div key={i} className={clsx('flex items-center justify-between px-4 py-3 text-sm',
                    i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800')}>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.item}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">
                      {item.price > 0 ? `$${item.price.toLocaleString()}` : 'Included'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white">
                  <span className="font-bold">Total Investment</span>
                  <span className="font-bold text-lg">${proposal.value.toLocaleString()}</span>
                </div>
              </div>
            </section>
          )}

          {winTips.length > 0 && (
            <section className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800">
              <h3 className="text-xs font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5 mb-3">
                <Zap className="w-3.5 h-3.5" /> AI Tips to Win This Deal
              </h3>
              {winTips.map((tip, i) => (
                <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300 py-0.5">{i + 1}. {tip}</p>
              ))}
            </section>
          )}
        </div>
      </div>

      {showSign && (
        <SignatureCanvas
          onSign={(name) => handleSign(name)}
          onCancel={() => setShowSign(false)}
        />
      )}
    </>
  )
}
