import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { getOrders } from '../../api/orders.api'
import Button from '../../components/common/Button'
import ExportMenu from '../../components/common/ExportMenu'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import OrderTable from '../../components/orders/OrderTable'
import { formatNaira } from '../../utils/formatters'

const tabs = [
  'All',
  'Placed',
  'Received',
  'Processing',
  'Quality check',
  'Ready',
  'Delivered',
  'Cancelled',
]
const tones = ['lilac', 'mint', 'peach', 'blue', 'yellow']
const pageSize = 10

function formatOrder(order, index) {
  const customer = order.customer_id?.name ?? 'Customer'
  return {
    id: `ORD-${order._id.slice(-6).toUpperCase()}`,
    dbId: order._id,
    customer,
    initials: customer
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    service: order.items?.[0]?.name ?? 'Laundry service',
    pieces: order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0,
    branch: order.branch_id?.name ?? 'Branch',
    status: order.status,
    payment: order.payment_status,
    total: Number(order.amount_due) > 0 ? order.amount_due : order.total_price,
    tone: tones[index % tones.length],
  }
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const { branchId } = useOutletContext()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [tab, setTab] = useState('All')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    getOrders({ limit: 100, ...(branchId ? { branch_id: branchId } : {}) })
      .then((response) => {
        if (active) {
          setOrders(response.data.data.map(formatOrder))
          setError('')
          setPage(1)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Unable to load orders.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [branchId])

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesTab = tab === 'All' || order.status === tab.toLowerCase().replaceAll(' ', '_')
        const value = `${order.id} ${order.customer} ${order.service} ${order.branch}`.toLowerCase()
        return matchesTab && value.includes(query.toLowerCase())
      }),
    [orders, query, tab],
  )
  const totalPages = Math.max(Math.ceil(filteredOrders.length / pageSize), 1)
  const rows = filteredOrders.slice((page - 1) * pageSize, page * pageSize)
  const exportRows = filteredOrders.map((order) => ({ ...order, total: formatNaira(order.total) }))
  const exportColumns = [
    { key: 'id', label: 'Order' },
    { key: 'customer', label: 'Customer' },
    { key: 'service', label: 'Service' },
    { key: 'branch', label: 'Branch' },
    { key: 'status', label: 'Status' },
    { key: 'payment', label: 'Payment' },
    { key: 'total', label: 'Total' },
  ]

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Orders"
        subtitle="Track every order from intake to delivery."
      >
        <ExportMenu
          title="Suds Orders"
          filename={`suds-orders-${new Date().toISOString().slice(0, 10)}`}
          columns={exportColumns}
          rows={exportRows}
        />
        <Button primary onClick={() => navigate('/orders/new')}>
          <Plus className="size-4" /> New order
        </Button>
      </PageHeading>
      <Panel className="mb-3 flex flex-col justify-between gap-3 p-2 md:flex-row md:items-center">
        <div className="flex overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item)
                setPage(1)
              }}
              className={`rounded-md px-3 py-2 text-[10px] font-bold ${tab === item ? 'bg-violet-50 text-brand' : 'text-gray-500'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <SearchInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Search orders…"
          className="md:w-52"
        />
      </Panel>
      <Panel className="overflow-hidden">
        {loading && <p className="p-12 text-center text-xs text-gray-400">Loading orders…</p>}
        {error && <p className="p-12 text-center text-xs text-red-600">{error}</p>}
        {!loading && !error && rows.length > 0 && <OrderTable rows={rows} showActions />}
        {!loading && !error && rows.length === 0 && (
          <p className="p-12 text-center text-xs text-gray-400">No orders match your filters.</p>
        )}
        <footer className="flex items-center justify-between px-5 py-3 text-[10px] text-gray-400">
          <span>
            Showing {rows.length} of {filteredOrders.length} orders
          </span>
          <span className="flex items-center gap-2">
            <Button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </span>
        </footer>
      </Panel>
    </>
  )
}
