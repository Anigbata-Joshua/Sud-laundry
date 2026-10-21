import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CircleDollarSign, Package, Plus, Shirt } from 'lucide-react'
import { getDashboardOverview } from '../../api/dashboard.api'
import Button from '../../components/common/Button'
import ExportMenu from '../../components/common/ExportMenu'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import MetricCard from '../../components/dashboard/MetricCard'
import OrderTable from '../../components/orders/OrderTable'
import { useAuth } from '../../hooks/useAuth'
import { formatNaira, formatOrderItem } from '../../utils/formatters'

const avatarTones = ['lilac', 'mint', 'peach', 'blue', 'yellow']

function formatOrders(orders) {
  return orders.map((order, index) => {
    const customer = order.customer_id?.name ?? 'Customer'
    const initials = customer
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return {
      id: `ORD-${order._id.slice(-6).toUpperCase()}`,
      dbId: order._id,
      customer,
      initials,
      service: order.items?.[0] ? formatOrderItem(order.items[0]) : 'Laundry service',
      pieces: order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0,
      branch: order.branch_id?.name ?? 'Branch',
      status: order.status,
      payment: order.payment_status,
      total: Number(order.amount_due) > 0 ? order.amount_due : order.total_price,
      tone: avatarTones[index % avatarTones.length],
    }
  })
}

function buildRevenueDays(entries) {
  const revenueByDate = new Map(
    entries.map((entry) => {
      const key =
        typeof entry._id === 'string'
          ? entry._id
          : `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}-${String(entry._id.day).padStart(2, '0')}`
      return [key, Number(entry.revenue ?? 0)]
    }),
  )

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 6 + index)
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    return {
      label: date.toLocaleDateString('en-NG', { weekday: 'short' }),
      revenue: revenueByDate.get(key) ?? 0,
    }
  })
}

function LoadingState() {
  return (
    <div className="grid min-h-80 place-items-center">
      <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { branchId } = useOutletContext()
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setOverview(await getDashboardOverview(branchId))
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to load overview data.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    let active = true

    getDashboardOverview(branchId)
      .then((data) => {
        if (active) setOverview(data)
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message ?? 'Unable to load overview data.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [branchId])

  const dashboard = useMemo(() => {
    if (!overview) return null

    const activeOrders = overview.orders.filter(
      (order) => !['delivered', 'cancelled'].includes(order.status),
    )
    const overdueOrders = activeOrders.filter(
      (order) => order.delivery_time && new Date(order.delivery_time) < new Date(),
    )
    const lowStockItems = overview.products.filter(
      (product) => product.quantity <= product.reorder_point,
    )
    const pendingLeave = overview.leaveRequests.filter((request) => request.status === 'pending')
    const revenueDays = buildRevenueDays(overview.revenueTrend)
    const rawRevenueChange = overview.revenueComparison?.percentChange
    const revenueChange =
      rawRevenueChange !== null &&
      rawRevenueChange !== undefined &&
      Number.isFinite(Number(rawRevenueChange))
        ? Number(rawRevenueChange)
        : null

    return {
      ordersToday: overview.todayOrderVolume.reduce((total, item) => total + item.count, 0),
      revenueToday: Number(overview.todayRevenue?.totalRevenue ?? 0),
      readyForPickup: overview.allOrderVolume.find((item) => item._id === 'ready')?.count ?? 0,
      overdueOrders,
      lowStockItems,
      pendingLeave,
      recentOrders: formatOrders(overview.orders.slice(0, 4)),
      revenueDays,
      revenueTotal: revenueDays.reduce((total, day) => total + day.revenue, 0),
      revenueChange,
    }
  }, [overview])

  if (loading) return <LoadingState />

  if (error) {
    return (
      <Panel className="mx-auto mt-20 max-w-md p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-red-500" />
        <h1 className="mt-4 text-lg font-extrabold">Overview unavailable</h1>
        <p className="mt-2 text-xs text-muted">{error}</p>
        <Button primary className="mt-5" onClick={loadOverview}>
          Try again
        </Button>
      </Panel>
    )
  }

  const maxRevenue = Math.max(...dashboard.revenueDays.map((day) => day.revenue), 1)
  const attentionCount =
    dashboard.overdueOrders.length + dashboard.lowStockItems.length + dashboard.pendingLeave.length
  const change = dashboard.revenueChange
  const changeLabel =
    change === null ? 'No prior-period data' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`

  const exportRows = [
    { metric: 'Orders today', value: dashboard.ordersToday },
    { metric: 'Revenue today', value: formatNaira(dashboard.revenueToday) },
    { metric: 'Ready for pickup', value: dashboard.readyForPickup },
  ]

  return (
    <>
      <PageHeading
        eyebrow={new Date().toLocaleDateString('en-NG', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={`Good morning, ${user?.name?.split(' ')[0] ?? 'Admin'}.`}
        subtitle="Here’s what needs your attention across all branches."
      >
        <ExportMenu
          title="Suds Operations Overview"
          filename={`suds-overview-${new Date().toISOString().slice(0, 10)}`}
          columns={[
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ]}
          rows={exportRows}
        />
        {user.role === 'admin' && (
          <Button primary onClick={() => navigate('/orders/new')}>
            <Plus className="size-4" /> New order
          </Button>
        )}
      </PageHeading>

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Shirt}
          tone="sky"
          label="Orders today"
          value={dashboard.ordersToday}
          note="Created since midnight"
        />
        <MetricCard
          icon={CircleDollarSign}
          tone="green"
          label="Revenue today"
          value={formatNaira(dashboard.revenueToday)}
          note="Completed payments"
        />
        <MetricCard
          icon={Package}
          tone="blue"
          label="Ready for pickup"
          value={dashboard.readyForPickup}
          note="Across all branches"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel className="p-5">
          <PanelTitle eyebrow="Performance" title="Revenue">
            <span className="text-[10px] text-gray-400">Last 7 days</span>
          </PanelTitle>
          <div className="my-4 flex items-center gap-2">
            <strong className="text-xl font-black text-ink">
              {formatNaira(dashboard.revenueTotal)}
            </strong>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-bold ${change !== null && change < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
            >
              {changeLabel}
            </span>
          </div>
          <div className="flex h-32 items-end gap-2 border-b border-gray-100 bg-[repeating-linear-gradient(#fff_0,#fff_30px,#f8fafc_31px)]">
            {dashboard.revenueDays.map((day, index) => (
              <div
                key={day.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <i
                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, 2)}%` }}
                  className={`w-2/3 rounded-t transition-all ${index === 6 ? 'bg-sky-600 shadow-xs' : 'bg-sky-200 hover:bg-sky-300'}`}
                  title={formatNaira(day.revenue)}
                />
                <small className="-mb-5 text-[9px] text-gray-400">{day.label}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelTitle eyebrow="Action centre" title="Needs attention">
            <b className="grid size-6 place-items-center rounded-lg bg-sky-50 text-[10px] font-extrabold text-sky-700 border border-sky-100">
              {attentionCount}
            </b>
          </PanelTitle>
          {dashboard.overdueOrders.length > 0 && (
            <Attention
              title={`${dashboard.overdueOrders.length} overdue order${dashboard.overdueOrders.length === 1 ? '' : 's'}`}
              subtitle="Past the promised delivery time"
            />
          )}
          {dashboard.lowStockItems.length > 0 && (
            <Attention
              title={`${dashboard.lowStockItems.length} products are low in stock`}
              subtitle={dashboard.lowStockItems
                .slice(0, 3)
                .map((item) => item.name)
                .join(', ')}
            />
          )}
          {dashboard.pendingLeave.length > 0 && (
            <Attention
              title={`${dashboard.pendingLeave.length} leave request${dashboard.pendingLeave.length === 1 ? '' : 's'} pending`}
              subtitle="Awaiting your review"
            />
          )}
          {attentionCount === 0 && (
            <p className="py-8 text-center text-xs text-gray-400">
              Nothing needs attention right now.
            </p>
          )}
          <button
            onClick={() => navigate('/orders')}
            className="mt-3 flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:text-sky-700"
          >
            View all activity <ArrowRight className="size-3.5" />
          </button>
        </Panel>
      </div>

      <Panel className="mt-4 p-5 pb-1">
        <PanelTitle eyebrow="Live activity" title="Recent orders">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:text-sky-700"
          >
            View all orders <ArrowRight className="size-3.5" />
          </button>
        </PanelTitle>
        {dashboard.recentOrders.length > 0 ? (
          <OrderTable rows={dashboard.recentOrders} />
        ) : (
          <p className="py-10 text-center text-xs text-gray-400">
            No orders have been created yet.
          </p>
        )}
      </Panel>
    </>
  )
}

function Attention({ title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-gray-100 py-3">
      <span className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-600">
        <AlertTriangle className="size-4" />
      </span>
      <div className="grid flex-1">
        <strong className="text-[11px]">{title}</strong>
        <small className="mt-1 text-[9px] text-gray-400">{subtitle}</small>
      </div>
    </div>
  )
}
