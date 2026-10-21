import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { createOrder, getPricingConfig } from '../../api/orders.api'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { formatNaira } from '../../utils/formatters'
import BranchCard from '../../components/branches/BranchCard'
import GarmentServiceSelector from '../../components/orders/GarmentServiceSelector'

function earliestPickup() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function generateQuickSlots() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const today = new Date(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const slots = []
  const currentHour = now.getHours()

  if (currentHour < 11) {
    slots.push({
      label: 'Today Morning',
      time: '9:00 AM – 11:30 AM',
      value: `${formatDate(today)}T10:00`,
    })
  }
  if (currentHour < 15) {
    slots.push({
      label: 'Today Afternoon',
      time: '12:00 PM – 4:00 PM',
      value: `${formatDate(today)}T14:00`,
    })
  }
  if (currentHour < 18) {
    slots.push({
      label: 'Today Evening',
      time: '4:30 PM – 7:00 PM',
      value: `${formatDate(today)}T17:00`,
    })
  }

  slots.push({
    label: 'Tomorrow Morning',
    time: '8:30 AM – 11:30 AM',
    value: `${formatDate(tomorrow)}T09:30`,
  })
  slots.push({
    label: 'Tomorrow Afternoon',
    time: '12:00 PM – 4:00 PM',
    value: `${formatDate(tomorrow)}T13:30`,
  })
  slots.push({
    label: 'Tomorrow Evening',
    time: '4:30 PM – 7:00 PM',
    value: `${formatDate(tomorrow)}T17:00`,
  })

  return slots
}

export default function OrderPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { notify } = useToast()

  const [branches, setBranches] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState('')

  const [branchId, setBranchId] = useState('')
  const [orderItems, setOrderItems] = useState([])
  const [pickupTime, setPickupTime] = useState(earliestPickup)
  const [priority, setPriority] = useState('normal')
  const [expressPercent, setExpressPercent] = useState(30)
  const [useCustomTime, setUseCustomTime] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const quickSlots = useMemo(() => generateQuickSlots(), [])
  const canBook = isAuthenticated && user?.role === 'customer'

  useEffect(() => {
    getPricingConfig()
      .then((res) => {
        const percent = res.data?.data?.express_surcharge_percent
        if (typeof percent === 'number' && percent >= 0) {
          setExpressPercent(percent)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!canBook) return
    let active = true
    getBranches()
      .then((branchResponse) => {
        if (!active) return
        const list = branchResponse.data?.data ?? []
        setBranches(list)
        if (list.length > 0) {
          setBranchId((current) => current || list[0]._id || list[0].id)
        }
      })
      .catch(() => {
        if (active) setOptionsError('Unable to load branches right now.')
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })
    return () => {
      active = false
    }
  }, [canBook])

  const subtotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0),
    [orderItems],
  )
  const expressSurcharge = useMemo(
    () => (priority === 'express' ? Math.round(subtotal * (expressPercent / 100) * 100) / 100 : 0),
    [priority, subtotal, expressPercent],
  )
  const grandTotal = subtotal + expressSurcharge

  const totalPieces = useMemo(
    () => orderItems.reduce((sum, item) => sum + (item.quantity || 1) * (item.piece_count || 1), 0),
    [orderItems],
  )

  const selectedBranch = useMemo(
    () => branches.find((b) => (b._id || b.id) === branchId),
    [branches, branchId],
  )

  function selectBranch(id) {
    setBranchId(id)
    setOrderItems([])
    setFormError('')
  }

  async function submit(event) {
    if (event) event.preventDefault()
    if (!branchId) return setFormError('Please select a branch to continue.')
    if (orderItems.length === 0)
      return setFormError('Add at least one garment service to your order.')
    if (!pickupTime) return setFormError('Choose a pickup date and time.')

    setSubmitting(true)
    setFormError('')
    try {
      const response = await createOrder({
        branch_id: branchId,
        items: orderItems.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          service_id: item.service_id,
          quantity: Number(item.quantity),
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
        <div className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
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
    <div className="min-h-screen bg-canvas font-sans pb-24">
      {/* Header Banner */}
      <section className="bg-ink text-white pt-12 pb-16 px-4 sm:px-8 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 w-fit bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full mb-4">
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">
              Premium Laundry Booking
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Schedule your laundry collection
          </h1>
          <p className="mt-3 text-slate-300 max-w-xl text-sm sm:text-base leading-relaxed">
            Select your preferred branch, pick garments with specialized care options, and book an
            easy collection window.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> 24h Express Available
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Eco-Pure Fabric Wash
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Doorstep Real-Time Tracking
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
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
          <form
            onSubmit={submit}
            className="grid gap-8 lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] items-start"
          >
            <div className="space-y-8 min-w-0">
              {/* Step 1: Branch Selection */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-line">
                <StepHeader
                  step="01"
                  title="Select Service Branch"
                  subtitle="Choose the facility nearest to your collection address."
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

              {/* Step 2: Services & Garments Selection */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-line">
                <StepHeader
                  step="02"
                  title="Choose Garments & Services"
                  subtitle={
                    branchId
                      ? `Available treatments at ${selectedBranch?.name || 'selected branch'}.`
                      : 'Please select a branch above to view available services.'
                  }
                />
                <div className="mt-6">
                  <GarmentServiceSelector
                    branchId={branchId}
                    selectedItems={orderItems}
                    onItemsChange={setOrderItems}
                    priority={priority}
                    onPriorityChange={setPriority}
                  />
                </div>
              </section>

              {/* Step 3: Schedule Collection Window */}
              <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-line">
                <StepHeader
                  step="03"
                  title="Pickup Time Window"
                  subtitle="Choose when our driver should arrive to collect your laundry."
                />

                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {quickSlots.map((slot) => {
                      const active = pickupTime === slot.value
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          onClick={() => {
                            setPickupTime(slot.value)
                            setUseCustomTime(false)
                          }}
                          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-brand bg-sky-50/80 ring-2 ring-brand'
                              : 'border-line bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className="text-xs font-bold text-ink">{slot.label}</p>
                          <p className="text-[11px] text-muted mt-0.5">{slot.time}</p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setUseCustomTime((v) => !v)}
                      className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1.5"
                    >
                      <Calendar className="size-3.5" />
                      {useCustomTime ? 'Hide custom time' : 'Choose custom date & time'}
                    </button>

                    {useCustomTime && (
                      <div className="mt-3 max-w-sm">
                        <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                          <span>Custom Pickup Date & Time</span>
                          <input
                            type="datetime-local"
                            min={earliestPickup()}
                            value={pickupTime}
                            onChange={(event) => setPickupTime(event.target.value)}
                            className="rounded-xl border border-line p-3 text-xs font-normal outline-none focus:border-brand focus:ring-2 focus:ring-sky-100 bg-canvas"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky Professional Order Checkout Card */}
            <aside className="w-full bg-ink text-white rounded-3xl p-6 sm:p-8 shadow-2xl lg:sticky lg:top-24 border border-white/10 min-h-[580px] flex flex-col justify-between">
              <div>
                {/* Checkout Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold uppercase tracking-wider text-white">
                        Order Checkout
                      </h2>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                        Live Pricing
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{selectedBranch ? selectedBranch.name : 'No branch selected'}</span>
                    </p>
                  </div>
                  <div className="size-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-sky-400 shadow-inner">
                    <Truck className="size-5" />
                  </div>
                </div>

                {orderItems.length === 0 ? (
                  <div className="py-10 px-5 text-center rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                    <span className="size-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-sky-300 mb-3 shadow-inner">
                      <Sparkles className="size-6" />
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-200">
                      No garments selected yet
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
                      Select your service and click any garment card above to calculate real-time
                      turnaround and pricing.
                    </p>
                    <div className="mt-6 w-full rounded-xl bg-white/5 p-3.5 border border-white/5 space-y-2.5 text-left">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Selected Branch</span>
                        <span className="text-sky-300 font-semibold">
                          {selectedBranch?.name || 'Please select a branch'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Collection Window</span>
                        <span className="text-slate-300 font-mono">
                          {quickSlots.find((s) => s.value === pickupTime)?.label || 'Custom'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Doorstep Collection & Delivery</span>
                        <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          Free
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between text-xs text-slate-400 px-0.5">
                      <span className="font-semibold text-slate-300">
                        {orderItems.length}{' '}
                        {orderItems.length === 1 ? 'service line' : 'service lines'}
                      </span>
                      <span className="font-mono text-slate-300 font-bold">
                        {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'}
                      </span>
                    </div>
                    <ul className="space-y-3 mb-6 divide-y divide-white/5 max-h-[350px] overflow-y-auto pr-1">
                      {orderItems.map((item, index) => (
                        <li
                          key={item.line_id || index}
                          className="pt-3 first:pt-0 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex-1 pr-2">
                            <span className="font-bold text-slate-100 block leading-snug break-words">
                              {item.item_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-500/25">
                                {item.service_name}
                              </span>
                              {item.piece_count > 1 && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                  {item.piece_count} pcs/item
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.quantity} × {formatNaira(item.unit_price)}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-white shrink-0 text-sm">
                            {formatNaira(item.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                {/* Price Breakdown */}
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between items-center">
                    <span>Garments Subtotal</span>
                    <span className="font-mono font-bold text-slate-100">
                      {formatNaira(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Collection & Delivery</span>
                    <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      FREE
                    </span>
                  </div>
                  {priority === 'express' && (
                    <div className="flex justify-between items-center text-emerald-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Zap className="size-3.5 fill-current" /> Express Turnaround (+
                        {expressPercent}%)
                      </span>
                      <span className="font-mono font-bold">+{formatNaira(expressSurcharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-3.5 border-t border-white/10 text-white">
                    <div>
                      <span className="text-sm font-bold block">Total Amount Due</span>
                      <span className="text-[10px] text-slate-400">
                        All local care taxes included
                      </span>
                    </div>
                    <span className="text-3xl font-black font-mono text-white tracking-tight">
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
                  disabled={submitting || orderItems.length === 0}
                  className="mt-6 w-full bg-brand hover:bg-brand-hover active:scale-[0.98] h-14 rounded-2xl text-white font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-sky-900/40"
                >
                  {submitting ? 'Confirming Order…' : 'Place Order & Schedule Pickup'}
                  {!submitting && <ArrowRight className="size-4" />}
                </button>

                <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] text-slate-400">
                  <p className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                    <span>100% Care Guarantee & SMS tracking updates.</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="size-3.5 text-accent shrink-0" />
                    <span>Free cancellation within 30 minutes of booking.</span>
                  </p>
                </div>
              </div>
            </aside>

            {/* Mobile Fixed Bottom Checkout Bar */}
            {orderItems.length > 0 && (
              <div className="fixed bottom-0 inset-x-0 bg-white/95 border-t border-line p-4 backdrop-blur-xl shadow-2xl flex items-center justify-between z-40 lg:hidden">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted">Total Due</p>
                  <p className="font-mono text-lg font-black text-ink">{formatNaira(grandTotal)}</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand text-white text-xs font-bold px-5 py-3 rounded-xl shadow-sm hover:bg-brand-hover active:scale-95 flex items-center gap-2"
                >
                  {submitting ? 'Placing…' : 'Confirm Order'}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function StepHeader({ step, title, subtitle }) {
  return (
    <div className="flex items-start gap-3.5 pb-4 border-b border-line">
      <span className="size-8 rounded-xl bg-sky-50 text-brand font-black text-xs flex items-center justify-center shrink-0 border border-sky-100">
        {step}
      </span>
      <div>
        <h2 className="text-base font-extrabold text-ink tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <section className="grid min-h-[75vh] place-items-center px-4 py-16 bg-canvas">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 sm:p-10 text-center shadow-xl">
        <span className="mx-auto size-14 place-items-center rounded-2xl bg-sky-50 text-brand flex items-center justify-center shadow-2xs">
          <BellRing className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-ink tracking-tight">
          Sign In to Book a Pickup
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Sign in or create an account to schedule laundry collections, customize your services, and
          track orders in real-time.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            to="/login"
            state={{ from: { pathname: '/order' } }}
            className="rounded-2xl bg-brand py-3.5 text-xs font-extrabold uppercase tracking-widest text-white transition hover:bg-brand-hover shadow-md shadow-sky-900/15"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-2xl border border-line py-3.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
    <section className="grid min-h-[75vh] place-items-center px-4 py-16 bg-canvas">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 sm:p-10 text-center shadow-xl">
        <span className="mx-auto size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-extrabold text-ink tracking-tight">
          Customer Booking Portal
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          You are signed in with a staff/operational account. Please use your internal workspace to
          process and dispatch orders.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block w-full rounded-2xl bg-ink py-3.5 text-xs font-bold text-white transition hover:bg-slate-800"
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
    <section className="grid min-h-[80vh] place-items-center px-4 py-16 bg-canvas">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-white shadow-2xl">
        <div className="relative h-44 w-full overflow-hidden bg-ink">
          <img
            src="/images/hero-laundry-full.jpg"
            alt="Clean laundry processing"
            className="size-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
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
          <h1 className="text-xl font-extrabold text-ink tracking-tight">
            Thank you! Your pickup is scheduled.
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            We've assigned your order to the branch team. Stock has been reserved and our staff will
            collect your garments at the requested window.
          </p>

          <ul className="mt-6 grid gap-3 border-t border-line pt-5">
            {timeline.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-xs">
                <span
                  className={`size-5 rounded-full flex items-center justify-center ${
                    step.done ? 'bg-brand text-white' : 'border-2 border-slate-200'
                  }`}
                >
                  {step.done && <Check className="size-3 stroke-[3]" />}
                </span>
                <span className={step.done ? 'font-bold text-ink' : 'text-slate-400'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <Link
              to={`/orders/${order._id}`}
              className="rounded-2xl bg-brand py-3.5 text-center text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-sky-900/15 transition hover:bg-brand-hover"
            >
              View Order Status
            </Link>
            <Link
              to="/home"
              className="rounded-2xl border border-line py-3.5 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
