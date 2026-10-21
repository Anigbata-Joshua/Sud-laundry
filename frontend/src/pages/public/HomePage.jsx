import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Calculator,
  Check,
  Clock,
  Droplets,
  Flame,
  Layers,
  MapPin,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react'
import { getServices } from '../../api/services.api'
import { getBranches } from '../../api/branches.api'
import { formatNaira } from '../../utils/formatters'

// All available services from backend seeder (backend/src/seeders/service.seeder.js)
const SEEDER_SERVICES = [
  {
    _id: 'washing',
    name: 'Washing',
    category: 'Laundry',
    price: 1000,
    turnaround_hours: 72,
    blurb: 'Deep wash cycle for everyday clothing, bed linens and towels.',
  },
  {
    _id: 'wash-iron',
    name: 'Washing & Ironing',
    category: 'Laundry',
    price: 1500,
    turnaround_hours: 72,
    blurb: 'Full wash cycle finished with crisp steam ironing ready for your closet.',
  },
  {
    _id: 'wash-fold',
    name: 'Washing & Folding',
    category: 'Laundry',
    price: 1300,
    turnaround_hours: 72,
    blurb: 'Washed, dried, and neatly bundled into stacked folded packs.',
  },
  {
    _id: 'ironing',
    name: 'Ironing',
    category: 'Laundry',
    price: 800,
    turnaround_hours: 24,
    blurb: 'Wrinkle-free hand steam pressing for shirts, trousers and suits.',
  },
  {
    _id: 'dry-cleaning',
    name: 'Dry Cleaning',
    category: 'Dry Cleaning',
    price: 2500,
    turnaround_hours: 48,
    blurb: 'Gentle solvent care for blazers, gowns, silks and delicate fabrics.',
  },
  {
    _id: 'dry-clean-press',
    name: 'Dry Cleaning & Pressing',
    category: 'Dry Cleaning',
    price: 3000,
    turnaround_hours: 48,
    blurb: 'Delicate dry cleaning followed by structured hand pressing.',
  },
  {
    _id: 'stain-removal',
    name: 'Stain Removal',
    category: 'Specialty',
    price: 500,
    turnaround_hours: 24,
    blurb: 'Targeted enzyme pre-treatment for tough food, wine and grease marks.',
  },
  {
    _id: 'duvet-cleaning',
    name: 'Duvet Cleaning',
    category: 'Household',
    price: 3000,
    turnaround_hours: 72,
    blurb: 'Sanitizing large-drum hygiene wash and fluff drying for heavy duvets.',
  },
  {
    _id: 'curtain-cleaning',
    name: 'Curtain Cleaning',
    category: 'Household',
    price: 3500,
    turnaround_hours: 72,
    blurb: 'Dust mite removal and fabric-safe steam revitalization for drapes.',
  },
  {
    _id: 'carpet-rug',
    name: 'Carpet & Rug Cleaning',
    category: 'Household',
    price: 4000,
    turnaround_hours: 72,
    blurb: 'Deep fiber washing, spot treatment and fresh odor neutralizer.',
  },
  {
    _id: 'shoe-cleaning',
    name: 'Shoe Cleaning',
    category: 'Specialty',
    price: 2000,
    turnaround_hours: 48,
    blurb: 'Detailed sneaker and leather footwear cleansing and conditioning.',
  },
  {
    _id: 'perfume-fragrance',
    name: 'Perfume / Fragrance',
    category: 'Finishing',
    price: 300,
    turnaround_hours: 12,
    blurb: 'Long-lasting luxury fabric mist infused into your clean textiles.',
  },
  {
    _id: 'special-packaging',
    name: 'Special Packaging',
    category: 'Finishing',
    price: 500,
    turnaround_hours: 12,
    blurb: 'Protective dust-proof garment bags and hanger boxes for travel.',
  },
]

function iconForService(service = {}) {
  const name = (service.name || '').toLowerCase()
  const category = (service.category || '').toLowerCase()
  if (name.includes('iron') || name.includes('press')) return Flame
  if (name.includes('dry') || name.includes('silk') || name.includes('suit')) return Sparkles
  if (name.includes('stain') || category.includes('treatment')) return ShieldCheck
  if (
    category.includes('house') ||
    name.includes('duvet') ||
    name.includes('curtain') ||
    name.includes('carpet') ||
    name.includes('rug')
  ) {
    return Layers
  }
  if (name.includes('package') || name.includes('box')) return Package
  if (name.includes('shoe') || name.includes('perfume') || name.includes('fragrance')) {
    return Sparkles
  }
  return Droplets
}

const STATUS_PREVIEW = [
  { label: 'Picked up from doorstep', done: true },
  { label: 'Washing at Ikeja branch', done: true, current: true },
  { label: 'Quality inspection & press', done: false },
  { label: 'Delivered to you', done: false },
]

const STEPS = [
  {
    number: '01',
    title: 'Schedule a pickup',
    copy: 'Pick a branch, choose your services and a pickup window that works for you.',
  },
  {
    number: '02',
    title: 'We wash, dry and press',
    copy: 'Your garments are weighed, inspected, and moved through tailored wash and pressing programs.',
  },
  {
    number: '03',
    title: 'Track it and get it back',
    copy: 'Receive live notifications at every stage — collection, facility processing, and delivery.',
  },
]

const ESTIMATOR_ITEMS = [
  { id: 'shirts', name: 'Shirts & Tops', price: 1000, initial: 3, icon: Sparkles },
  { id: 'trousers', name: 'Trousers & Jeans', price: 1200, initial: 2, icon: Flame },
  { id: 'suits', name: 'Suits & Blazers', price: 2500, initial: 1, icon: ShieldCheck },
  { id: 'duvets', name: 'Duvets & Heavy Linens', price: 3000, initial: 0, icon: Layers },
]

const REVIEWS = [
  {
    name: 'Amaka O.',
    location: 'Lekki Phase 1, Lagos',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'I schedule a pickup before leaving for work and get a notification the moment it’s back on my doorstep. I haven’t set foot in a laundromat in months.',
    initials: 'AO',
  },
  {
    name: 'Tunde B.',
    location: 'Ikeja GRA, Lagos',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'The 24h express dry cleaning turnaround saved me for a weekend wedding. Crisp steam pressing and perfect packaging on suit jackets.',
    initials: 'TB',
  },
  {
    name: 'Zainab M.',
    location: 'Victoria Island, Lagos',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'Our duvets and heavy curtains come back smelling fresh without any chemical odor. Transparent pricing and exceptional customer care.',
    initials: 'ZM',
  },
]

export default function HomePage() {
  const [allServices, setAllServices] = useState(SEEDER_SERVICES)
  const [branchCount, setBranchCount] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [estimatorQuantities, setEstimatorQuantities] = useState(() =>
    ESTIMATOR_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: item.initial }), {}),
  )

  useEffect(() => {
    let active = true
    getServices({ is_active: true })
      .then((response) => {
        const items = response.data?.data ?? []
        if (active && items.length > 0) {
          const seen = new Set()
          const uniqueItems = []
          for (const item of items) {
            const key = item.name.trim().toLowerCase()
            if (!seen.has(key)) {
              seen.add(key)
              uniqueItems.push(item)
            }
          }
          const enriched = uniqueItems.map((item) => {
            const match = SEEDER_SERVICES.find(
              (s) => s.name.toLowerCase() === item.name.toLowerCase(),
            )
            return {
              ...item,
              icon: iconForService(item),
              blurb: item.blurb || match?.blurb || `${item.category} care by our team.`,
            }
          })
          setAllServices(enriched)
        }
      })
      .catch(() => {
        /* fallback to seeder */
      })

    getBranches()
      .then((response) => {
        if (active) setBranchCount(response.data?.data?.length ?? null)
      })
      .catch(() => {
        /* fallback */
      })

    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => {
    const set = new Set(allServices.map((s) => s.category || 'Other'))
    return ['All', ...Array.from(set)]
  }, [allServices])

  const filteredServices = useMemo(() => {
    if (activeCategory === 'All') return allServices
    return allServices.filter((s) => s.category === activeCategory)
  }, [allServices, activeCategory])

  const estimatorTotal = useMemo(() => {
    return ESTIMATOR_ITEMS.reduce((sum, item) => {
      const qty = estimatorQuantities[item.id] || 0
      return sum + qty * item.price
    }, 0)
  }, [estimatorQuantities])

  const estimatorTotalItems = useMemo(() => {
    return Object.values(estimatorQuantities).reduce((a, b) => a + b, 0)
  }, [estimatorQuantities])

  function updateEstimator(id, delta) {
    setEstimatorQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }))
  }

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-24 size-[32rem] rounded-full bg-sky-100/70 blur-3xl"
        />
        <div className="relative mx-auto grid w-[92%] max-w-6xl gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs backdrop-blur-sm">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Now scheduling pickups {branchCount ? `across ${branchCount} branches` : 'near you'}
            </p>
            <h1 className="mt-5 max-w-xl text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Laundry day, off your calendar.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Book a doorstep pickup in 60 seconds. Track each wash, delicate press, and delivery
              live from your device — zero queues, zero guesswork.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/order"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-sky-900/15 transition hover:bg-brand-hover active:scale-[0.98]"
              >
                Book a pickup
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#pricing-estimator"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Calculator className="size-4 text-brand" />
                Quick price estimator
              </a>
            </div>

            {/* High-trust badges strip */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-line pt-6">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <span className="grid size-6 place-items-center rounded-lg bg-sky-50 text-brand">
                  <Sparkles className="size-3.5" />
                </span>
                <span>Eco-Pure Care</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <span className="grid size-6 place-items-center rounded-lg bg-sky-50 text-brand">
                  <Clock className="size-3.5" />
                </span>
                <span>24h Express Available</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <span className="grid size-6 place-items-center rounded-lg bg-sky-50 text-brand">
                  <ShieldCheck className="size-3.5" />
                </span>
                <span>Care Guarantee</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                <span className="grid size-6 place-items-center rounded-lg bg-sky-50 text-brand">
                  <Truck className="size-3.5" />
                </span>
                <span>Doorstep Delivery</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Column with Glassmorphic Live Status Preview */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="animate-float-slow relative w-full">
              {/* Full hero image container */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-sky-100/60 bg-slate-900 shadow-2xl shadow-slate-900/15">
                <img
                  src="/images/hero-laundry-full.jpg"
                  alt="Crisp folded shirts, plush linens and laundry basket in a modern sunlit laundry space"
                  loading="eager"
                  fetchPriority="high"
                  className="size-full object-cover object-center transition-transform duration-700 ease-out hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-sky-950/40 via-transparent to-black/10" />

                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/50 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  Suds Fabric Care • 100% Eco-Pure
                </div>
              </div>

              {/* Enhanced Glassmorphic Live Status Card */}
              <div className="relative mt-4 w-full rounded-2xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-slate-950/10 backdrop-blur-xl sm:absolute sm:-bottom-8 sm:-left-6 sm:mt-0 sm:max-w-[19.5rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Live Tracking
                      </p>
                    </div>
                    <p className="font-mono text-sm font-extrabold text-ink">ORD-A93F2C</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand shadow-2xs">
                    <BellRing className="size-4" />
                  </span>
                </div>
                <ul className="mt-4 grid gap-2.5">
                  {STATUS_PREVIEW.map((step) => (
                    <li key={step.label} className="flex items-center gap-2.5 text-[12px]">
                      <span
                        className={`grid size-4.5 shrink-0 place-items-center rounded-full ${
                          step.done ? 'bg-brand text-white' : 'border-2 border-slate-200'
                        }`}
                      >
                        {step.done && <Check className="size-2.5 stroke-[3]" />}
                      </span>
                      <span
                        className={`truncate ${
                          step.current
                            ? 'font-extrabold text-brand'
                            : step.done
                              ? 'font-semibold text-ink'
                              : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50/80 p-2.5 text-[11px] font-semibold text-brand">
                  <span>Turnaround: Standard</span>
                  <span className="font-mono font-bold">24h remaining</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Services Catalog with Category Filter Pills ---------- */}
      <section id="services" className="border-t border-line bg-cream py-16 sm:py-24">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Service Catalog
              </p>
              <h2 className="mt-1 text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
                Every fabric, one drop-off.
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                From delicate silks and suits to everyday wash-and-fold and heavy duvets. Explore
                transparent pricing and quick turnaround windows.
              </p>
            </div>
            <div className="text-right">
              <Link
                to="/order"
                className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:text-brand-hover"
              >
                View booking options
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-8 flex flex-wrap gap-2 border-b border-line pb-4">
            {categories.map((cat) => {
              const count =
                cat === 'All'
                  ? allServices.length
                  : allServices.filter((s) => s.category === cat).length
              const active = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'bg-brand text-white shadow-sm shadow-sky-900/15'
                      : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Service Cards Grid */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredServices.map((service, index) => {
              const Icon = service.icon || Droplets
              return (
                <article
                  key={service._id || index}
                  className="animate-fade-up flex flex-col justify-between rounded-2xl border border-line bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-brand">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold tracking-wide text-slate-600">
                        {service.category}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-extrabold text-ink">{service.name}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted line-clamp-2">
                      {service.blurb}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">
                        Price
                      </span>
                      <span className="font-mono text-sm font-bold text-ink">
                        from {formatNaira(service.price)}
                      </span>
                    </div>
                    {service.turnaround_hours && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        <Clock className="size-3 text-brand" />
                        {service.turnaround_hours}hr
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Effortless Process
            </p>
            <h2 className="mt-1 text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
              From doorstep pickup to your closet in 3 steps
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              We eliminate the hassle of laundromat trips with door-to-door convenience.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="relative rounded-3xl border border-line bg-canvas/60 p-7 transition hover:border-sky-200 hover:bg-canvas"
              >
                <span className="font-mono text-xs font-black text-brand bg-sky-50 px-2.5 py-1 rounded-md">
                  Step {step.number}
                </span>
                <h3 className="mt-4 text-[17px] font-extrabold text-ink">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Quick Price Estimator Section ---------- */}
      <section
        id="pricing-estimator"
        className="border-t border-line bg-gradient-to-b from-white to-canvas py-16 sm:py-24"
      >
        <div className="mx-auto w-[92%] max-w-5xl">
          <div className="text-center max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 px-3.5 py-1 text-xs font-bold text-brand">
              <Calculator className="size-3.5" />
              Instant Cost Calculator
            </span>
            <h2 className="mt-3 text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
              Estimate your laundry costs
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Adjust quantities below to get an instant calculation before booking your pickup.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ESTIMATOR_ITEMS.map((item) => {
                const qty = estimatorQuantities[item.id] || 0
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-line bg-slate-50/50 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="grid size-8 place-items-center rounded-lg bg-sky-50 text-brand">
                          <Icon className="size-4" />
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {formatNaira(item.price)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-extrabold text-ink">{item.name}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        onClick={() => updateEstimator(item.id, -1)}
                        className="grid size-8 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:bg-slate-100 active:scale-95"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="font-mono text-sm font-bold text-ink">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => updateEstimator(item.id, 1)}
                        className="grid size-8 place-items-center rounded-lg border border-line bg-white text-slate-600 transition hover:bg-slate-100 active:scale-95"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Estimator Summary Bar */}
            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 sm:flex-row">
              <div>
                <p className="text-xs font-semibold text-slate-600">
                  Estimated Total ({estimatorTotalItems} items)
                </p>
                <p className="font-mono text-2xl font-black text-brand">
                  {formatNaira(estimatorTotal)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Includes professional washing, fabric softener and steam pressing.
                </p>
              </div>
              <Link
                to="/order"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-brand-hover active:scale-95"
              >
                Proceed to Book Pickup
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Verified Reviews Grid (Social Proof) ---------- */}
      <section className="py-16 sm:py-24 bg-white border-t border-line">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-xl mx-auto">
            <div className="flex justify-center gap-1 text-amber-400 mb-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
            </div>
            <h2 className="text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
              Loved by busy professionals
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Here is how Suds helps customers reclaim hours of their weekends.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {REVIEWS.map((rev) => (
              <div
                key={rev.name}
                className="flex flex-col justify-between rounded-3xl border border-line bg-canvas/40 p-6 shadow-2xs transition hover:border-sky-200 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: rev.stars }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-slate-700 italic">
                    "{rev.quote}"
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-line/80 pt-4">
                  <div className="grid size-9 place-items-center rounded-full bg-sky-100 font-mono text-xs font-extrabold text-brand">
                    {rev.initials}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-ink">{rev.name}</p>
                    <p className="text-[11px] text-slate-500">{rev.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="bg-ink py-16 sm:py-20 text-white">
        <div className="mx-auto flex w-[92%] max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
              Ready for a lighter laundry day?
            </h2>
            <p className="mt-2 max-w-md text-[14px] text-slate-400">
              Book your first collection in under a minute — no app store download required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-brand-hover active:scale-[0.98]"
            >
              Book a pickup
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <MapPin className="size-4" />
              Find a branch
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
