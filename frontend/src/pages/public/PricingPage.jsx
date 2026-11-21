import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { getCatalogItems } from '../../api/catalogItems.api'
import { getBranches } from '../../api/branches.api'
import { getPricingConfig } from '../../api/orders.api'
import { formatNaira } from '../../utils/formatters'
import { BRAND } from '../../constants/brand'

const SERVICES = [
  'Washing & Folding',
  'Washing & Ironing',
  'Ironing',
  'Dry Cleaning',
  'Dry Cleaning & Pressing',
]

const CATEGORIES = [
  'All',
  'Casuals',
  'Native & Traditional',
  'Corporate Wear',
  'Outerwear & Jackets',
  'Bedding & Household',
]

const ITEMS_PER_PAGE = 12

export default function PricingPage() {
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedService, setSelectedService] = useState('Washing & Folding')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpress, setIsExpress] = useState(false)
  const [expressPercent, setExpressPercent] = useState(30)
  const [catalogItems, setCatalogItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // 1. Fetch branches and pricing config
  useEffect(() => {
    getBranches()
      .then((res) => {
        const list = res.data?.data || []
        setBranches(list)
        if (list.length > 0) {
          setSelectedBranchId((prev) => prev || list[0]._id)
        }
      })
      .catch(() => setBranches([]))

    getPricingConfig()
      .then((res) => {
        const percent = res.data?.data?.express_surcharge_percent
        if (typeof percent === 'number') {
          setExpressPercent(percent)
        }
      })
      .catch(() => {})
  }, [])

  // 2. Fetch catalog items when branch changes
  useEffect(() => {
    if (!selectedBranchId) return
    let ignore = false
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true)
    })
    getCatalogItems({ branch_id: selectedBranchId })
      .then((res) => {
        if (!ignore) setCatalogItems(res.data?.data || [])
      })
      .catch(() => {
        if (!ignore) setCatalogItems([])
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [selectedBranchId])

  const handleServiceSelect = (svc) => {
    setSelectedService(svc)
    setPage(1)
  }

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat)
    setPage(1)
  }

  const handleBranchSelect = (id) => {
    setSelectedBranchId(id)
    setPage(1)
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  // Filter items by category, search, and map to ONE price for the selected service
  const processedItems = useMemo(() => {
    return catalogItems
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) {
          return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            item.name.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
          )
        }
        return true
      })
      .map((item) => {
        const servicePricing = (item.services || []).find(
          (s) =>
            s.service_name?.toLowerCase() === selectedService.toLowerCase() ||
            s.name?.toLowerCase() === selectedService.toLowerCase(),
        )

        const isAvailable = servicePricing ? servicePricing.is_available !== false : false
        const basePrice = servicePricing?.price || 0
        const calculatedPrice = isExpress
          ? Math.round(basePrice * (1 + expressPercent / 100))
          : basePrice

        return {
          ...item,
          servicePricing,
          isAvailable,
          basePrice,
          calculatedPrice,
        }
      })
  }, [catalogItems, selectedCategory, searchQuery, selectedService, isExpress, expressPercent])

  // Pagination slice
  const totalPages = Math.ceil(processedItems.length / ITEMS_PER_PAGE) || 1
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return processedItems.slice(start, start + ITEMS_PER_PAGE)
  }, [processedItems, page])

  const selectedBranch = branches.find((b) => b._id === selectedBranchId)

  return (
    <div className="bg-canvas min-h-screen text-slate-800 pb-20">
      {/* ---------- Hero & Search with Laundry Facility Imagery & Smooth Accents ---------- */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-24 sm:pb-28">
        {/* Background Picture with Laundry Garments on Hangers & Processing */}
        <picture className="absolute inset-0 size-full">
          <source srcSet="/images/hero-laundry-full.avif" type="image/avif" />
          <source srcSet="/images/hero-laundry-full.webp" type="image/webp" />
          <img
            src="/images/hero-laundry-full.jpg"
            alt="Swirl laundry garment service catalog and steam pressing racks"
            className="size-full object-cover object-center opacity-30 scale-105 transition-transform duration-1000 ease-out"
          />
        </picture>

        {/* Multi-stop Deep Indigo & Slate Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 via-slate-950/85 to-indigo-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/25 via-transparent to-transparent pointer-events-none" />

        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-10 right-1/4 size-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-10 left-10 size-60 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold text-indigo-200 backdrop-blur-md shadow-sm">
              <Sparkles className="size-3.5 text-indigo-300" />
              Transparent Per-Garment Pricing
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
              Price List & Service Catalog
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed">
              <span className="font-serif italic text-indigo-300 mr-2 font-normal">
                Fabric-first care.
              </span>
              Clear, upfront pricing with zero hidden fees by {BRAND.name}. Select a service and
              explore fixed rates across every garment type.
            </p>

            {/* Search Box in Hero with Frosted Glass & Smooth Focus Ring */}
            <div className="mt-8 relative max-w-xl mx-auto group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-indigo-300 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Search garments (e.g. Suit Jacket, Senator, Duvet, Silk Shirt)…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full rounded-2xl border border-white/25 bg-white/10 px-12 py-4 text-sm text-white placeholder-slate-300 backdrop-blur-xl outline-none focus:border-indigo-400 focus:bg-white/20 focus:ring-4 focus:ring-indigo-500/30 transition-all duration-300 shadow-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fancy organic wave edge transition to canvas */}
        <div className="absolute bottom-0 inset-x-0 h-6 sm:h-8 text-canvas pointer-events-none overflow-hidden z-20">
          <svg
            className="w-full h-full fill-current"
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
          >
            <path d="M0,24 C360,48 720,0 1080,24 C1260,36 1380,44 1440,48 L1440,48 L0,48 Z" />
          </svg>
        </div>
      </section>

      {/* ---------- Sticky Controls Bar ---------- */}
      <section className="border-b border-line bg-white/95 backdrop-blur-md sticky top-[64px] sm:top-[74px] z-30 shadow-xs py-4">
        <div className="mx-auto w-[92%] max-w-6xl flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Branch Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-4 text-indigo-600" /> Branch:
            </span>
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchSelect(e.target.value)}
              className="rounded-xl border border-line bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Standard / Express Surcharge Toggle */}
          <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setIsExpress(false)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                !isExpress
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard (48–72h)
            </button>
            <button
              type="button"
              onClick={() => setIsExpress(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                isExpress
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="size-3.5 fill-current" />
              Express 24h (+{expressPercent}%)
            </button>
          </div>
        </div>
      </section>

      {/* ---------- Main Content Container ---------- */}
      <div className="mx-auto w-[92%] max-w-6xl mt-8">
        {/* Service Selector (First) */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            1. Select Laundry Service
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((svc) => {
              const active = selectedService === svc
              return (
                <button
                  key={svc}
                  type="button"
                  onClick={() => handleServiceSelect(svc)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/20'
                      : 'border border-line bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                  }`}
                >
                  {active && <Check className="size-3.5" />}
                  <span>{svc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mb-8 border-b border-line pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            2. Filter by Clothing Category
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-line text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Corporate Wear Banner */}
        {selectedCategory === 'Corporate Wear' && (
          <div className="relative mb-10 overflow-hidden rounded-3xl border border-indigo-200 shadow-md">
            <picture className="absolute inset-0 size-full">
              <source srcSet="/images/corporate-wear-suits.avif" type="image/avif" />
              <source srcSet="/images/corporate-wear-suits.webp" type="image/webp" />
              <img
                src="/images/hero-laundry-full.jpg"
                alt="Executive corporate suits and business blazers steam pressing care"
                className="size-full object-cover"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-transparent" />
            <div className="relative z-10 max-w-xl p-8 sm:p-10 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 px-3 py-1 text-[11px] font-bold text-indigo-300">
                <ShieldCheck className="size-3.5" /> Corporate Wardrobe Program
              </span>
              <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">
                Executive Suits & Corporate Tailoring
              </h3>
              <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                Form-preserving dry cleaning, collar & cuff detailing, and structured steam
                finishing for shirts, blazers, and trousers.
              </p>
            </div>
          </div>
        )}

        {/* Catalog Items Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 py-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-line bg-white p-6 h-48"
              />
            ))}
          </div>
        ) : processedItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">
            <Droplets className="size-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-lg font-bold text-slate-900">No items found</h4>
            <p className="mt-1 text-sm text-slate-500">
              No garments matching "{searchQuery || selectedCategory}" available for this branch.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('All')
              }}
              className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-500">
                Showing {processedItems.length} garments for{' '}
                <span className="font-bold text-slate-900">{selectedService}</span>
                {isExpress && (
                  <span className="text-indigo-600 font-bold ml-1">(Express Rate Applied)</span>
                )}
              </p>
              <p className="text-xs text-slate-400">
                Branch: {selectedBranch?.name || 'Selected branch'}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedItems.map((item) => {
                return (
                  <article
                    key={item._id}
                    className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-xs transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          {item.category}
                        </span>
                        {item.piece_count > 1 && (
                          <span className="text-[10.5px] font-semibold text-slate-400">
                            {item.piece_count} pcs
                          </span>
                        )}
                      </div>

                      {/* Full name visible without truncation */}
                      <h3 className="mt-3 text-base font-extrabold text-slate-900 leading-snug">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 border-t border-line/80 pt-4 flex items-end justify-between">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {selectedService}
                        </span>
                        {item.isAvailable ? (
                          <span className="font-mono text-xl font-black text-indigo-700">
                            {formatNaira(item.calculatedPrice)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 italic">
                            Service Unavailable
                          </span>
                        )}
                      </div>

                      {item.isAvailable && (
                        <Link
                          to="/order"
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition"
                        >
                          Book <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
                <p className="text-xs text-slate-500">
                  Page {page} of {totalPages} ({processedItems.length} total garments)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Next <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
