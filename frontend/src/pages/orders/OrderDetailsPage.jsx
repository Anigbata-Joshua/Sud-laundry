import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CalendarDays, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrder, updateOrder } from '../../api/orders.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { formatNaira } from '../../utils/formatters'
import { useAuth } from '../../hooks/useAuth'

function formatTime(value, fallback) {
  return value ? new Date(value).toLocaleString('en-NG') : fallback
}

export default function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    getOrder(id)
      .then((response) => {
        if (active) setOrder(response.data.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Unable to load order.')
      })
    return () => {
      active = false
    }
  }, [id])

  async function changeStatus(status) {
    const previousStatus = order.status
    setOrder((current) => ({ ...current, status }))
    setSaving(true)
    setError('')
    try {
      const response = await updateOrder(id, { status })
      setOrder((current) => ({ ...current, ...response.data.data }))
    } catch (requestError) {
      setOrder((current) => ({ ...current, status: previousStatus }))
      setError(requestError.response?.data?.message ?? 'Unable to update order status.')
    } finally {
      setSaving(false)
    }
  }

  if (!order) {
    return (
      <Panel className={`p-8 text-center text-xs ${error ? 'text-red-600' : 'text-gray-400'}`}>
        {error || 'Loading order…'}
      </Panel>
    )
  }

  const customer = order.customer_id
  const branch = order.branch_id
  return (
    <>
      <PageHeading
        eyebrow="Order details"
        title={`ORD-${order._id.slice(-6).toUpperCase()}`}
        subtitle={`Created ${formatTime(order.createdAt, 'Unknown')}`}
      >
        {['admin', 'branch_manager'].includes(user.role) &&
          ['received', 'processing', 'quality_check'].includes(order.status) && (
            <Button primary onClick={() => navigate(`/orders/${id}/processing`)}>
              Create / view workflow
            </Button>
          )}
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </PageHeading>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.payment_status} />
              <strong className="ml-auto text-xl">{formatNaira(order.total_price)}</strong>
            </div>
            {['admin', 'branch_manager'].includes(user.role) && order.status === 'placed' && (
              <Button
                primary
                className="mt-4"
                disabled={saving}
                onClick={() => changeStatus('received')}
              >
                Mark order received
              </Button>
            )}
            {['admin', 'branch_manager'].includes(user.role) && order.status === 'ready' && (
              <Button
                primary
                className="mt-4"
                disabled={saving}
                onClick={() => changeStatus('delivered')}
              >
                Mark order delivered
              </Button>
            )}
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line p-5 text-sm font-extrabold">Order items</h2>
            {order.items.map((item) => (
              <div
                key={item.service_id}
                className="grid grid-cols-[1fr_auto_auto] gap-5 border-b border-gray-100 px-5 py-4 text-xs"
              >
                <span>
                  <strong className="block">{item.name}</strong>
                  <small className="text-gray-400">Service item</small>
                </span>
                <span>{item.quantity} pieces</span>
                <strong>{formatNaira(item.subtotal)}</strong>
              </div>
            ))}
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          <Panel className="p-5">
            <h2 className="mb-4 text-sm font-extrabold">Customer</h2>
            <Detail icon={UserRound} value={customer?.name ?? 'Customer'} />
            <Detail icon={Mail} value={customer?.email ?? 'Not provided'} />
            <Detail icon={Phone} value={customer?.phone ?? 'Not provided'} />
            <Detail icon={MapPin} value={customer?.address ?? 'Not provided'} />
          </Panel>
          <Panel className="p-5">
            <h2 className="mb-4 text-sm font-extrabold">Fulfilment timeline</h2>
            <Detail icon={Building2} value={branch?.name ?? 'Branch'} />
            <Detail icon={MapPin} value={branch?.address ?? 'Not provided'} />
            <Detail
              icon={CalendarDays}
              value={`Created ${formatTime(order.createdAt, 'Unknown')}`}
            />
            <Detail
              icon={CalendarDays}
              value={`Received ${formatTime(order.received_time, 'Not received yet')}`}
            />
            <Detail
              icon={CalendarDays}
              value={`Delivered ${formatTime(order.delivered_time, 'Not delivered yet')}`}
            />
            <Detail
              icon={CalendarDays}
              value={
                order.turnaround_hours == null
                  ? 'Turnaround unavailable'
                  : `${order.turnaround_hours} hour turnaround`
              }
            />
          </Panel>
        </div>
      </div>
    </>
  )
}

function Detail({ icon: Icon, value }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-[11px] text-gray-600">
      <Icon className="size-3.5 text-brand" />
      {value}
    </p>
  )
}
