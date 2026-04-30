import { useState } from 'react'
import { DollarSign, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { clsx } from 'clsx'

const PACKAGES = [
  {
    name: 'Landing Page',
    emoji: '🚀',
    range: [300, 500],
    delivery: '3–5 days',
    desc: 'Single-page conversion-focused site perfect for campaigns, products, or services.',
    includes: ['1 page', 'Mobile responsive', 'Contact form', 'Basic SEO', '1 revision round'],
  },
  {
    name: 'Business Site',
    emoji: '🏢',
    range: [800, 1500],
    delivery: '7–14 days',
    desc: '5-page professional website covering all core business needs.',
    includes: ['5 pages', 'Mobile responsive', 'Contact form', 'SEO optimization', 'Google Analytics', '2 revision rounds'],
    popular: true,
  },
  {
    name: 'E-Commerce',
    emoji: '🛒',
    range: [2000, 5000],
    delivery: '14–21 days',
    desc: 'Full online store with product management, checkout, and payment integration.',
    includes: ['Up to 50 products', 'Shopping cart', 'Stripe/PayPal', 'Inventory management', 'SEO + Analytics', '3 revision rounds'],
  },
  {
    name: 'Custom Web App',
    emoji: '⚡',
    range: [5000, 999999],
    delivery: 'Custom timeline',
    desc: 'Fully custom web application with advanced features, API integrations, and bespoke functionality.',
    includes: ['Custom features', 'Database design', 'API integrations', 'Authentication', 'Admin panel', 'Unlimited revisions'],
  },
]

const ADDONS = [
  { label: 'Blog / CMS setup', price: 300 },
  { label: 'E-commerce product import (per 50)', price: 150 },
  { label: 'Multilingual (per language)', price: 400 },
  { label: 'Booking / Appointment system', price: 500 },
  { label: 'Custom forms & automation', price: 250 },
  { label: 'Live chat integration', price: 150 },
  { label: 'Membership / login area', price: 600 },
  { label: 'SEO content writing (per page)', price: 120 },
  { label: 'Monthly maintenance retainer', price: 150, recurring: true },
  { label: 'Hosting setup (annual)', price: 200 },
]

export function PricingCalculator() {
  const [selected, setSelected] = useState<number | null>(null)
  const [addons, setAddons] = useState<Set<number>>(new Set())
  const [showAddons, setShowAddons] = useState(false)
  const [pages, setPages] = useState(5)
  const [currency, setCurrency] = useState('USD')

  const FX: Record<string, number> = { USD: 1, KES: 130, EUR: 0.92, GBP: 0.79 }
  const fmt = (n: number) => Math.round(n * (FX[currency] ?? 1)).toLocaleString()
  const sym = { USD: '$', KES: 'KSh', EUR: '€', GBP: '£' }[currency] ?? '$'

  const baseMin = selected !== null ? PACKAGES[selected].range[0] : 0
  const baseMax = selected !== null ? (PACKAGES[selected].range[1] === 999999 ? 10000 : PACKAGES[selected].range[1]) : 0

  const extraPages = selected === 1 && pages > 5 ? (pages - 5) * 150 : 0

  const addonTotal = Array.from(addons).reduce((s, i) => s + ADDONS[i].price, 0)
  const totalMin = baseMin + extraPages + addonTotal
  const totalMax = baseMax + extraPages + addonTotal

  function toggleAddon(i: number) {
    setAddons(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-brand-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Website Pricing Calculator</h3>
        </div>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none">
          {Object.keys(FX).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="p-5 space-y-4">
        {/* Package selector */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Select Package</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PACKAGES.map((pkg, i) => (
              <button
                key={i}
                onClick={() => setSelected(i === selected ? null : i)}
                className={clsx(
                  'relative text-left rounded-xl border-2 p-4 transition-all',
                  selected === i
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-brand-300',
                )}>
                {pkg.popular && (
                  <span className="absolute top-2 right-2 text-[10px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                    Popular
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{pkg.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{pkg.name}</p>
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5">
                      {pkg.range[1] === 999999
                        ? `${sym}${fmt(pkg.range[0])}+`
                        : `${sym}${fmt(pkg.range[0])} – ${sym}${fmt(pkg.range[1])}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{pkg.delivery}</p>
                  </div>
                </div>
                {selected === i && (
                  <div className="mt-3 pt-3 border-t border-brand-200 dark:border-brand-700">
                    <ul className="space-y-1">
                      {pkg.includes.map((item, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <span className="text-brand-500">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Page count slider (Business tier) */}
        {selected === 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Number of Pages</p>
              <span className="text-sm font-bold text-brand-600">{pages}</span>
            </div>
            <input
              type="range" min={1} max={20} value={pages}
              onChange={e => setPages(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1</span><span>5 (base)</span><span>20</span>
            </div>
            {pages > 5 && (
              <p className="text-xs text-gray-500 mt-1">
                +{pages - 5} extra pages × {sym}{fmt(150)} = <span className="font-semibold text-brand-600">+{sym}{fmt(extraPages)}</span>
              </p>
            )}
          </div>
        )}

        {/* Add-ons */}
        <div>
          <button
            onClick={() => setShowAddons(v => !v)}
            className="flex items-center justify-between w-full text-xs font-medium text-gray-500 uppercase tracking-wide">
            Add-ons & Extras
            {showAddons ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAddons && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADDONS.map((addon, i) => (
                <label key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={addons.has(i)}
                    onChange={() => toggleAddon(i)}
                    className="accent-brand-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-200">{addon.label}</p>
                    <p className="text-[11px] font-semibold text-brand-600">
                      +{sym}{fmt(addon.price)}{addon.recurring ? '/mo' : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Total estimate */}
        {selected !== null && (
          <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl px-5 py-4 border border-brand-100 dark:border-brand-800">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5 text-brand-400" />
              <p className="text-xs text-brand-600 dark:text-brand-400">Project Estimate</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-brand-700 dark:text-brand-300">
                {sym}{fmt(totalMin)}
              </span>
              {totalMax !== totalMin && (
                <>
                  <span className="text-gray-400">–</span>
                  <span className="text-3xl font-black text-brand-700 dark:text-brand-300">
                    {PACKAGES[selected].range[1] === 999999 ? `${sym}${fmt(totalMin)}+` : `${sym}${fmt(totalMax)}`}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {PACKAGES[selected].name}
              {extraPages > 0 && ` · ${pages} pages`}
              {addons.size > 0 && ` · ${addons.size} add-on${addons.size > 1 ? 's' : ''}`}
            </p>
            <p className="text-[10px] text-gray-400 mt-2">
              Delivery: {PACKAGES[selected].delivery} · Estimate excludes domain & hosting costs
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
