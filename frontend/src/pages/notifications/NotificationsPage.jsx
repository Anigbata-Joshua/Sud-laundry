import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import { useAuth } from '../../hooks/useAuth'

function getNotificationTitle(item) {
  if (item.type === 'other') {
    if (/stock|out of stock|shortage|restock/i.test(item.message)) {
      return 'Stock Alert'
    }
    if (/cancelled|cancellation/i.test(item.message)) {
      return 'Order Cancellation'
    }
    if (/leave/i.test(item.message)) {
      return 'Leave Request'
    }
    return 'Operational Alert'
  }
  return item.type.replaceAll('_', ' ')
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getNotifications({
        limit: 100,
        q: query || undefined,
        is_read: filter === 'unread' ? false : undefined,
      })
      setItems(response.data.data.items)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [filter, query])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  async function readOne(item) {
    if (!item.is_read) {
      await markNotificationRead(item._id)
      setItems((current) =>
        current.map((entry) => (entry._id === item._id ? { ...entry, is_read: true } : entry)),
      )
      window.dispatchEvent(new Event('notifications:changed'))
    }
  }

  async function handleItemClick(item) {
    await readOne(item)

    const isStockAlert = /stock|out of stock|shortage|restock/i.test(item.message)
    const canManageInventory = ['admin', 'branch_manager', 'inventory_officer'].includes(user?.role)

    if (isStockAlert && canManageInventory) {
      navigate('/inventory?view=needs-attention')
      return
    }

    if (item.order_id) {
      const orderId = typeof item.order_id === 'object' ? item.order_id._id : item.order_id
      if (orderId) {
        navigate(`/orders/${orderId}`)
      }
    }
  }

  async function readAll() {
    await markAllNotificationsRead()
    setItems((current) => current.map((item) => ({ ...item, is_read: true })))
    window.dispatchEvent(new Event('notifications:changed'))
  }

  return (
    <>
      <PageHeading
        eyebrow="Inbox"
        title="Notifications"
        subtitle="Stay current with order and operational updates."
      >
        <Button onClick={readAll}>
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </PageHeading>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:justify-between">
          <div className="flex gap-1">
            {['all', 'unread'].map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-[10px] font-bold capitalize ${filter === value ? 'bg-sky-50 text-brand' : 'text-gray-500'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <Search className="size-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notifications…"
              className="text-xs outline-none"
            />
          </label>
        </div>
        {loading && (
          <p className="p-10 text-center text-xs text-gray-400">Loading notifications…</p>
        )}
        {error && <p className="p-10 text-center text-xs text-red-600">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="p-12 text-center">
            <Bell className="mx-auto size-7 text-gray-300" />
            <p className="mt-3 text-xs text-gray-400">No notifications found.</p>
          </div>
        )}
        {!loading &&
          items.map((item) => (
            <button
              key={item._id}
              onClick={() => handleItemClick(item)}
              className={`flex w-full gap-3 border-b border-gray-100 p-4 text-left hover:bg-gray-50 transition cursor-pointer ${item.is_read ? 'bg-white' : 'bg-sky-50/50'}`}
            >
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${item.is_read ? 'bg-gray-200' : 'bg-brand'}`}
              />
              <div className="grid flex-1 gap-1">
                <div className="flex items-center justify-between">
                  <strong className="text-xs capitalize">{getNotificationTitle(item)}</strong>
                  {/stock|out of stock|shortage|restock/i.test(item.message) && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                      View attention list →
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-600">{item.message}</p>
                <small className="text-[9px] text-gray-400">
                  {new Date(item.sent_at ?? item.createdAt).toLocaleString('en-NG')}
                </small>
              </div>
            </button>
          ))}
      </Panel>
    </>
  )
}
