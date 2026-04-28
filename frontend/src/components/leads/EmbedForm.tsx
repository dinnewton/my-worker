import { useState } from 'react'
import { Copy, Check, Code, ExternalLink, Globe } from 'lucide-react'
import { clsx } from 'clsx'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:8000'

function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), timeout)
  }
  return { copied, copy }
}

const EMBED_SNIPPET = (backendUrl: string) => `<!-- MyWorker Lead Capture Form -->
<div id="myworker-form"></div>
<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${backendUrl}/api/v1/leads/embed/form';
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '480px';
  iframe.allow = 'same-origin';
  iframe.onload = function() {
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'mw-resize') {
        iframe.style.minHeight = e.data.height + 'px';
      }
    });
  };
  document.getElementById('myworker-form').appendChild(iframe);
})();
</script>
<!-- End MyWorker Lead Capture Form -->`

const REACT_SNIPPET = (backendUrl: string) => `import { useState } from 'react'

const BACKEND = '${backendUrl}'

export function LeadCaptureForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch(\`\${BACKEND}/api/v1/leads/embed/capture\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'website_form' }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return <p style={{ textAlign: 'center', padding: '2rem', color: '#16a34a' }}>
      ✅ Thanks! We'll be in touch soon.
    </p>
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px', margin: '0 auto' }}>
      <input required placeholder="Your Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
      <input type="email" required placeholder="Email *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
      <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
      <input placeholder="Company" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
      <textarea placeholder="Message" rows={3} value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Get in Touch'}
      </button>
      {status === 'error' && <p style={{ color: 'red', fontSize: '0.875rem' }}>Something went wrong. Please try again.</p>}
    </form>
  )
}`

const API_SNIPPET = (backendUrl: string) => `// Direct API call — backend handles scoring, tasks, and notifications automatically

const response = await fetch('${backendUrl}/api/v1/leads/embed/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Jane Smith',          // required
    email: 'jane@example.com',   // optional
    phone: '+1 555 123 4567',    // optional
    company: 'Acme Corp',        // optional
    industry: 'Technology',      // optional
    website: 'https://acme.com', // optional
    location: 'New York, USA',   // optional
    message: 'Interested in...',  // optional — saved to notes
    source: 'website_form',      // optional — defaults to website_form
  }),
})

const lead = await response.json()
// lead.id, lead.score, lead.ai_summary, lead.ai_next_action are returned`

type SnippetType = 'iframe' | 'react' | 'api'

export function EmbedForm() {
  const [snippetType, setSnippetType] = useState<SnippetType>('iframe')
  const { copied, copy } = useClipboard()

  const snippets: Record<SnippetType, { label: string; lang: string; code: string }> = {
    iframe: { label: 'HTML / iFrame', lang: 'html', code: EMBED_SNIPPET(BACKEND_URL) },
    react:  { label: 'React Component', lang: 'tsx', code: REACT_SNIPPET(BACKEND_URL) },
    api:    { label: 'API / Fetch', lang: 'js', code: API_SNIPPET(BACKEND_URL) },
  }

  const active = snippets[snippetType]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Info Banner */}
      <div className="bg-brand-50 dark:bg-brand-900/20 rounded-2xl p-5 border border-brand-100 dark:border-brand-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-brand-100 dark:bg-brand-800 rounded-xl">
            <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Embeddable Lead Capture Form</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
              Drop this snippet onto any website to capture leads directly into your CRM.
              Each submission is automatically scored by AI, tasks are generated, and you're notified in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Callouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { emoji: '🤖', title: 'Auto AI Scoring', desc: 'Every submission is scored 0–100 instantly' },
          { emoji: '✅', title: 'Auto Tasks', desc: 'Follow-up tasks generated automatically' },
          { emoji: '⚡', title: 'Real-time Alerts', desc: 'Dashboard updates the moment a lead arrives' },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-2xl mb-1.5">{emoji}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Snippet Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          {(Object.keys(snippets) as SnippetType[]).map((key) => (
            <button key={key} onClick={() => setSnippetType(key)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
                snippetType === key
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}>
              <Code className="w-3.5 h-3.5" />
              {snippets[key].label}
            </button>
          ))}
          <div className="ml-auto flex items-center px-4">
            <span className="text-xs text-gray-400 font-mono">.{active.lang}</span>
          </div>
        </div>

        {/* Code Block */}
        <div className="relative">
          <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 font-mono max-h-[420px] overflow-y-auto">
            {active.code}
          </pre>
          <button
            onClick={() => copy(active.code)}
            className={clsx(
              'absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              copied
                ? 'bg-green-500 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400',
            )}>
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
      </div>

      {/* Endpoint Info */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Endpoints</h4>
        <div className="space-y-2">
          {[
            { method: 'POST', path: '/api/v1/leads/embed/capture', desc: 'Submit a new lead (no auth required)' },
            { method: 'GET',  path: '/api/v1/leads/embed/form',    desc: 'Serve embeddable HTML form page' },
          ].map(({ method, path, desc }) => (
            <div key={path} className="flex items-center gap-3 text-sm">
              <span className={clsx(
                'text-[10px] font-bold px-2 py-0.5 rounded font-mono',
                method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              )}>
                {method}
              </span>
              <code className="text-gray-600 dark:text-gray-400 font-mono text-xs flex-1">{path}</code>
              <span className="text-gray-500 dark:text-gray-500 text-xs hidden sm:block">{desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Backend URL: </span>
            <code className="font-mono text-brand-600 dark:text-brand-400">{BACKEND_URL}</code>
            <a href={`${BACKEND_URL}/docs`} target="_blank" rel="noreferrer"
              className="ml-3 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
              API Docs <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Integration Steps</h4>
        <ol className="space-y-2">
          {[
            'Copy the snippet above that matches your tech stack',
            'Paste it into your website HTML, React component, or call the API directly',
            'Leads submitted appear instantly in the Pipeline board',
            'AI scoring and task generation happen automatically within seconds',
            "You'll see a real-time notification in the dashboard activity feed",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
