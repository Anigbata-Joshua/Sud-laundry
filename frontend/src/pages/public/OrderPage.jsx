import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { getServices } from '../../api/services.api'
import { createOrder } from '../../api/orders.api'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { formatNaira } from '../../utils/formatters'
import BranchCard from '../../components/branches/BranchCard'

function isAvailableAt(service, branchId) {
  if (!branchId) return false
  if (service.available_branch_ids?.length) {
    return service.available_branch_ids.some((branch) => (branch?._id ?? branch) === branchId)
  }
  return (service.branch_id?._id ?? service.branch_id) === branchId
}

// Earliest a pickup can be scheduled: one hour from now, rounded to the
// nearest 15 minutes, formatted for a datetime-local input.
function earliestPickup() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function OrderPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { notify } = useToast()

  const [branches, setBranches] = useState([])
  const [services, setServices] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState('')

  const [branchId, setBranchId] = useState('')
  const [cart, setCart] = useState({})
  const [pickupTime, setPickupTime] = useState(earliestPickup)
  const [priority, setPriority] = useState('normal')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const canBook = isAuthenticated && user?.role === 'customer'

  useEffect(() => {
    if (!canBook) return
    let active = true
    Promise.all([getBranches(), getServices({ is_active: true })])
      .then(([branchResponse, serviceResponse]) => {
        if (!active) return
        setBranches(branchResponse.data?.data ?? [])
        setServices(serviceResponse.data?.data ?? [])
      })
      .catch(() => {
        if (active) setOptionsError('Unable to load branches and services right now.')
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })
    return () => {
      active = false
    }
  }, [canBook])

  const availableServices = useMemo(
    () => services.filter((service) => isAvailableAt(service, branchId)),
    [services, branchId],
  )

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([serviceId, quantity]) => {
          const service = services.find((option) => option._id === serviceId)
          return { service, quantity, subtotal: service ? service.price * quantity : 0 }
        })
        .filter((item) => item.service),
    [cart, services],
  )

  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
  const expressSurcharge = priority === 'express' ? subtotal * 0.3 : 0
  const grandTotal = subtotal + expressSurcharge

  const selectedBranch = useMemo(
    () => branches.find((b) => (b._id || b.id) === branchId),
    [branches, branchId],
  )

  function selectBranch(id) {
    setBranchId(id)
    setCart({})
    setFormError('')
  }

  function setQuantity(serviceId, quantity) {
    setCart((current) => ({ ...current, [serviceId]: Math.max(0, quantity) }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!branchId) return setFormError('Please select a branch to continue.')
    if (cartItems.length === 0) return setFormError('Add at least one service to your order.')
    if (!pickupTime) return setFormError('Choose a pickup date and time.')

    setSubmitting(true)
    setFormError('')
    try {
      const response = await createOrder({
        branch_id: branchId,
        items: cartItems.map((item) => ({
          service_id: item.service._id,
          name: item.service.name,
          quantity: Number(item.quantity),
          subtotal: item.subtotal,
        })),
        pickup_time: pickupTime,
        priority,
      })
      setConfirmedOrder(response.data.data)
      window.dispatchEvent(new Event('notifications:changed'))
      notify({
        tone: 'success',
        title: 'Order placed successfully!',
        message: "We'll notify you as it moves through processing and pickup.",
      })
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message ?? 'Unable to place your order. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-[#4F7DF3]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <SignInPrompt />
  }

  if (user?.role !== 'customer') {
    return <WrongRoleNotice />
  }

  if (confirmedOrder) {
    return <Confirmation order={confirmedOrder} />
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-[#0F172A] via-[#1A2E56] to-[#0F172A] text-white pt-12 pb-16 px-4 sm:px-8 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 w-fit bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full mb-4">
            <Sparkles className="size-3.5 text-[#D4AF37]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">
              Premium Laundry Booking
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Book Your Laundry & Dry-Cleaning
          </h1>
          <p className="mt-3 text-slate-300 max-w-xl text-sm sm:text-base leading-relaxed">
            Select your preferred branch, customize your garment services, and schedule a convenient
            pickup window.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#26C1C9]" /> 24h Express Available
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#26C1C9]" /> Eco-Friendly Care
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#26C1C9]" /> In-App Tracking
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 -mt-6">
        {optionsError && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700 shadow-sm">
            {optionsError}
          </div>
        )}

        {loadingOptions ? (
          <div className="grid gap-4 mt-8">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] items-start">
            <div className="space-y-8">
              {/* Step 1: Branch Selection */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
                <StepHeader
                  step="01"
                  title="Select Service Location"
                  subtitle="Choose the branch closest to your collection address."
                />
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {branches.map((branch, index) => (
                    <BranchCard
                      key={branch._id || branch.id}
                      branch={branch}
                      selected={(branch._id || branch.id) === branchId}
                      onSelect={selectBranch}
                      index={index}
                    />
                  ))}
                  {branches.length === 0 && (
                    <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                      No active branches available at the moment.
                    </p>
                  )}
                </div>
              </section>

              {/* Step 2: Services Selection */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
                <StepHeader
                  step="02"
                  title="Select Services & Garments"
                  subtitle={
                    branchId
                      ? `Available service options at ${selectedBranch?.name || 'selected branch'}.`
                      : 'Please select a branch above to view available services.'
                  }
                />

                {!branchId ? (
                  <div className="mt-6 py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    <Building2 className="size-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-500">
                      Choose a branch in Step 1 to load services and live pricing.
                    </p>
                  </div>
                ) : availableServices.length === 0 ? (
                  <div className="mt-6 py-12 text-center rounded-2xl border border-slate-200 bg-slate-50">
                    <p className="text-xs font-medium text-slate-500">
                      No active services currently listed for this branch.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3.5">
                    {availableServices.map((service) => {
                      const quantity = cart[service._id] ?? 0
                      const isSelected = quantity > 0
                      return (
                        <div
                          key={service._id}
                          className={`flex items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                            isSelected
                              ? 'border-[#4F7DF3] bg-gradient-to-r from-blue-50/70 to-white shadow-sm ring-1 ring-[#4F7DF3]/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-[#0F172A]">{service.name}</h3>
                              {service.type && (
                                <span className="inline-block uppercase px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-slate-100 text-slate-600">
                                  {service.type}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span className="font-mono font-bold text-[#0F172A]">
                                {formatNaira(service.price)}
                              </span>
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Clock className="size-3 text-slate-400" />
                                {service.turnaround_hours}h turnaround
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              aria-label={`Decrease ${service.name}`}
                              disabled={quantity === 0}
                              onClick={() => setQuantity(service._id, quantity - 1)}
                              className="size-9 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-sm text-[#0F172A]">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase ${service.name}`}
                              onClick={() => setQuantity(service._id, quantity + 1)}
                              className="size-9 rounded-xl border border-[#4F7DF3]/30 bg-[#4F7DF3] text-white flex items-center justify-center hover:bg-[#3B63C9] transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm shadow-[#4F7DF3]/20"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Step 3: Schedule & Priority */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
                <StepHeader
                  step="03"
                  title="Collection & Fulfillment Priority"
                  subtitle="Set when our team should pick up your garments."
                />
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-bold text-slate-700">
                    <span>Pickup Date & Time</span>
                    <input
                      required
                      type="datetime-local"
                      min={earliestPickup()}
                      value={pickupTime}
                      onChange={(event) => setPickupTime(event.target.value)}
                      className="rounded-xl border border-slate-200 p-3.5 text-xs font-normal outline-none focus:border-[#4F7DF3] focus:ring-2 focus:ring-[#4F7DF3]/20 transition-all bg-slate-50/50"
                    />
                  </label>

                  <div className="grid gap-2 text-xs font-bold text-slate-700">
                    <span>Turnaround Priority</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPriority('normal')}
                        className={`rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer text-center ${
                          priority === 'normal'
                            ? 'border-[#4F7DF3] bg-blue-50/80 text-[#4F7DF3] ring-2 ring-[#4F7DF3]/20 shadow-xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Standard
                        <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                          Regular turnaround
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('express')}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer text-center ${
                          priority === 'express'
                            ? 'border-[#26C1C9] bg-cyan-50/80 text-[#00A878] ring-2 ring-[#26C1C9]/30 shadow-xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-[#00A878]">
                          <Zap className="size-3.5 fill-current" /> Express (+30%)
                        </span>
                        <span className="text-[10px] font-normal text-slate-400 mt-0.5">
                          24h priority guarantee
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky Order Summary Card */}
            <aside className="bg-[#1A1C1E] text-white rounded-3xl p-6 sm:p-8 shadow-2xl lg:sticky lg:top-24 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-white">
                    Order Summary
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedBranch ? selectedBranch.name : 'No branch selected'}
                  </p>
                </div>
                <div className="size-9 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
                  <Truck className="size-4.5" />
                </div>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 rounded-2xl bg-white/5 border border-white/5 px-4">
                  <p className="font-semibold text-slate-300">Your basket is empty</p>
                  <p className="mt-1 text-[11px]">
                    Select items above to see your real-time total.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3 mb-6 divide-y divide-white/5">
                  {cartItems.map((item) => (
                    <li
                      key={item.service._id}
                      className="pt-2.5 first:pt-0 flex items-center justify-between text-xs"
                    >
                      <div className="pr-2">
                        <span className="font-medium text-slate-200 block truncate max-w-[180px]">
                          {item.service.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.quantity} × {formatNaira(item.service.price)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-white shrink-0">
                        {formatNaira(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Price Breakdown */}
              <div className="space-y-2.5 border-t border-white/10 pt-4 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatNaira(subtotal)}</span>
                </div>
                {priority === 'express' && (
                  <div className="flex justify-between text-[#26C1C9] font-medium">
                    <span className="flex items-center gap-1">
                      <Zap className="size-3 fill-current" /> Express Surcharge (30%)
                    </span>
                    <span className="font-mono">+{formatNaira(expressSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-3 border-t border-white/10 text-white">
                  <span className="text-sm font-bold">Total Due</span>
                  <span className="text-2xl font-black font-mono text-[#4F7DF3]">
                    {formatNaira(grandTotal)}
                  </span>
                </div>
              </div>

              {formError && (
                <div className="mt-4 rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-xs text-rose-200 font-medium">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="mt-6 w-full bg-[#4F7DF3] hover:bg-[#3B63C9] active:scale-[0.98] h-14 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#4F7DF3]/25"
              >
                {submitting ? 'Confirming Order…' : 'Place Order & Schedule Pickup'}
                {!submitting && <ArrowRight className="size-4" />}
              </button>

              <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] text-slate-400">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-[#26C1C9] shrink-0" />
                  <span>Real-time status updates via SMS & in-app alerts.</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="size-3.5 text-[#D4AF37] shrink-0" />
                  <span>Free cancellation within 30 minutes of booking.</span>
                </p>
              </div>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}

function StepHeader({ step, title, subtitle }) {
  return (
    <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
      <span className="size-8 rounded-xl bg-blue-50 text-[#4F7DF3] font-black text-xs flex items-center justify-center shrink-0 border border-blue-100">
        {step}
      </span>
      <div>
        <h2 className="text-base font-black text-[#0F172A] tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <section className="grid min-h-[75vh] place-items-center px-4 py-16 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xl">
        <span className="mx-auto size-14 place-items-center rounded-2xl bg-blue-50 text-[#4F7DF3] flex items-center justify-center shadow-sm">
          <BellRing className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-[#0F172A] tracking-tight">
          Sign In to Book a Pickup
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Sign in or create an account to schedule laundry collections, customize your services, and
          track orders in real-time.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            to="/login"
            state={{ from: { pathname: '/order' } }}
            className="rounded-2xl bg-[#4F7DF3] py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-[#3B63C9] shadow-md shadow-blue-500/20"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-2xl border border-slate-200 py-3.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </section>
  )
}

function WrongRoleNotice() {
  return (
    <section className="grid min-h-[75vh] place-items-center px-4 py-16 bg-[#F8FAFC]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xl">
        <span className="mx-auto size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-black text-[#0F172A] tracking-tight">
          Customer Booking Portal
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          You are signed in with a staff/operational account. Please use your internal workspace to
          process and dispatch orders.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block w-full rounded-2xl bg-[#0F172A] py-3.5 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          Go to Workspace
        </Link>
      </div>
    </section>
  )
}

function Confirmation({ order }) {
  const reference = `ORD-${order._id.slice(-6).toUpperCase()}`
  const timeline = [
    { label: 'Order Received & Reserved', done: true },
    { label: 'Pickup Scheduled', done: false },
    { label: 'In-Facility Processing', done: false },
    { label: 'Quality Check & Delivery', done: false },
  ]

  return (
    <section className="grid min-h-[80vh] place-items-center px-4 py-16 bg-[#F8FAFC]">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative h-44 w-full overflow-hidden bg-[#0F172A]">
          <img
            src="/images/laundry-hero-clean.gif"
            alt="Clean laundry processing"
            className="size-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent" />
          <div className="absolute bottom-4 left-6 flex items-center gap-3">
            <span className="size-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
              <Check className="size-5 stroke-[3]" />
            </span>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Order Confirmed
              </p>
              <p className="font-mono text-base font-bold text-white">{reference}</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h1 className="text-xl font-black text-[#0F172A] tracking-tight">
            Thank you! Your pickup is scheduled.
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            We've assigned your order to the branch team. Stock has been reserved and our staff will
            collect your garments at the requested time.
          </p>

          <ul className="mt-6 grid gap-3 border-t border-slate-100 pt-5">
            {timeline.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-xs">
                <span
                  className={`size-5 rounded-full flex items-center justify-center ${
                    step.done ? 'bg-[#4F7DF3] text-white' : 'border-2 border-slate-200'
                  }`}
                >
                  {step.done && <Check className="size-3 stroke-[3]" />}
                </span>
                <span className={step.done ? 'font-bold text-[#0F172A]' : 'text-slate-400'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <Link
              to={`/orders/${order._id}`}
              className="rounded-2xl bg-[#4F7DF3] py-3.5 text-center text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition hover:bg-[#3B63C9]"
            >
              View Order Status
            </Link>
            <Link
              to="/home"
              className="rounded-2xl border border-slate-200 py-3.5 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
