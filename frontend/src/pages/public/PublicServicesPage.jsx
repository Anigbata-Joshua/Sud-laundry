import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Clock, Droplets, Flame, ShieldCheck, Sparkles } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { getServices } from '../../api/services.api'
import { BRAND } from '../../constants/brand'

const CORE_SERVICES = [
  {
    name: 'Washing & Folding',
    category: 'Laundry',
    turnaround_hours: 72,
    blurb:
      'Everyday laundry washed in eco-friendly detergents, dried, and neatly bundled into stacked folded packs.',
    icon: Droplets,
  },
  {
    name: 'Washing & Ironing',
    category: 'Laundry',
    turnaround_hours: 72,
    blurb:
      'Full wash cycle finished with crisp, wrinkle-free steam pressing ready to hang in your closet.',
    icon: Flame,
  },
  {
    name: 'Ironing',
    category: 'Laundry',
    turnaround_hours: 24,
    blurb:
      'Professional steam pressing for shirts, trousers, suits, and native attire with crisp crease lines.',
    icon: Flame,
  },
  {
    name: 'Dry Cleaning',
    category: 'Dry Cleaning',
    turnaround_hours: 48,
    blurb:
      'Delicate solvent care preserving texture and color for suits, gowns, silks, and tailored outerwear.',
    icon: Sparkles,
  },
  {
    name: 'Dry Cleaning & Pressing',
    category: 'Dry Cleaning',
    turnaround_hours: 48,
    blurb:
      'Comprehensive dry cleaning followed by meticulous hand steam pressing and collar shaping.',
    icon: ShieldCheck,
  },
]

export default function PublicServicesPage() {
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [branchServices, setBranchServices] = useState([])
  const [loading, setLoading] = useState(true)

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
  }, [])

  useEffect(() => {
    if (!selectedBranchId) return
    let ignore = false
    Promise.resolve().then(() => {
      if (!ignore) setLoading(true)
    })
    getServices({ branch_id: selectedBranchId, is_active: true })
      .then((res) => {
        if (!ignore) setBranchServices(res.data?.data || [])
      })
      .catch(() => {
        if (!ignore) setBranchServices([])
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [selectedBranchId])

  // Map to the active core services for the selected branch (no duplicates, no junk test services)
  const displayServices = useMemo(() => {
    return CORE_SERVICES.map((core) => {
      // Find matching active service in branch
      const match = branchServices.find(
        (s) => s.name?.trim().toLowerCase() === core.name.toLowerCase() && s.is_active !== false,
      )
      return {
        ...core,
        price: match?.price || 1200,
        turnaround_hours: match?.turnaround_hours || core.turnaround_hours,
        branchServiceId: match?._id,
      }
    })
  }, [branchServices])

  const selectedBranch = branches.find((b) => b._id === selectedBranchId)

  return (
    <div className="bg-canvas min-h-screen text-slate-800 pb-20">
      {/* ---------- Hero Section with Laundry Service Imagery & Smooth Accents ---------- */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-24 sm:pb-28">
        {/* Background Picture with Laundry Handled Packaging & Crisp Linens */}
        <picture className="absolute inset-0 size-full">
          <source srcSet="/images/home-benefits.avif" type="image/avif" />
          <source srcSet="/images/home-benefits.webp" type="image/webp" />
          <img
            src="/images/hero-laundry-full.jpg"
            alt="Swirl laundry core garment services and white-glove packaging"
            className="size-full object-cover object-center opacity-30 scale-105 transition-transform duration-1000 ease-out"
          />
        </picture>

        {/* Multi-stop Deep Indigo & Slate Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-indigo-950/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />

        {/* Ambient Glowing Orbs */}
        <div className="absolute top-0 right-1/4 size-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 size-60 rounded-full bg-purple-500/20 blur-2xl pointer-events-none animate-pulse" />

        <div className="relative z-10 mx-auto w-[92%] max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold text-indigo-200 backdrop-blur-md shadow-sm">
              <Sparkles className="size-3.5 text-indigo-300" />
              {BRAND.tagline}
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
              Core Laundry & Fabric Services
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed">
              <span className="font-serif italic text-indigo-300 mr-2 font-normal">
                Expert garment care.
              </span>
              Professional washing, specialized steam pressing, and delicate dry cleaning standards
              across all {BRAND.name} branch facilities.
            </p>
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

      {/* ---------- Branch Selector & Price List Banner ---------- */}
      <section className="border-b border-line bg-white/95 backdrop-blur-md sticky top-[64px] sm:top-[74px] z-30 shadow-xs py-4">
        <div className="mx-auto w-[92%] max-w-6xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-4 text-indigo-600" /> Facility:
            </span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="rounded-xl border border-line bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            <span>View Full Per-Garment Price List</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* ---------- Main Services Grid ---------- */}
      <div className="mx-auto w-[92%] max-w-6xl mt-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Active Core Services</h2>
            <p className="text-xs text-slate-500 mt-1">
              Showing active services for{' '}
              <span className="font-bold text-slate-900">
                {selectedBranch?.name || 'Selected branch'}
              </span>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 py-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-3xl border border-line bg-white p-6 h-64"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayServices.map((svc) => {
              const Icon = svc.icon || Droplets
              return (
                <article
                  key={svc.name}
                  className="flex flex-col justify-between rounded-3xl border border-line bg-white p-7 shadow-xs transition hover:border-indigo-300 hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <Icon className="size-6" />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                        <Clock className="size-3 text-indigo-600" /> {svc.turnaround_hours}h
                        Turnaround
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-extrabold text-slate-900">{svc.name}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{svc.blurb}</p>
                  </div>

                  <div className="mt-8 pt-5 border-t border-line flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Category
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">{svc.category}</span>
                    </div>

                    <Link
                      to={`/pricing`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition"
                    >
                      Price List <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Callout Card */}
        <div className="mt-14 rounded-3xl bg-indigo-900 p-8 sm:p-10 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-xl">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              Garment Price Catalog
            </span>
            <h3 className="mt-1 text-2xl font-black">
              Need exact prices for suits, shirts, or duvets?
            </h3>
            <p className="mt-2 text-sm text-indigo-100 max-w-xl">
              Browse our complete catalog with instant standard and express pricing per garment.
            </p>
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-md hover:bg-indigo-50 active:scale-95 transition shrink-0"
          >
            Check Price List <ArrowRight className="size-4 text-indigo-600" />
          </Link>
        </div>
      </div>
    </div>
  )
}
