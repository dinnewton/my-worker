import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Content } from './pages/Content'
import { Leads } from './pages/Leads'
import { Proposals } from './pages/Proposals'

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
            <Route path="/websites" element={<Placeholder name="Websites" />} />
            <Route path="/campaigns" element={<Placeholder name="Campaigns" />} />
            <Route path="/email" element={<Placeholder name="Email" />} />
            <Route path="/seo" element={<Placeholder name="SEO" />} />
            <Route path="/settings" element={<Placeholder name="Settings" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
