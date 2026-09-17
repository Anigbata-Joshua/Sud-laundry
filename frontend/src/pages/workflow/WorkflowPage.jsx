import { useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getOrders } from '../../api/orders.api'
import PageHeading from '../../components/common/PageHeading'

const stages = [
  ['placed', 'Intake', '#9b87f5'],
  ['received', 'Received', '#29b49b'],
  ['processing', 'Processing', '#f3a63b'],
  ['quality_check', 'Quality check', '#4c86df'],
  ['ready', 'Ready', '#35ad75'],
]

export default function WorkflowPage() {
  const navigate = useNavigate()
  const { branchId } = useOutletContext()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getOrders({ limit: 100, ...(branchId ? { branch_id: branchId } : {}) })
      .then((response) => {
        if (active) setOrders(response.data.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Unable to load workflow.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [branchId])

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)),
    [orders],
  )

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Workflow board"
        subtitle="A read-only view of order stages controlled by processing and task progress."
      />
      <p className="-mt-2 mb-4 text-[10px] text-muted">
        <b>{activeOrders.length}</b> active orders
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="py-20 text-center text-xs text-gray-400">Loading workflow…</p>
      ) : (
        <section className="grid grid-cols-[repeat(5,220px)] gap-2.5 overflow-x-auto xl:grid-cols-5">
          {stages.map(([status, title, color]) => {
            const stageOrders = activeOrders.filter((order) => order.status === status)
            return (
              <div
                key={status}
                className="min-h-103 rounded-xl border border-gray-200 bg-gray-100 p-2.5"
              >
                <header className="flex items-center gap-2 pb-2.5 text-[10px]">
                  <i style={{ background: color }} className="size-2 rounded-full" />
                  <strong>{title}</strong>
                  <b className="grid size-5 place-items-center rounded bg-gray-200 text-[9px]">
                    {stageOrders.length}
                  </b>
                </header>
                {stageOrders.map((order) => (
                  <article
                    key={order._id}
                    className="mb-2 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${order._id}`)}
                      className="flex w-full justify-between text-left text-[9px] font-bold text-sky-700"
                    >
                      ORD-{order._id.slice(-6).toUpperCase()}
                      <ExternalLink className="size-3.5" />
                    </button>
                    <h3 className="mt-2 mb-1 text-[11px] font-bold">
                      {order.customer_id?.name ?? 'Customer'}
                    </h3>
                    <p className="text-[9px] text-gray-400">
                      {order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0} items ·{' '}
                      {order.items?.[0]?.name ?? 'Laundry order'}
                    </p>
                    <small className="mt-3 flex items-center gap-1 text-[9px] capitalize text-gray-400">
                      <Clock3 className="size-3" />
                      {order.status.replaceAll('_', ' ')}
                    </small>
                  </article>
                ))}
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
