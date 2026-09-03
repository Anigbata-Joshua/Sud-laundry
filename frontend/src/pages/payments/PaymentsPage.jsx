import { useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, Plus, RotateCcw, WalletCards, X } from 'lucide-react'
import { getOrders } from '../../api/orders.api'
import { createPayment, getPayments, refundPayment } from '../../api/payments.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import MetricCard from '../../components/dashboard/MetricCard'
import StatusBadge from '../../components/tables/StatusBadge'
import { formatNaira } from '../../utils/formatters'

const emptyPayment = {
  orderId: '',
  amount: '',
  paymentMethod: 'cash',
  transaction_ref: '',
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [refundForm, setRefundForm] = useState({ payment: null, amount: '', reason: '' })
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    Promise.all([getPayments({ limit: 200 }), getOrders({ limit: 100 })])
      .then(([paymentResponse, orderResponse]) => {
        setPayments(paymentResponse.data.data.items)
        setOrders(orderResponse.data.data)
        setMessage('')
      })
      .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load payments.'))
  }

  useEffect(load, [])

  const completed = payments.filter((payment) => payment.status === 'completed')
  const refundedPaymentIds = new Set(
    completed
      .filter((payment) => payment.transaction_type === 'refund')
      .map((payment) => payment.refunded_payment_id?._id ?? payment.refunded_payment_id),
  )
  const netRevenue = completed.reduce(
    (sum, payment) =>
      sum +
      (payment.net_amount ??
        (payment.transaction_type === 'refund' ? -payment.amount : payment.amount)),
    0,
  )
  const refunds = completed
    .filter((payment) => payment.transaction_type === 'refund')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const collected = completed
    .filter((payment) => payment.transaction_type !== 'refund')
    .reduce((sum, payment) => sum + payment.amount, 0)

  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) => {
        const order = payment.orderId
        const reference = order?._id ? `ORD-${order._id.slice(-6).toUpperCase()}` : ''
        const value = `${reference} ${payment.customer_Name ?? ''} ${payment.paymentMethod} ${payment.transaction_ref ?? ''}`
        return value.toLowerCase().includes(query.toLowerCase())
      }),
    [payments, query],
  )

  function updatePayment(event) {
    setPaymentForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submitPayment(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await createPayment({ ...paymentForm, amount: Number(paymentForm.amount) })
      setPaymentOpen(false)
      setPaymentForm(emptyPayment)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to record payment.')
    } finally {
      setSaving(false)
    }
  }

  async function submitRefund(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await refundPayment(refundForm.payment._id, {
        amount: Number(refundForm.amount),
        reason: refundForm.reason,
      })
      setRefundForm({ payment: null, amount: '', reason: '' })
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to record refund.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Finance"
        title="Payments"
        subtitle="Record collections, monitor balances, and process refunds."
      >
        <Button primary onClick={() => setPaymentOpen(true)}>
          <Plus className="size-4" /> Record payment
        </Button>
      </PageHeading>
      <section className="mb-3 grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          tone="green"
          label="Net revenue"
          value={formatNaira(netRevenue)}
          note={`${formatNaira(collected)} collected`}
        />
        <MetricCard
          icon={RotateCcw}
          tone="coral"
          label="Refunded"
          value={formatNaira(refunds)}
          note="Deducted from revenue"
        />
        <MetricCard
          icon={WalletCards}
          tone="violet"
          label="Transactions"
          value={String(completed.length)}
          note={`${payments.length - completed.length} unsuccessful`}
        />
      </section>

      <Panel className="overflow-hidden">
        <div className="border-b border-line p-4">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search payments…"
            className="max-w-sm"
          />
        </div>
        {message && <p className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead>
              <tr>
                {[
                  'Order',
                  'Customer',
                  'Type',
                  'Method',
                  'Amount',
                  'Classification',
                  'Status',
                  'Date',
                  '',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-line px-4 py-3 text-[9px] uppercase tracking-wider text-gray-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((payment) => {
                const isRefund = payment.transaction_type === 'refund'
                const orderId = payment.orderId?._id
                return (
                  <tr key={payment._id} className="border-b border-gray-100 text-gray-600">
                    <td className="px-4 py-3 font-bold text-brand">
                      {orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : 'Order'}
                    </td>
                    <td className="px-4 py-3">
                      {payment.customer_Name || payment.orderId?.customer_id?.name || 'Customer'}
                    </td>
                    <td className="px-4 py-3 capitalize">{isRefund ? 'Refund' : 'Payment'}</td>
                    <td className="px-4 py-3 capitalize">{payment.paymentMethod}</td>
                    <td
                      className={`px-4 py-3 font-bold ${isRefund ? 'text-red-600' : 'text-gray-800'}`}
                    >
                      {isRefund ? '−' : ''}
                      {formatNaira(payment.amount)}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {isRefund ? payment.refund_reason : payment.paymentType}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3">
                      {new Date(payment.createdAt).toLocaleDateString('en-NG')}
                    </td>
                    <td className="px-4 py-3">
                      {!isRefund &&
                        payment.status === 'completed' &&
                        !refundedPaymentIds.has(payment._id) && (
                          <Button
                            onClick={() => setRefundForm({ payment, amount: '', reason: '' })}
                          >
                            <RotateCcw className="size-3.5" /> Refund
                          </Button>
                        )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visiblePayments.length === 0 && (
          <p className="p-12 text-center text-xs text-gray-400">No payments found.</p>
        )}
      </Panel>

      {paymentOpen && (
        <Modal title="Record payment" onClose={() => setPaymentOpen(false)}>
          <form className="grid gap-4" onSubmit={submitPayment}>
            <Field label="Order">
              <select required name="orderId" value={paymentForm.orderId} onChange={updatePayment}>
                <option value="">Select any order</option>
                {orders
                  .filter((order) => !['paid', 'refunded'].includes(order.payment_status))
                  .map((order) => (
                    <option key={order._id} value={order._id}>
                      ORD-{order._id.slice(-6).toUpperCase()} ·{' '}
                      {order.customer_id?.name ?? 'Customer'} ·{' '}
                      {formatNaira(order.amount_due ?? order.total_price)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                name="amount"
                value={paymentForm.amount}
                onChange={updatePayment}
              />
            </Field>
            <Field label="Payment method">
              <select
                name="paymentMethod"
                value={paymentForm.paymentMethod}
                onChange={updatePayment}
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="card">Card</option>
              </select>
            </Field>
            {paymentForm.paymentMethod !== 'cash' && (
              <Field label="Paystack transaction reference">
                <input
                  required
                  name="transaction_ref"
                  value={paymentForm.transaction_ref}
                  onChange={updatePayment}
                />
              </Field>
            )}
            <Button primary type="submit" disabled={saving}>
              {saving ? 'Recording…' : 'Record payment'}
            </Button>
          </form>
        </Modal>
      )}

      {refundForm.payment && (
        <Modal
          title="Refund payment"
          onClose={() => setRefundForm({ payment: null, amount: '', reason: '' })}
        >
          <form className="grid gap-4" onSubmit={submitRefund}>
            <p className="rounded-lg bg-gray-50 p-3 text-xs">
              Original payment: <strong>{formatNaira(refundForm.payment.amount)}</strong>
            </p>
            <Field label="Refund amount">
              <input
                required
                min="0.01"
                max={refundForm.payment.amount}
                step="0.01"
                type="number"
                value={refundForm.amount}
                onChange={(event) =>
                  setRefundForm((current) => ({ ...current, amount: event.target.value }))
                }
              />
            </Field>
            <Field label="Refund reason">
              <textarea
                required
                rows="4"
                value={refundForm.reason}
                onChange={(event) =>
                  setRefundForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </Field>
            <Button primary type="submit" disabled={saving}>
              {saving ? 'Refunding…' : 'Confirm refund'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Panel className="w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </Panel>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-xs font-bold">
      {label}
      <span className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-line [&>input]:p-3 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-line [&>select]:bg-white [&>select]:p-3 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-line [&>textarea]:p-3">
        {children}
      </span>
    </label>
  )
}
