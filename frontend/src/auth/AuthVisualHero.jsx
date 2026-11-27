import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import BrandLogo from '../components/common/BrandLogo'
import { BRAND } from '../constants/brand'
import { getBranches } from '../api/branches.api'

export default function AuthVisualHero({
  title = 'Keep every garment moving with precision.',
  subtitle = `Monitor orders, real-time wash stages, inventory care, and doorstep collections across ${BRAND.name}.`,
  badgeText = 'Operations & Customer Gateway',
}) {
  const [branchCount, setBranchCount] = useState(null)

  useEffect(() => {
    let isMounted = true
    getBranches()
      .then((res) => {
        const branches = res.data?.data ?? res.data ?? []
        const activeBranches = Array.isArray(branches)
          ? branches.filter((b) => b.is_active !== false)
          : []
        if (isMounted && activeBranches.length > 0) {
          setBranchCount(activeBranches.length)
        }
      })
      .catch(() => {
        // Fall back gracefully without showing fabricated counts
      })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="relative hidden overflow-hidden bg-slate-950 p-10 lg:p-12 text-white lg:flex lg:flex-col justify-between select-none min-h-screen">
      {/* Background picture with AVIF/WebP */}
      <picture className="absolute inset-0 size-full object-cover">
        <source srcSet="/images/auth-bg.avif" type="image/avif" />
        <source srcSet="/images/auth-bg.webp" type="image/webp" />
        <img
          src="/images/hero-laundry-full.jpg"
          alt="Swirl Laundry clean operations"
          className="size-full object-cover opacity-30 scale-105 transition-transform duration-1000 ease-out"
        />
      </picture>

      {/* Rich multi-stop gradient overlay with indigo, slate & purple hues */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-slate-950/90 to-purple-950/85" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-500/25 via-transparent to-transparent pointer-events-none" />

      {/* Ambient glowing orbs */}
      <div className="absolute -top-24 -left-24 size-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-24 -right-24 size-80 rounded-full bg-purple-500/25 blur-3xl pointer-events-none" />

      {/* Fancy edge divider (organic wave curve like on the hero section) on the right edge */}
      <div className="hidden lg:block absolute inset-y-0 -right-[1px] w-12 xl:w-16 h-full z-20 pointer-events-none overflow-hidden">
        <svg
          className="h-full w-full text-slate-50 fill-current"
          viewBox="0 0 64 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M64,0 L64,1000 L12,1000 C42,800 2,600 48,400 C16,200 42,80 64,0 Z" />
        </svg>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <BrandLogo variant="large" inverted={true} />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-bold tracking-wider uppercase text-indigo-200 backdrop-blur-md shadow-xs">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
          </span>
          {badgeText}
        </span>
      </div>

      {/* Main Copy & Bespoke Live Operations Card */}
      <div className="relative z-10 my-auto max-w-lg py-8">
        <div className="mb-6 inline-flex size-12 items-center justify-center rounded-2xl bg-white/10 text-indigo-300 backdrop-blur-md border border-white/15 shadow-sm">
          <ShieldCheck className="size-6 text-indigo-300" />
        </div>

        <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-xs">
          {title}
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">{subtitle}</p>

        {/* Live Laundry Operations Card with smooth float */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl shadow-2xl animate-float-slow max-w-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-emerald-400" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Service Operations
              </span>
            </div>
            {branchCount !== null && (
              <span className="text-[11px] font-semibold text-slate-300">
                {branchCount} {branchCount === 1 ? 'Branch' : 'Branches'} Active
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/5 p-2.5 border border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Turnaround
              </p>
              <p className="mt-1 text-sm font-black text-white">24h Express</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-2.5 border border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Doorstep
              </p>
              <p className="mt-1 text-sm font-black text-white">Free Pickup</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-2.5 border border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tracking
              </p>
              <p className="mt-1 text-sm font-black text-white">Real-Time</p>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-3 border-t border-white/10">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              Doorstep Collection & Delivery
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              Real-time Tracking
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-4">
        <span>
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </span>
        <span className="text-slate-400">{BRAND.tagline}</span>
      </div>
    </section>
  )
}
