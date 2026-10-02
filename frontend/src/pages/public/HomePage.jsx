import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Check,
  Clock,
  Droplets,
  Flame,
  Layers,
  MapPin,
  Package,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
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
    category: 'Treatment',
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

function getRandomShuffle(list, count = 4) {
  if (!list || list.length === 0) return []
  const shuffled = [...list].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count).map((item, index) => ({
    ...item,
    icon: iconForService(item),
    blurb:
      item.blurb ||
      `${item.category || 'Professional service'} handled with dedicated attention to detail.`,
    featured: index === 0,
  }))
}

const STATUS_PREVIEW = [
  { label: 'Picked up', done: true },
  { label: 'Washing at Ikeja branch', done: true },
  { label: 'Ready for delivery', done: false },
  { label: 'Delivered', done: false },
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
    copy: 'Your order is logged, weighed and moved through wash, dry and quality checks.',
  },
  {
    number: '03',
    title: 'Track it and get it back',
    copy: 'A notification lands at every stage — pickup, processing, ready, delivered.',
  },
]

export default function HomePage() {
  const [allServices, setAllServices] = useState(SEEDER_SERVICES)
  const [services, setServices] = useState(() => getRandomShuffle(SEEDER_SERVICES, 4))
  const [branchCount, setBranchCount] = useState(null)
  const [shuffleKey, setShuffleKey] = useState(0)

  const shuffleCards = useCallback(() => {
    setServices(getRandomShuffle(allServices, 4))
    setShuffleKey((prev) => prev + 1)
  }, [allServices])

  useEffect(() => {
    let active = true
    getServices({ is_active: true })
      .then((response) => {
        const items = response.data?.data ?? []
        if (active && items.length > 0) {
          // Merge with seeder blurbs if backend service matches
          const enriched = items.map((item) => {
            const match = SEEDER_SERVICES.find(
              (s) => s.name.toLowerCase() === item.name.toLowerCase(),
            )
            return {
              ...item,
              blurb: item.blurb || match?.blurb || `${item.category} care by our team.`,
            }
          })
          setAllServices(enriched)
          setServices(getRandomShuffle(enriched, 4))
        }
      })
      .catch(() => {
        /* keep default seeder fallback content */
      })
    getBranches()
      .then((response) => {
        if (active) setBranchCount(response.data?.data?.length ?? null)
      })
      .catch(() => {
        /* keep default copy */
      })
    return () => {
      active = false
    }
  }, [])

  // Auto-shuffle cards periodically every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      shuffleCards()
    }, 7000)
    return () => clearInterval(timer)
  }, [shuffleCards])

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-24 size-[28rem] rounded-full bg-sky-100/70 blur-3xl"
        />
        <div className="relative mx-auto grid w-[92%] max-w-6xl gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Now taking pickups {branchCount ? `across ${branchCount} branches` : 'near you'}
            </p>
            <h1 className="mt-5 max-w-xl text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Laundry day, off your calendar.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Book a pickup in under a minute, and follow every wash, press and delivery from your
              phone — no drop-off queues, no guessing when it'll be ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/order"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-sky-900/10 transition hover:bg-sky-700 active:scale-[0.98]"
              >
                Book a pickup
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-[13px] font-bold text-slate-700 transition hover:border-slate-300"
              >
                See how it works
              </a>
            </div>
            <dl className="mt-11 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
              <div>
                <dt className="sr-only">Turnaround</dt>
                <dd className="font-mono text-xl font-semibold text-ink">24hr</dd>
                <dd className="text-[11px] text-muted">standard turnaround</dd>
              </div>
              <div>
                <dt className="sr-only">Rating</dt>
                <dd className="font-mono text-xl font-semibold text-ink">4.9/5</dd>
                <dd className="text-[11px] text-muted">average rating</dd>
              </div>
              <div>
                <dt className="sr-only">Orders tracked</dt>
                <dd className="font-mono text-xl font-semibold text-ink">100%</dd>
                <dd className="text-[11px] text-muted">orders tracked live</dd>
              </div>
            </dl>
          </div>

          {/* Hero visual column with full high-res image, smooth gradient overlay, and live status preview */}
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="animate-float-slow relative w-full">
              {/* Full hero image container with smooth layered gradient */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-sky-100/60 bg-slate-900 shadow-2xl shadow-slate-900/15">
                <img
                  src="/images/hero-laundry-full.jpg"
                  alt="Crisp folded shirts, plush linens and laundry basket in a modern sunlit laundry space"
                  loading="eager"
                  fetchPriority="high"
                  className="size-full object-cover object-center transition-transform duration-700 ease-out hover:scale-105"
                />
                {/* Smooth multi-stop gradient overlays */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/25 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-sky-950/40 via-transparent to-black/10" />

                {/* Floating brand pill */}
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/50 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Suds Fabric Care • 100% Eco-Pure
                </div>
              </div>

              {/* Live order-status preview card — floating in front to create depth */}
              <div className="relative mt-4 w-full rounded-2xl border border-line bg-white/95 p-4.5 shadow-xl shadow-slate-900/10 backdrop-blur-md sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0 sm:max-w-[18.5rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Order
                    </p>
                    <p className="font-mono text-sm font-semibold text-ink">ORD-A93F2C</p>
                  </div>
                  <span className="grid size-8.5 place-items-center rounded-xl bg-sky-50 text-brand">
                    <BellRing className="size-4" />
                  </span>
                </div>
                <ul className="mt-4 grid gap-2.5">
                  {STATUS_PREVIEW.map((step) => (
                    <li key={step.label} className="flex items-center gap-2.5 text-[12.5px]">
                      <span
                        className={`grid size-4.5 shrink-0 place-items-center rounded-full ${
                          step.done ? 'bg-brand text-white' : 'border-2 border-slate-200'
                        }`}
                      >
                        {step.done && <Check className="size-2.5 stroke-[3]" />}
                      </span>
                      <span className={step.done ? 'font-semibold text-ink' : 'text-slate-400'}>
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl bg-sky-50 p-2.5 text-[11px] font-semibold text-brand">
                  You'll get a notification the moment this order is ready.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section id="services" className="border-t border-line bg-cream py-16 sm:py-24">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Featured Catalog
              </p>
              <h2 className="mt-1 text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
                Every fabric, one drop-off.
              </h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                Explore our full catalog from standard wash to luxury duvets, rugs and specialty
                care — services randomly rotate to showcase what's available.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold text-slate-500">
                Showing 4 of {allServices.length} services
              </span>
              <button
                type="button"
                onClick={shuffleCards}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 shadow-2xs transition hover:border-sky-300 hover:text-brand active:scale-95"
                title="Shuffle services"
              >
                <Shuffle className="size-3.5 text-brand" />
                Shuffle
              </button>
            </div>
          </div>

          <div key={shuffleKey} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => {
              const Icon = service.icon ?? Droplets
              return (
                <article
                  key={`${service._id}-${index}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                  className={`animate-fade-up flex flex-col justify-between rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md ${
                    service.featured ? 'sm:col-span-2 sm:row-span-2 lg:col-span-2' : ''
                  }`}
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
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{service.blurb}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-sm font-semibold text-ink">
                      from {formatNaira(service.price)}
                    </span>
                    {service.turnaround_hours && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Clock className="size-3.5" />
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
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto w-[92%] max-w-6xl">
          <h2 className="max-w-md text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
            From pickup to your door, in three steps.
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, index) => (
              <div key={step.number} className="relative">
                <span className="font-mono text-sm font-semibold text-slate-300">
                  {step.number}
                </span>
                <h3 className="mt-3 text-[15px] font-extrabold text-ink">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{step.copy}</p>
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 top-2 hidden h-px w-6 bg-line sm:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Notifications feature callout ---------- */}
      <section className="border-y border-line bg-white py-16 sm:py-20">
        <div className="mx-auto grid w-[92%] max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-brand">
              <BellRing className="size-5" />
            </span>
            <h2 className="mt-5 text-[24px] font-extrabold tracking-tight text-ink sm:text-[28px]">
              Never wonder where your order is.
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
              Every order sends a notification when it's picked up, when it moves into processing,
              and again the moment it's ready — so you'll know before you even open the app.
            </p>
            <ul className="mt-6 grid gap-2.5 text-[13px] font-semibold text-slate-700">
              {['Pickup confirmed', 'In progress at your branch', 'Ready for delivery'].map(
                (label) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <Check className="size-4 text-brand" />
                    {label}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="grid gap-3">
            {[
              { title: 'Order placed', time: 'Just now', tone: 'text-brand' },
              { title: 'Picked up from Ikeja branch', time: '2 hours ago', tone: 'text-slate-400' },
              { title: 'Ready for delivery', time: 'Yesterday', tone: 'text-slate-400' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-xs"
              >
                <span className="size-2 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{item.title}</p>
                  <p className={`text-[11px] ${item.tone}`}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Testimonial ---------- */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-[92%] max-w-3xl text-center">
          <div className="flex justify-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-4 fill-current" />
            ))}
          </div>
          <p className="mt-5 text-xl font-semibold leading-relaxed text-ink sm:text-2xl">
            "I schedule a pickup before I leave for work and get a notification the moment it's back
            on my doorstep. I haven't set foot in a laundromat in months."
          </p>
          <p className="mt-5 text-[13px] font-bold text-slate-500">Amaka O. — Lagos</p>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="bg-ink py-16 sm:py-20">
        <div className="mx-auto flex w-[92%] max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
              Ready for a lighter laundry day?
            </h2>
            <p className="mt-2 max-w-md text-[14px] text-slate-400">
              Book your first pickup in under a minute — no app download required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-[13px] font-bold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.98]"
            >
              Book a pickup
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-[13px] font-bold text-white transition hover:bg-white/5"
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
