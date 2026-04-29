import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/proposals': 'Proposals',
  '/content': 'Content',
  '/websites': 'Websites',
  '/campaigns': 'Campaigns',
  '/email': 'Email',
  '/seo': 'SEO',
  '/whatsapp': 'WhatsApp',
  '/settings': 'Settings',
}

export function Layout() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? 'MyWorker'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
