import { CreditCard, ExternalLink, Eye, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import Panel, { PanelTitle } from '../common/Panel'
import StatusBadge from '../tables/StatusBadge'
import { formatNaira } from '../../utils/formatters'

export default function BranchOverviewTab({ financials, orders }) {
  const paymentTotal =
    (financials.paymentMethods.card || 0) +
      (financials.paymentMethods.cash || 0) +
      (financials.paymentMethods.transfer || 0) || 1
  const cardPct = Math.round(((financials.paymentMethods.card || 0) / paymentTotal) * 100)
  const transferPct = Math.round(((financials.paymentMethods.transfer || 0) / paymentTotal) * 100)
  const cashPct = Math.round(((financials.paymentMethods.cash || 0) / paymentTotal) * 100)
  const orderTotal = orders.total || 1

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Payment Methods */}
        <Panel className="p-5">
          <PanelTitle eyebrow="Settlements" title="Payment methods breakdown">
            <span className="text-[10px] text-gray-400">
              {financials.transactionCount} transactions
            </span>
          </PanelTitle>

          <div className="mt-4 grid gap-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-sky-600" /> Card / POS
                </span>
                <span>
                  {formatNaira(financials.paymentMethods.card || 0)} ({cardPct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-sky-600 rounded-full" style={{ width: `${cardPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-emerald-500" /> Bank Transfer
                </span>
                <span>
                  {formatNaira(financials.paymentMethods.transfer || 0)} ({transferPct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${transferPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-amber-500" /> Cash
                </span>
                <span>
                  {formatNaira(financials.paymentMethods.cash || 0)} ({cashPct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${cashPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-3 flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Average Order Value:</span>
            <strong className="text-sm font-extrabold text-ink">
              {formatNaira(financials.averageOrderValue)}
            </strong>
          </div>
        </Panel>

        {/* Order Status Distribution */}
        <Panel className="p-5">
          <PanelTitle eyebrow="Operations" title="Order status distribution">
            <span className="text-[10px] text-gray-400">{orders.total} total orders</span>
          </PanelTitle>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Intake / Placed',
                count: orders.statusCounts.placed,
                color: 'text-sky-700 bg-sky-50',
              },
              {
                label: 'Received',
                count: orders.statusCounts.received,
                color: 'text-teal-600 bg-teal-50',
              },
              {
                label: 'Processing',
                count: orders.statusCounts.processing,
                color: 'text-amber-600 bg-amber-50',
              },
              {
                label: 'Quality Check',
                count: orders.statusCounts.quality_check,
                color: 'text-blue-600 bg-blue-50',
              },
              {
                label: 'Ready',
                count: orders.statusCounts.ready,
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                label: 'Delivered',
                count: orders.statusCounts.delivered,
                color: 'text-gray-700 bg-gray-100',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 p-3">
                <span className="text-[10px] font-bold text-gray-400 block">{item.label}</span>
                <strong
                  className={`mt-1 inline-block rounded-md px-2 py-0.5 text-sm font-black ${item.color}`}
                >
                  {item.count}
                </strong>
                <span className="mt-1 block text-[9px] text-gray-400">
                  {Math.round((item.count / orderTotal) * 100)}% of total
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Recent Orders Table */}
      <Panel className="overflow-hidden p-5">
        <PanelTitle eyebrow="Activity" title="Recent branch orders">
          <Link
            to="/orders"
            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
          >
            View all orders <ExternalLink className="size-3" />
          </Link>
        </PanelTitle>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-gray-400">
                <th className="pb-3">Order ID</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Items</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(orders.recent ?? []).map((order) => (
                <tr key={order._id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 font-mono font-bold text-brand">
                    ORD-{order._id.slice(-6).toUpperCase()}
                  </td>
                  <td className="py-3 font-semibold text-ink">
                    {order.customer_id?.name || 'Customer'}
                  </td>
                  <td className="py-3 text-gray-500">
                    {order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1} pcs
                  </td>
                  <td className="py-3 font-bold text-ink">
                    {formatNaira(order.amount_due ?? order.total_price)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.payment_status === 'partially_paid'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/orders/${order._id}`}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink inline-block"
                    >
                      <Eye className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.recent.length === 0 && (
            <p className="py-8 text-center text-xs text-gray-400">
              No orders recorded at this branch yet.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
