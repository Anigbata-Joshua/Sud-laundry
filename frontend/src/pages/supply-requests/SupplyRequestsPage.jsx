import { useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import {
  approveSupplyRequest,
  getSupplyRequests,
  rejectSupplyRequest,
} from '../../api/supplyRequests.api'
import { getProducts } from '../../api/products.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'

const CAN_ACT_ROLES = ['admin', 'inventory_officer']

export default function SupplyRequestsPage() {
  const { user } = useAuth()
  const { prompt } = useDialog()
  const [requests, setRequests] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [reviewing, setReviewing] = useState(null)
  const [reviewItems, setReviewItems] = useState([])
  const [busy, setBusy] = useState('')

  const canAct = CAN_ACT_ROLES.includes(user.role)

  function load() {
    getSupplyRequests({ status: statusFilter || undefined })
      .then((response) => setRequests(response.data.data))
      .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load requests.'))
  }

  useEffect(() => {
    load()
    getProducts()
      .then((response) => setProducts(response.data.data))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  function openReview(request) {
    setReviewing(request)
    setReviewItems(
      request.calculated_items.map((item) => ({
        product_id: item.product_id ?? '',
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    )
  }

  function updateItem(index, field, value) {
    setReviewItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function removeItem(index) {
    setReviewItems((current) => current.filter((_, i) => i !== index))
  }

  function addItem() {
    setReviewItems((current) => [
      ...current,
      { product_id: '', product_name: '', quantity: 1, unit: '' },
    ])
  }

  async function confirmApprove() {
    if (reviewItems.length === 0) {
      setMessage('Add at least one item before approving.')
      return
    }
    if (reviewItems.some((item) => !item.product_id || !item.quantity || item.quantity <= 0)) {
      setMessage('Every item needs a product and a positive quantity.')
      return
    }
    setBusy(reviewing._id)
    setMessage('')
    try {
      await approveSupplyRequest(reviewing._id, { items: reviewItems })
      setReviewing(null)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to approve request.')
    } finally {
      setBusy('')
    }
  }

  async function reject(request) {
    const reason = await prompt('Reason for rejecting this request:', {
      title: 'Reject supply request',
      label: 'Rejection reason',
      placeholder: 'e.g. Current stock is allocated to existing orders / insufficient stock',
      required: true,
      confirmLabel: 'Reject request',
      tone: 'error',
    })
    if (!reason || !reason.trim()) return
    setBusy(request._id)
    setMessage('')
    try {
      await rejectSupplyRequest(request._id, { reason: reason.trim() })
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to reject request.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Inventory"
        title="Supply requests"
        subtitle="Review what attendants need before they start processing."
      />
      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
      <Panel className="mb-4 flex gap-2 p-3">
        {['pending', 'approved', 'rejected', ''].map((status) => (
          <button
            key={status || 'all'}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${statusFilter === status ? 'bg-sky-50 text-brand' : 'text-gray-500'}`}
          >
            {status || 'all'}
          </button>
        ))}
      </Panel>

      <div className="grid gap-4">
        {requests.map((request) => {
          const reference = `ORD-${request.order_id?._id?.slice(-6).toUpperCase() ?? '------'}`
          return (
            <Panel key={request._id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    {reference} · {request.branch_id?.name}
                  </p>
                  <h2 className="text-sm font-extrabold">
                    Requested by {request.requested_by?.user_id?.name ?? 'Attendant'}
                  </h2>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <div className="grid gap-1 p-4 text-xs">
                {(request.status === 'pending'
                  ? request.calculated_items
                  : request.approved_items
                ).map((item, index) => (
                  <p key={index} className="text-gray-600">
                    {item.product_name} × {item.quantity} {item.unit}
                    {!item.product_id && request.status === 'pending' && (
                      <span className="ml-2 text-red-600">— no matching product found</span>
                    )}
                  </p>
                ))}
              </div>
              {request.status === 'rejected' && request.rejection_reason && (
                <p className="border-t border-line bg-red-50 p-3 text-xs text-red-700">
                  Rejected: {request.rejection_reason}
                </p>
              )}
              {canAct && request.status === 'pending' && (
                <div className="flex gap-2 border-t border-line p-4">
                  <Button
                    primary
                    disabled={busy === request._id}
                    onClick={() => openReview(request)}
                  >
                    <Check className="size-4" /> Review & approve
                  </Button>
                  <Button disabled={busy === request._id} onClick={() => reject(request)}>
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              )}
            </Panel>
          )
        })}
        {requests.length === 0 && (
          <Panel className="p-12 text-center text-xs text-gray-400">
            No {statusFilter || ''} supply requests.
          </Panel>
        )}
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Panel className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Approve supply request</h2>
              <button type="button" onClick={() => setReviewing(null)}>
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Adjust quantities or products before disbursing — this is what actually gets deducted
              from stock.
            </p>
            <div className="mt-4 grid gap-3">
              {reviewItems.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                  <label className="grid gap-1 text-xs font-bold">
                    Product
                    <select
                      className="rounded-lg border border-line p-2 font-normal"
                      value={item.product_id}
                      onChange={(event) => {
                        const product = products.find((p) => p._id === event.target.value)
                        updateItem(index, 'product_id', event.target.value)
                        if (product) {
                          updateItem(index, 'product_name', product.name)
                          updateItem(index, 'unit', product.unit)
                        }
                      }}
                    >
                      <option value="">
                        {item.product_id ? item.product_name : 'Select a product'}
                      </option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name} ({product.quantity} {product.unit} in stock)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    Qty
                    <input
                      type="number"
                      min={1}
                      className="rounded-lg border border-line p-2"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, 'quantity', Number(event.target.value))
                      }
                    />
                  </label>
                  <Button type="button" onClick={() => removeItem(index)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" onClick={addItem}>
                <Plus className="size-4" /> Add item
              </Button>
              <Button primary disabled={busy === reviewing._id} onClick={confirmApprove}>
                {busy === reviewing._id ? 'Approving…' : 'Confirm & disburse'}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </>
  )
}
