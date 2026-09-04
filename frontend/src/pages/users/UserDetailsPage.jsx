import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCustomerReport } from '../../api/users.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { formatNaira } from '../../utils/formatters'

export default function UserDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getCustomerReport(id)
      .then((response) => {
        if (active) setReport(response.data.data)
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message ?? 'Unable to load client report.'),
      )
    return () => {
      active = false
    }
  }, [id])
  if (error) return <Panel className="p-8 text-center text-xs text-red-600">{error}</Panel>
  if (!report)
    return <p className="py-20 text-center text-xs text-gray-400">Loading client report…</p>
  const { user, summary, orders } = report
  return (
    <>
      <PageHeading
        eyebrow="People · Client report"
        title={user.name}
        subtitle="Client details are read-only."
      >
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </PageHeading>
      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Total orders', summary.totalOrders],
          ['Delivered', summary.completedOrders],
          ['Paid value', formatNaira(summary.totalSpent)],
        ].map(([label, value]) => (
          <Panel key={label} className="p-5">
            <small className="text-[10px] text-gray-400">{label}</small>
            <strong className="mt-1 block text-xl">{value}</strong>
          </Panel>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="p-5">
          <h2 className="text-sm font-extrabold">Client</h2>
          <p className="mt-4 text-xs font-bold">{user.name}</p>
          <p className="mt-2 text-[11px] text-gray-500">{user.email}</p>
          <p className="mt-2 text-[11px] text-gray-500">{user.phone || 'No phone'}</p>
          <p className="mt-2 text-[11px] text-gray-500">{user.address || 'No address'}</p>
        </Panel>
        <Panel className="overflow-hidden">
          <h2 className="border-b border-line p-5 text-sm font-extrabold">Order history</h2>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-xs text-gray-400">No orders yet.</p>
          ) : (
            orders.map((order) => (
              <button
                key={order._id}
                onClick={() => navigate(`/orders/${order._id}`)}
                className="grid w-full grid-cols-[1fr_auto_auto] gap-4 border-b border-gray-100 p-4 text-left text-[11px] hover:bg-gray-50"
              >
                <span>
                  <strong>ORD-{order._id.slice(-6).toUpperCase()}</strong>
                  <small className="block text-gray-400">{order.branch_id?.name}</small>
                </span>
                <StatusBadge status={order.status} />
                <strong>{formatNaira(order.total_price)}</strong>
              </button>
            ))
          )}
        </Panel>
      </div>
    </>
  )
}
