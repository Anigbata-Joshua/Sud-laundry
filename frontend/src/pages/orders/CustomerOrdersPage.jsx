import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Calendar, Clock, Package, Plus } from 'lucide-react'
import { getMyOrders } from '../../api/orders.api'
import StatusBadge from '../../components/tables/StatusBadge'
import { formatNaira, formatOrderItem } from '../../utils/formatters'
import { getCustomerStatusLabel } from '../../constants/orderStatusLabels'

const COMPLETED_STATUSES = ['delivered', 'completed', 'cancelled']

function formatDateTime(dateString) {
  if (!dateString) return 'Date unavailable'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')

  useEffect(() => {
    let active = true
    getMyOrders()
      .then((response) => {
        if (active) setOrders(response.data.data?.items ?? response.data.data ?? [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Unable to load your orders.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const activeOrders = useMemo(
    () => orders.filter((o) => !COMPLETED_STATUSES.includes(o.status)),
    [orders],
  )

  const pastOrders = useMemo(
    () => orders.filter((o) => COMPLETED_STATUSES.includes(o.status)),
    [orders],
  )

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
            Customer Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">My Orders</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Follow your garments through pickup, washing, pressing, and doorstep delivery.
          </p>
        </div>

        <Link
          to="/order"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-sky-900/15 hover:bg-brand-hover active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="size-4" />
          <span>Book a Pickup</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[5px] ${
            activeTab === 'active'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-ink'
          }`}
        >
          <span>Active In-Progress</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              activeTab === 'active' ? 'bg-sky-50 text-brand' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {activeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-[5px] ${
            activeTab === 'past'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-ink'
          }`}
        >
          <span>Order History</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              activeTab === 'past' ? 'bg-sky-50 text-brand' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {pastOrders.length}
          </span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid gap-4 mt-4">
          {[0, 1].map((n) => (
            <div
              key={n}
              className="h-36 rounded-3xl border border-line bg-white p-6 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedOrders.length === 0 && !error && (
        <div className="rounded-3xl border border-line bg-white p-12 text-center shadow-xs">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-50 text-brand mb-4">
            <Package className="size-6" />
          </span>
          <h2 className="text-base font-extrabold text-ink">
            {activeTab === 'active' ? 'No active orders in progress' : 'No past orders found'}
          </h2>
          <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
            {activeTab === 'active'
              ? 'Ready for clean laundry? Schedule a collection and our driver will pick it up.'
              : 'Completed orders and digital invoices will be saved here for your records.'}
          </p>
          <div className="mt-6">
            <Link
              to="/order"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              Schedule a Pickup
            </Link>
          </div>
        </div>
      )}

      {/* Orders Grid */}
      {!loading && displayedOrders.length > 0 && (
        <div className="grid gap-4">
          {displayedOrders.map((order) => {
            const reference = `ORD-${order._id.slice(-6).toUpperCase()}`
            const total = order.amount_due || order.total_price + (order.express_surcharge || 0)

            return (
              <div
                key={order._id}
                className="rounded-3xl border border-line bg-white p-5 sm:p-6 shadow-xs hover:border-sky-200 hover:shadow-md transition-all flex flex-col justify-between gap-5"
              >
                {/* Top Row: Ref, Branch, Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-ink">{reference}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      <Building2 className="size-3 text-brand" />
                      {order.branch_id?.name ?? 'Branch'}
                    </span>
                  </div>

                  <StatusBadge status={order.status} label={getCustomerStatusLabel(order.status)} />
                </div>

                {/* Middle Row: Items & Schedule */}
                <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr] items-center">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Garments & Services
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-2">
                      {order.items?.map(formatOrderItem).join(' • ') || 'Custom laundry service'}
                    </p>
                  </div>

                  <div className="sm:border-l sm:border-line/60 sm:pl-4 space-y-1 text-xs">
                    <p className="text-muted flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>Placed: {formatDateTime(order.createdAt)}</span>
                    </p>
                    {order.pickup_time && (
                      <p className="text-muted flex items-center gap-1.5">
                        <Clock className="size-3.5 text-brand" />
                        <span>Pickup: {formatDateTime(order.pickup_time)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Price & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Total Amount
                    </span>
                    <span className="font-mono text-base font-extrabold text-brand">
                      {formatNaira(total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/orders/${order._id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-brand-hover active:scale-95 transition-all"
                    >
                      <span>Track Progress</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
