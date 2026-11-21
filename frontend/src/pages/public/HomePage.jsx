import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calculator,
  Clock,
  Flame,
  Layers,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { formatNaira } from '../../utils/formatters'
import { BRAND } from '../../constants/brand'

const STEPS = [
  {
    number: '01',
    title: 'Schedule a doorstep pickup',
    copy: 'Select your preferred branch, clothing services, and a convenient collection time window.',
  },
  {
    number: '02',
    title: 'Precision washing & steam press',
    copy: 'Garments are sorted by fabric type, pre-treated for stains, and processed with pure eco-friendly detergents.',
  },
  {
    number: '03',
    title: 'Live tracking & doorstep delivery',
    copy: 'Follow progress in real time — from collection to quality inspection, and back to your closet.',
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
    location: 'Gwarimpa, Abuja',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'I schedule a pickup before leaving for work and get a notification the moment it’s back on my doorstep. I haven’t set foot in a laundromat in months.',
    initials: 'AO',
  },
  {
    name: 'Tunde B.',
    location: 'Jabi Life Camp, Abuja',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'The 24h express dry cleaning turnaround saved me for a weekend wedding. Crisp steam pressing and perfect packaging on suit jackets.',
    initials: 'TB',
  },
  {
    name: 'Zainab M.',
    location: 'Garki Mall, Abuja',
    role: 'Verified Customer',
    stars: 5,
    quote:
      'Our duvets and heavy curtains come back smelling fresh without any chemical odor. Transparent pricing and exceptional customer care.',
    initials: 'ZM',
  },
]

export default function HomePage() {
  const [branchCount, setBranchCount] = useState(null)
  const [estimatorQuantities, setEstimatorQuantities] = useState(() =>
    ESTIMATOR_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: item.initial }), {}),
  )

  useEffect(() => {
    let active = true
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
      {/* ---------- Hero Section ---------- */}
      <section className="relative min-h-[580px] sm:min-h-[640px] flex items-center overflow-hidden bg-slate-950 text-white">
        {/* Background Image with WebP/AVIF Picture Element */}
        <picture className="absolute inset-0 size-full">
          <source srcSet="/images/hero-laundry-full.avif" type="image/avif" />
          <source srcSet="/images/hero-laundry-full.webp" type="image/webp" />
          <img
            src="/images/hero-laundry-full.jpg"
            alt="Crisp garments and laundry in sunlit space"
            className="size-full object-cover object-center"
          />
        </picture>

        {/* Dark-Blue Gradient Overlay on the side behind white text */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(8,47,73,0.92) 0%, rgba(8,47,73,0.78) 40%, rgba(8,47,73,0.45) 70%, rgba(8,47,73,0.15) 100%)',
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto w-[92%] max-w-6xl py-20 sm:py-24">
          <div className="max-w-2xl">
            {/* Script-style tagline */}
            <p className="font-serif italic text-indigo-300 text-lg sm:text-2xl tracking-wide font-normal">
              {BRAND.tagline}
            </p>

            {/* Bold Heading */}
            <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-sm">
              Laundry day, off your calendar.
            </h1>

            {/* Short Paragraph */}
            <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-slate-200">
              Book doorstep pickup in under 60 seconds with {BRAND.name}. Track each wash, delicate
              steam press, and delivery live from your device with transparent pricing.
            </p>

            {/* Three Rounded Pill Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to="/order"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 active:scale-95"
              >
                Book Pickup
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-slate-100 active:scale-95"
              >
                Pricing
              </Link>
              <Link
                to="/orders"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/80 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              >
                Track Order
              </Link>
            </div>

            {/* Location indicator */}
            <p className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-indigo-200/90">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Serving residential & corporate pickups{' '}
              {branchCount ? `across ${branchCount} branches` : 'near you'}
            </p>
          </div>
        </div>

        {/* Cloud / Wave Bottom Divider */}
        <div className="absolute bottom-0 inset-x-0 overflow-hidden leading-none z-10 pointer-events-none">
          <svg
            className="relative block w-full h-10 sm:h-14 text-white fill-current"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path d="M0,0 C150,90 350,-40 500,50 C650,140 900,10 1200,40 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      {/* ---------- Benefits Section (Image Beside Copy) ---------- */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="mx-auto w-[92%] max-w-6xl grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-slate-100 shadow-xl">
            <picture>
              <source srcSet="/images/home-benefits.avif" type="image/avif" />
              <source srcSet="/images/home-benefits.webp" type="image/webp" />
              <img
                src="/images/laundry-hero-basket.jpg"
                alt="Neatly stacked fresh laundry basket in home care setting"
                className="size-full object-cover aspect-[4/3] transition-transform duration-500 hover:scale-105"
              />
            </picture>
            <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-4 py-2.5 shadow-md backdrop-blur-md">
              <p className="text-xs font-extrabold text-slate-900">{BRAND.name} Care Standard</p>
              <p className="text-[11px] text-slate-500">
                Eco-Pure Detergents & Hand Steam Finishing
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Why Customers Love Us
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Effortless laundry, zero compromise.
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              We treat your wardrobe with the care it deserves. Every piece is handled with
              professional equipment and eco-safe formulations.
            </p>

            <div className="mt-8 grid gap-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Truck className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Doorstep Pickup & Delivery</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    Schedule collection right from your doorstep at a time that works for you.
                    Returned clean, pressed, and wrapped.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                  <Clock className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">24h Express Turnaround</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    Need it tomorrow? Choose express service for guaranteed 24-hour turnaround on
                    suits, shirts, and everyday laundry.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Care by Garment Type</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    Custom wash programs tailored for corporate wear, silks, traditional native
                    attire, casuals, and heavy bedding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works Strip ---------- */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-slate-50 border-y border-line">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Simple 3-Step Process
            </p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              From dirty clothes to ready-to-wear
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Reclaim hours of your weekend in three effortless steps.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="relative rounded-3xl border border-line bg-white p-8 shadow-xs transition hover:border-indigo-200 hover:shadow-md"
              >
                <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Step {step.number}
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Quick Price Estimator Section ---------- */}
      <section id="pricing-estimator" className="py-16 sm:py-24 bg-white">
        <div className="mx-auto w-[92%] max-w-5xl">
          <div className="text-center max-w-xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-1 text-xs font-bold text-indigo-700">
              <Calculator className="size-3.5" />
              Instant Cost Calculator
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Estimate your laundry costs
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adjust item quantities to calculate your total before scheduling your pickup.
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
                    className="flex flex-col justify-between rounded-2xl border border-line bg-slate-50/60 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                          <Icon className="size-4" />
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {formatNaira(item.price)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-extrabold text-slate-900">{item.name}</p>
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
                      <span className="font-mono text-sm font-bold text-slate-900">{qty}</span>
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
            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:flex-row">
              <div>
                <p className="text-xs font-semibold text-slate-600">
                  Estimated Total ({estimatorTotalItems} items)
                </p>
                <p className="font-mono text-2xl font-black text-indigo-700">
                  {formatNaira(estimatorTotal)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Includes professional washing, fabric care and steam pressing.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  View Full Price List
                </Link>
                <Link
                  to="/order"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                >
                  Book Pickup
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Verified Reviews Grid ---------- */}
      <section className="py-16 sm:py-24 bg-slate-50 border-t border-line">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-xl mx-auto">
            <div className="flex justify-center gap-1 text-amber-400 mb-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Loved by busy professionals
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Here is how {BRAND.name} helps customers reclaim hours of their weekends.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {REVIEWS.map((rev) => (
              <div
                key={rev.name}
                className="flex flex-col justify-between rounded-3xl border border-line bg-white p-6 shadow-xs transition hover:border-indigo-200 hover:shadow-md"
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
                  <div className="grid size-9 place-items-center rounded-full bg-indigo-100 font-mono text-xs font-extrabold text-indigo-700">
                    {rev.initials}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">{rev.name}</p>
                    <p className="text-[11px] text-slate-500">{rev.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA Band ---------- */}
      <section className="bg-slate-900 py-16 sm:py-20 text-white">
        <div className="mx-auto flex w-[92%] max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Ready for a lighter laundry day?
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Book your first collection with {BRAND.name} in under a minute — no download required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-indigo-500 active:scale-95"
            >
              Book a pickup
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
