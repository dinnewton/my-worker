import { useState } from 'react'
import { X, Send, Loader2, CheckCircle, ClipboardList } from 'lucide-react'
import { clsx } from 'clsx'
import { useSendRequirements, useWebsiteRequirements } from '../../hooks/useWebsites'

const DESIGN_STYLES = [
  { value: 'minimal', label: 'Minimal', desc: 'Clean, lots of whitespace' },
  { value: 'modern', label: 'Modern', desc: 'Bold, contemporary' },
  { value: 'classic', label: 'Classic', desc: 'Traditional, professional' },
  { value: 'bold', label: 'Bold', desc: 'Vibrant, expressive' },
  { value: 'corporate', label: 'Corporate', desc: 'Formal, enterprise' },
]

interface Props {
  siteId: number
  siteName: string
  clientEmail: string | null
  onClose: () => void
}

export function RequirementsModal({ siteId, siteName, clientEmail, onClose }: Props) {
  const { data: reqs = [] } = useWebsiteRequirements(siteId)
  const sendRequirements = useSendRequirements()
  const [sent, setSent] = useState(false)

  const latestReq = reqs[0] ?? null
  const isSubmitted = latestReq?.submitted_at != null

  async function handleSend() {
    await sendRequirements.mutateAsync(siteId)
    setSent(true)
  }

  const inp = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Client Requirements Intake</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          <div className={clsx(
            'rounded-xl p-4 border',
            isSubmitted
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : latestReq
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600',
          )}>
            <p className={clsx('text-sm font-medium', isSubmitted ? 'text-green-700 dark:text-green-300' : latestReq ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-600 dark:text-gray-300')}>
              {isSubmitted ? '✓ Requirements submitted by client' : latestReq ? '⏳ Awaiting client submission' : 'Not yet sent'}
            </p>
            {latestReq && (
              <p className="text-xs text-gray-500 mt-1">
                Intake link sent · Token: {latestReq.intake_token.slice(0, 12)}…
              </p>
            )}
          </div>

          {/* Submitted requirements (read-only) */}
          {isSubmitted && latestReq && (
            <div className="space-y-3">
              {[
                { label: 'Design Style', value: latestReq.design_style },
                { label: 'Target Audience', value: latestReq.target_audience },
                { label: 'Color Preferences', value: latestReq.color_preferences },
                { label: 'Competitor URLs', value: latestReq.competitor_urls },
                { label: 'Reference Sites', value: latestReq.reference_sites },
                { label: 'Must-Have Features', value: latestReq.must_have_features },
                { label: 'Pages Needed', value: latestReq.pages_needed },
                { label: 'Deadline Notes', value: latestReq.deadline_notes },
                { label: 'Special Requests', value: latestReq.special_requests },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{value}</p>
                </div>
              ))}
              <div className="flex gap-4 pt-2">
                {[
                  { label: 'Content ready', value: latestReq.content_ready },
                  { label: 'Logo ready', value: latestReq.logo_ready },
                  { label: 'Images ready', value: latestReq.images_ready },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                      value ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400')}>
                      {value ? '✓' : '✗'}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send form */}
          {!latestReq && !sent && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Send your client a requirements intake form for <strong>{siteName}</strong>.
                They'll fill it out at their own pace and you'll be notified when it's submitted.
              </p>
              {clientEmail ? (
                <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl px-4 py-3">
                  <Send className="w-4 h-4 text-brand-500" />
                  <p className="text-sm text-brand-700 dark:text-brand-300">Will be sent to: <strong>{clientEmail}</strong></p>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
                  No client email on file. Add one in Settings before sending.
                </p>
              )}
            </div>
          )}

          {sent && (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700 dark:text-green-300">Intake form link sent to {clientEmail}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
            Close
          </button>
          {!latestReq && !sent && (
            <button
              onClick={handleSend}
              disabled={sendRequirements.isPending || !clientEmail}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-60">
              {sendRequirements.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Intake Form
            </button>
          )}
          {latestReq && !isSubmitted && (
            <button
              onClick={handleSend}
              disabled={sendRequirements.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-brand-600 text-brand-600 rounded-xl hover:bg-brand-50 disabled:opacity-60">
              {sendRequirements.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Resend Link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
