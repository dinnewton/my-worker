import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Content } from './pages/Content'
import { Leads } from './pages/Leads'
import { Proposals } from './pages/Proposals'
import { Websites } from './pages/Websites'
import { Email } from './pages/Email'
import { SEO } from './pages/SEO'
import { Campaigns } from './pages/Campaigns'
import { Settings } from './pages/Settings'
import { WhatsApp } from './pages/WhatsApp'
import { AgentBrain } from './pages/AgentBrain'
import { Invoices } from './pages/Invoices'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
})

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-lg font-medium">
      {name} — Coming Soon
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/content" element={<Content />} />
            <Route path="/websites" element={<Websites />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/email" element={<Email />} />
            <Route path="/seo" element={<SEO />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/agent" element={<AgentBrain />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
