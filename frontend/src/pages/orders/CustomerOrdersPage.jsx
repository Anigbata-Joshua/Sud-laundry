import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../../api/orders.api'
import Panel from '../../components/common/Panel'
import PageHeading from '../../components/common/PageHeading'
import StatusBadge from '../../components/tables/StatusBadge'
import { formatNaira } from '../../utils/formatters'
import { getCustomerStatusLabel } from '../../constants/orderStatusLabels'

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  return (
    <>
      <PageHeading eyebrow="Your account" title="My orders" subtitle="Track every order you've placed." />
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <Panel className="overflow-hidden">
        {loading && <p className="p-5 text-xs text-gray-400">Loading your orders…</p>}
        {!loading && orders.length === 0 && !error && (
          <p className="p-5 text-xs text-gray-400">You haven't placed any orders yet.</p>
        )}
        {orders.map((order) => (
          <Link
            key={order._id}
            to={`/orders/${order._id}`}
            className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 text-xs last:border-b-0 hover:bg-gray-50"
          >
            <strong className="text-brand">ORD-{order._id.slice(-6).toUpperCase()}</strong>
            <span className="text-gray-500">{order.branch_id?.name ?? 'Branch'}</span>
            <StatusBadge status={order.status} label={getCustomerStatusLabel(order.status)} />
            <strong className="ml-auto">{formatNaira(order.total_price)}</strong>
          </Link>
        ))}
      </Panel>
    </>
  )
}