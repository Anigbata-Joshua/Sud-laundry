import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Check,
  Clock,
  Droplets,
  Flame,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { getServices } from '../../api/services.api'
import { getBranches } from '../../api/branches.api'
import { formatNaira } from '../../utils/formatters'

// Shown while the live catalog loads, and as a graceful fallback if the
// API can't be reached — keeps the page useful rather than empty.
const FALLBACK_SERVICES = [
  {
    _id: 'wash-fold',
    name: 'Wash & Fold',
    category: 'Everyday laundry',
    price: 1200,
    turnaround_hours: 24,
    icon: Droplets,
    blurb: 'Everyday clothes and linens, washed, dried and folded per kilogram.',
    featured: true,
  },
  {
    _id: 'dry-clean',
    name: 'Dry Cleaning',
    category: 'Delicate care',
    price: 3500,
    turnaround_hours: 48,
    icon: Sparkles,
    blurb: 'Suits, gowns and delicate fabrics, hand-finished by garment.',
  },
  {
    _id: 'iron-press',
    name: 'Ironing & Press',
    category: 'Finishing',
    price: 800,
    turnaround_hours: 12,
    icon: Flame,
    blurb: 'A crisp, pressed finish for shirts, trousers and uniforms.',
  },
  {
    _id: 'express',
    name: 'Express Same-Day',
    category: 'Priority',
    price: 2000,
    turnaround_hours: 8,
    icon: Clock,
    blurb: 'Drop off in the morning, wear it again by evening.',
  },
]

function iconForCategory(category = '') {
  const value = category.toLowerCase()
  if (value.includes('dry') || value.includes('suit') || value.includes('gown')) return Sparkles
  if (value.includes('iron') || value.includes('press') || value.includes('steam')) return Flame
  if (value.includes('express') || value.includes('priority')) return Clock
  if (value.includes('stain') || value.includes('care') || value.includes('luxury')) return ShieldCheck
  return Droplets
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
  const [services, setServices] = useState(FALLBACK_SERVICES)
  const [branchCount, setBranchCount] = useState(null)

  useEffect(() => {
    let active = true
    getServices({ is_active: true })
      .then((response) => {
        const items = response.data?.data ?? []
        if (active && items.length) {
          setServices(
            items.slice(0, 4).map((service, index) => ({
              ...service,
              icon: iconForCategory(service.category),
              blurb: service.category || 'Handled by our care team, start to finish.',
              featured: index === 0,
            })),
          )
        }
      })
      .catch(() => {
        /* keep fallback content */
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

          {/* Live order-status preview card — previews the real tracking feature */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -bottom-4 -right-4 -z-10 size-full rounded-3xl bg-sky-600/10" />
            <div className="rounded-3xl border border-line bg-white p-5 shadow-xl shadow-slate-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Order
                  </p>
                  <p className="font-mono text-sm font-semibold text-ink">ORD-A93F2C</p>
                </div>
                <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand">
                  <BellRing className="size-4" />
                </span>
              </div>
              <ul className="mt-5 grid gap-3.5">
                {STATUS_PREVIEW.map((step) => (
                  <li key={step.label} className="flex items-center gap-3 text-[13px]">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full ${
                        step.done ? 'bg-brand text-white' : 'border-2 border-slate-200'
                      }`}
                    >
                      {step.done && <Check className="size-3" />}
                    </span>
                    <span className={step.done ? 'font-semibold text-ink' : 'text-slate-400'}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl bg-sky-50 p-3 text-[11px] font-semibold text-brand">
                You'll get a notification the moment this order is ready.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section id="services" className="border-t border-line bg-cream py-16 sm:py-24">
        <div className="mx-auto w-[92%] max-w-6xl">
          <div className="max-w-md">
            <h2 className="text-[26px] font-extrabold tracking-tight text-ink sm:text-3xl">
              Every fabric, one drop-off.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Choose from our core services when you book — pricing and turnaround shown up
              front, so there's nothing to work out later.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon ?? Droplets
              return (
                <article
                  key={service._id}
                  className={`flex flex-col justify-between rounded-2xl border border-line bg-white p-6 transition hover:border-sky-300 hover:shadow-md ${
                    service.featured ? 'sm:col-span-2 sm:row-span-2 lg:col-span-2' : ''
                  }`}
                >
                  <div>
                    <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-brand">
                      <Icon className="size-4.5" />
                    </span>
                    <h3 className="mt-4 text-base font-extrabold text-ink">{service.name}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                      {service.blurb}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-sm font-semibold text-ink">
                      from {formatNaira(service.price)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Clock className="size-3.5" />
                      {service.turnaround_hours}hr
                    </span>
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
              Every order sends a notification when it's picked up, when it moves into
              processing, and again the moment it's ready — so you'll know before you even open
              the app.
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
            "I schedule a pickup before I leave for work and get a notification the moment it's
            back on my doorstep. I haven't set foot in a laundromat in months."
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
