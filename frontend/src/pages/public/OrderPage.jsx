import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { getServices } from '../../api/services.api'
import { createOrder } from '../../api/orders.api'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { formatNaira } from '../../utils/formatters'

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
  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

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
    if (!branchId) return setFormError('Choose a branch to continue.')
    if (cartItems.length === 0) return setFormError('Add at least one service to your order.')
    if (!pickupTime) return setFormError('Choose a pickup time.')

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
      // Match the app's existing convention for telling the navbar bell to
      // refresh — placing an order also creates a real notification server-side.
      window.dispatchEvent(new Event('notifications:changed'))
      notify({
        tone: 'success',
        title: 'Order placed',
        message: "We'll notify you as it moves through wash, dry and pickup.",
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
        <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
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
    <section className="py-12 sm:py-16">
      <div className="mx-auto w-[92%] max-w-6xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">Book a pickup</p>
        <h1 className="mt-2 text-[1.8rem] font-extrabold tracking-tight text-ink sm:text-[2.1rem]">
          Let's get your laundry moving.
        </h1>
        <p className="mt-2 max-w-lg text-[13.5px] text-muted">
          Choose a branch, add your services and pick a pickup time — you'll get a notification
          the moment it's confirmed.
        </p>

        {optionsError && (
          <p className="mt-6 rounded-xl bg-red-50 p-3.5 text-[12.5px] font-semibold text-red-700">
            {optionsError}
          </p>
        )}

        {loadingOptions ? (
          <div className="mt-10 grid gap-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-8">
              {/* Step 1: branch */}
              <div>
                <StepLabel index="01" title="Choose a branch" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {branches.map((branch) => {
                    const selected = branch._id === branchId
                    return (
                      <button
                        type="button"
                        key={branch._id}
                        onClick={() => selectBranch(branch._id)}
                        className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-brand bg-sky-50/60 ring-1 ring-brand'
                            : 'border-line bg-white hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                            selected ? 'bg-brand text-white' : 'bg-gray-50 text-slate-500'
                          }`}
                        >
                          <Building2 className="size-4" />
                        </span>
                        <span>
                          <span className="block text-[13px] font-extrabold text-ink">
                            {branch.name}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-muted">
                            {branch.address}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {branches.length === 0 && (
                    <p className="text-[12.5px] text-muted">No branches are available right now.</p>
                  )}
                </div>
              </div>

              {/* Step 2: services */}
              <div>
                <StepLabel index="02" title="Add your services" />
                {!branchId && (
                  <p className="mt-4 text-[12.5px] text-muted">Choose a branch to see what's available.</p>
                )}
                {branchId && availableServices.length === 0 && (
                  <p className="mt-4 text-[12.5px] text-muted">
                    No services are currently listed for this branch.
                  </p>
                )}
                <div className="mt-4 grid gap-2.5">
                  {availableServices.map((service) => {
                    const quantity = cart[service._id] ?? 0
                    return (
                      <div
                        key={service._id}
                        className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
                          quantity > 0 ? 'border-brand/40 bg-sky-50/40' : 'border-line bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-extrabold text-ink">{service.name}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                            <span className="font-mono">{formatNaira(service.price)}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              {service.turnaround_hours}hr
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                          <button
                            type="button"
                            aria-label={`Remove one ${service.name}`}
                            disabled={quantity === 0}
                            onClick={() => setQuantity(service._id, quantity - 1)}
                            className="grid size-8 place-items-center rounded-lg border border-line text-slate-500 disabled:opacity-30"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-5 text-center text-[13px] font-bold text-ink">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Add one ${service.name}`}
                            onClick={() => setQuantity(service._id, quantity + 1)}
                            className="grid size-8 place-items-center rounded-lg border border-line text-slate-500 hover:border-slate-300"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step 3: schedule */}
              <div>
                <StepLabel index="03" title="Schedule pickup" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-[12.5px] font-bold text-slate-700">
                    Pickup time
                    <input
                      required
                      type="datetime-local"
                      min={earliestPickup()}
                      value={pickupTime}
                      onChange={(event) => setPickupTime(event.target.value)}
                      className="rounded-xl border border-line p-3 text-[13px] font-normal outline-none focus:border-sky-400"
                    />
                  </label>
                  <div className="grid gap-2 text-[12.5px] font-bold text-slate-700">
                    Priority
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPriority('normal')}
                        className={`rounded-xl border p-3 text-[12.5px] font-bold transition ${
                          priority === 'normal'
                            ? 'border-brand bg-sky-50 text-brand'
                            : 'border-line text-slate-500'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('express')}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border p-3 text-[12.5px] font-bold transition ${
                          priority === 'express'
                            ? 'border-accent bg-accent-light text-accent-hover'
                            : 'border-line text-slate-500'
                        }`}
                      >
                        <Zap className="size-3.5" />
                        Express
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <aside className="h-fit rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Order summary
              </p>
              {cartItems.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-muted">Your order is empty — add a service to get started.</p>
              ) : (
                <ul className="mt-3 grid gap-2.5">
                  {cartItems.map((item) => (
                    <li key={item.service._id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-slate-600">
                        {item.quantity} × {item.service.name}
                      </span>
                      <span className="font-mono font-semibold text-ink">
                        {formatNaira(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-[13px] font-bold text-ink">Total</span>
                <span className="font-mono text-lg font-extrabold text-ink">{formatNaira(total)}</span>
              </div>
              {formError && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-[12px] font-semibold text-red-700">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[13px] font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? 'Placing your order…' : 'Place order'}
                {!submitting && <ChevronRight className="size-4" />}
              </button>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="size-3.5" />
                You'll be notified at every step, from pickup to delivery.
              </p>
            </aside>
          </form>
        )}
      </div>
    </section>
  )
}

function StepLabel({ index, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[13px] font-semibold text-slate-300">{index}</span>
      <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
    </div>
  )
}

function SignInPrompt() {
  return (
    <section className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-sky-50 text-brand">
          <BellRing className="size-5" />
        </span>
        <h1 className="mt-5 text-lg font-extrabold text-ink">Sign in to book a pickup</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Create an account or sign in so we can track your order and notify you at every step.
        </p>
        <div className="mt-6 grid gap-2.5">
          <Link
            to="/login"
            state={{ from: { pathname: '/order' } }}
            className="rounded-xl bg-brand py-3 text-[13px] font-bold text-white transition hover:bg-sky-700"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-xl border border-line py-3 text-[13px] font-bold text-ink transition hover:border-slate-300"
          >
            Create an account
          </Link>
        </div>
      </div>
    </section>
  )
}

function WrongRoleNotice() {
  return (
    <section className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-accent-hover">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-5 text-lg font-extrabold text-ink">This page is for customer accounts</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          You're signed in with a staff account. Head to your workspace to view or manage orders
          there instead.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block w-full rounded-xl bg-ink py-3 text-[13px] font-bold text-white transition hover:bg-slate-800"
        >
          Go to workspace
        </Link>
      </div>
    </section>
  )
}

function Confirmation({ order }) {
  const reference = `ORD-${order._id.slice(-6).toUpperCase()}`
  const timeline = [
    { label: 'Order placed', done: true },
    { label: 'Picked up', done: false },
    { label: 'Processing', done: false },
    { label: 'Ready for delivery', done: false },
  ]

  return (
    <section className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-sm">
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Check className="size-5" />
        </span>
        <h1 className="mt-5 text-lg font-extrabold text-ink">Order placed</h1>
        <p className="mt-1 font-mono text-[13px] font-semibold text-brand">{reference}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          We've notified our team at your branch. You'll get a notification here and in your
          inbox at every step, from pickup to delivery.
        </p>

        <ul className="mt-6 grid gap-3 border-t border-line pt-5">
          {timeline.map((step) => (
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

        <div className="mt-7 grid gap-2.5">
          <Link
            to={`/orders/${order._id}`}
            className="rounded-xl bg-brand py-3 text-center text-[13px] font-bold text-white transition hover:bg-sky-700"
          >
            View order details
          </Link>
          <Link
            to="/home"
            className="rounded-xl border border-line py-3 text-center text-[13px] font-bold text-ink transition hover:border-slate-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  )
}
