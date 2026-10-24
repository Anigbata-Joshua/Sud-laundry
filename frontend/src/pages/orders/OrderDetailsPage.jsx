import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Mail,
  MapPin,
  Phone,
  UserRound,
  RotateCcw,
  RefreshCw,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { forceCancelOrder, getOrder, updateOrder } from '../../api/orders.api'
import { getOrderPayments } from '../../api/payments.api'
import {
  getOrderProcessingWorkflows,
  reviewProcessingQuality,
  updateProcessingStep,
} from '../../api/processingWorkflows.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import ReassignModal from '../../components/orders/ReassignModal'
import { formatNaira, formatOrderItem } from '../../utils/formatters'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'
import CountdownTimer from '../../components/orders/CountdownTimer'
import { getCustomerStatusLabel } from '../../constants/orderStatusLabels'

// front_desk is who actually confirms intake in practice — this was
// missing before, meaning a front_desk user could never see or use the
// "Mark order received" action at all.
const CAN_RECEIVE_ROLES = ['admin', 'branch_manager', 'front_desk']
const CAN_MANAGE_ROLES = ['admin', 'branch_manager']
const CAN_QC_ROLES = ['admin', 'branch_manager', 'front_desk']

function formatTime(value, fallback) {
  return value ? new Date(value).toLocaleString('en-NG') : fallback
}

export default function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { prompt } = useDialog()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [payments, setPayments] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [qcActionBusy, setQcActionBusy] = useState(false)

  // Intake-correction form state — only relevant while status is 'placed'.
  const [intakeMode, setIntakeMode] = useState(false)
  const [intakeQuantities, setIntakeQuantities] = useState([])
  const [intakeNotes, setIntakeNotes] = useState('')

  const loadWorkflows = useCallback(() => {
    if (!id) return
    getOrderProcessingWorkflows(id)
      .then((response) => {
        setWorkflows(response.data.data || [])
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    let active = true
    getOrder(id).then((response) => {
      if (active) setOrder(response.data.data)
    })
    getOrderPayments(id)
      .then((response) => {
        if (active) setPayments(response.data.data?.payments ?? response.data.data?.items ?? [])
      })
      .catch(() => {})
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Unable to load order.')
      })
    loadWorkflows()
    return () => {
      active = false
    }
  }, [id, loadWorkflows])

  async function changeStatus(status) {
    const previousStatus = order.status
    setOrder((current) => ({ ...current, status }))
    setSaving(true)
    setError('')
    try {
      const response = await updateOrder(id, { status })
      const updatedOrder = response.data.data
      setOrder((current) => ({
        ...current,
        ...updatedOrder,
        customer_id:
          updatedOrder?.customer_id && typeof updatedOrder.customer_id === 'object'
            ? updatedOrder.customer_id
            : current?.customer_id,
        branch_id:
          updatedOrder?.branch_id && typeof updatedOrder.branch_id === 'object'
            ? updatedOrder.branch_id
            : current?.branch_id,
      }))
      loadWorkflows()
    } catch (requestError) {
      setOrder((current) => ({ ...current, status: previousStatus }))
      setError(requestError.response?.data?.message ?? 'Unable to update order status.')
    } finally {
      setSaving(false)
    }
  }

  function startIntakeCheck() {
    // Pre-fill with the customer's declared quantities — staff only edits
    // what's actually different, rather than retyping everything.
    setIntakeQuantities(order.items.map((item) => item.quantity))
    setIntakeNotes('')
    setIntakeMode(true)
  }

  async function confirmIntake() {
    if (intakeQuantities.some((qty) => !Number.isFinite(qty) || qty < 1)) {
      setError('Each item quantity must be a positive number.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await updateOrder(id, {
        status: 'received',
        intake_items: intakeQuantities.map((quantity) => ({ quantity })),
        intake_notes: intakeNotes.trim() || undefined,
      })
      const updatedOrder = response.data.data
      setOrder((current) => ({
        ...current,
        ...updatedOrder,
        customer_id:
          updatedOrder?.customer_id && typeof updatedOrder.customer_id === 'object'
            ? updatedOrder.customer_id
            : current?.customer_id,
        branch_id:
          updatedOrder?.branch_id && typeof updatedOrder.branch_id === 'object'
            ? updatedOrder.branch_id
            : current?.branch_id,
      }))
      setIntakeMode(false)
      loadWorkflows()
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to confirm intake.')
    } finally {
      setSaving(false)
    }
  }

  async function handleQcReview(result) {
    const activeWorkflow = workflows.find((w) => w.status === 'active') || workflows[0]
    if (!activeWorkflow) return
    let notes = ''
    if (result === 'fail') {
      const entered = await prompt('Why did quality control fail?', {
        title: 'QC Failure Reason',
        label: 'Inspection notes / rework reason',
        placeholder: 'e.g. Stains remain on fabric, requires re-wash',
        required: true,
        confirmLabel: 'Record QC Fail & Reprocess',
        tone: 'error',
      })
      if (!entered || !entered.trim()) return
      notes = entered.trim()
    }
    setQcActionBusy(true)
    setError('')
    try {
      const response = await reviewProcessingQuality(activeWorkflow._id, result, notes)
      const updatedWorkflow = response.data?.data
      if (updatedWorkflow) {
        setWorkflows((current) =>
          current.map((w) => (w._id === updatedWorkflow._id ? updatedWorkflow : w)),
        )
      }
      const refreshed = await getOrder(id)
      setOrder(refreshed.data.data)
      loadWorkflows()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Unable to record quality check result.')
    } finally {
      setQcActionBusy(false)
    }
  }

  async function handleAttendantStepAction(action) {
    const activeWorkflow = workflows.find((w) => w.status === 'active') || workflows[0]
    const activeStep =
      activeWorkflow?.steps?.find((s) => s.status !== 'completed') ||
      activeWorkflow?.steps?.[activeWorkflow?.steps?.length - 1]
    if (!activeWorkflow || !activeStep) return
    setSaving(true)
    setError('')
    try {
      await updateProcessingStep(activeWorkflow._id, activeStep._id, action)
      const refreshed = await getOrder(id)
      setOrder(refreshed.data.data)
      loadWorkflows()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Unable to update step.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelOrder() {
    const reason = await prompt('Enter reason for force-cancellation:', {
      title: 'Force-cancel order',
      label: 'Cancellation reason',
      placeholder: 'e.g. Customer requested immediate refund / item damaged',
      required: true,
      confirmLabel: 'Cancel order',
      tone: 'error',
    })
    if (!reason || !reason.trim()) return
    setSaving(true)
    try {
      const response = await forceCancelOrder(id, { reason: reason.trim() })
      const updatedOrder = response.data.data
      setOrder((current) => ({
        ...current,
        ...updatedOrder,
        customer_id:
          updatedOrder?.customer_id && typeof updatedOrder.customer_id === 'object'
            ? updatedOrder.customer_id
            : current?.customer_id,
        branch_id:
          updatedOrder?.branch_id && typeof updatedOrder.branch_id === 'object'
            ? updatedOrder.branch_id
            : current?.branch_id,
      }))
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to cancel order.')
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
  const canReceive = CAN_RECEIVE_ROLES.includes(user.role)
  const canManage = CAN_MANAGE_ROLES.includes(user.role)
  const canQc = CAN_QC_ROLES.includes(user.role)

  const activeWorkflow = workflows.find((w) => w.status === 'active') || workflows[0]
  const activeStep =
    activeWorkflow?.steps?.find((s) => s.status !== 'completed') ||
    activeWorkflow?.steps?.[activeWorkflow?.steps?.length - 1]
  const assignedEmployee = activeStep?.employee_id
  const assignedName = assignedEmployee?.user_id?.name || assignedEmployee?.job_title || null
  const isAssignedToCurrentUser =
    user.role === 'employee' &&
    (assignedEmployee?.user_id?._id || assignedEmployee?.user_id) === (user._id || user.id)

  return (
    <>
      <PageHeading
        eyebrow="Order details"
        title={`ORD-${order._id.slice(-6).toUpperCase()}`}
        subtitle={`Created ${formatTime(order.createdAt, 'Unknown')}`}
      >
        {canManage &&
          ['received', 'processing', 'quality_check'].includes(order.status) &&
          activeWorkflow && (
            <Button onClick={() => setReassignModalOpen(true)}>
              <RefreshCw className="size-4" /> Reassign attendant
            </Button>
          )}
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </PageHeading>
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 text-red-500 hover:text-red-700"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {user.role === 'customer' && <CustomerOrderTracker status={order.status} />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4">
          <Panel className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={order.status}
                label={user.role === 'customer' ? getCustomerStatusLabel(order.status) : undefined}
              />
              <StatusBadge status={order.payment_status} />
              <strong className="ml-auto text-xl">
                {formatNaira(order.amount_due ?? order.total_price)}
              </strong>
            </div>
            <CountdownTimer
              deliveryTime={order.delivery_time}
              processingStartedAt={order.processing_started_at}
              turnaroundHours={
                order.fulfillment?.turnaround_hours ||
                (order.express_surcharge > 0 || order.fulfillment?.priority === 'express' ? 24 : 48)
              }
              status={order.status}
            />

            {/* Quality Check Review Card */}
            {order.status === 'quality_check' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                      Quality Check Review
                    </h3>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Processing completed by <b>{assignedName || 'attendant'}</b>. Confirm garments
                      meet standards.
                    </p>
                  </div>
                  {canQc && activeWorkflow && (
                    <div className="flex items-center gap-2">
                      <Button
                        primary
                        disabled={qcActionBusy}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleQcReview('pass')}
                      >
                        <Check className="size-4" /> Pass QC
                      </Button>
                      <Button
                        disabled={qcActionBusy}
                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleQcReview('fail')}
                      >
                        <RotateCcw className="size-4" /> Fail & Rework
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attendant & Processing Assignment Card (visible to staff) */}
            {user.role !== 'customer' &&
              ['received', 'processing', 'quality_check', 'ready'].includes(order.status) && (
                <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                        Attendant Assignment{' '}
                        {activeWorkflow?.cycle > 1 ? `· Cycle ${activeWorkflow.cycle}` : ''}
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <UserRound className="size-4 text-sky-700" />
                        <span className="text-xs font-extrabold text-ink">
                          {assignedName ? assignedName : 'No attendant assigned (pending)'}
                        </span>
                        {activeStep?.status && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold capitalize text-sky-800 shadow-xs border border-sky-100">
                            {activeStep.status.replaceAll('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage &&
                      ['received', 'processing', 'quality_check'].includes(order.status) &&
                      activeWorkflow && (
                        <Button onClick={() => setReassignModalOpen(true)}>
                          <RefreshCw className="size-3.5" /> Reassign
                        </Button>
                      )}
                  </div>

                  {/* Attendant Action Buttons if user is assigned attendant */}
                  {isAssignedToCurrentUser && (
                    <div className="mt-3 pt-3 border-t border-sky-100 flex items-center gap-2">
                      {activeStep?.status === 'assigned' && (
                        <Button
                          primary
                          disabled={saving}
                          onClick={() => handleAttendantStepAction('accept')}
                        >
                          Accept task & begin processing
                        </Button>
                      )}
                      {activeStep?.status === 'accepted' && (
                        <Button
                          primary
                          disabled={saving}
                          onClick={() => handleAttendantStepAction('complete')}
                        >
                          <Check className="size-4" /> Complete processing (send to QC)
                        </Button>
                      )}
                    </div>
                  )}

                  {activeWorkflow?.qc_notes &&
                    ['processing', 'quality_check'].includes(order.status) &&
                    activeWorkflow.status !== 'completed' && (
                      <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                        <p className="font-bold">Rework requested from Quality Check:</p>
                        <p className="mt-0.5 italic">{activeWorkflow.qc_notes}</p>
                      </div>
                    )}
                </div>
              )}

            {canReceive && order.status === 'placed' && !intakeMode && (
              <Button primary className="mt-4" disabled={saving} onClick={startIntakeCheck}>
                Verify & mark received
              </Button>
            )}

            {canReceive && order.status === 'placed' && intakeMode && (
              <div className="mt-4 rounded-lg border border-line p-4">
                <h3 className="mb-1 text-xs font-extrabold">Confirm what actually arrived</h3>
                <p className="mb-3 text-[11px] text-gray-500">
                  Adjust quantities below to match what the customer physically dropped off. The
                  customer's original numbers are kept on record for reference.
                </p>
                <div className="grid gap-3">
                  {order.items.map((item, index) => (
                    <div
                      key={item.service_id ? `${item.service_id}-${index}` : index}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="flex-1">
                        {formatOrderItem(item)}{' '}
                        <span className="text-gray-400">
                          (declared {item.quantity}
                          {item.piece_count > 1 ? ` · ${item.piece_count} pcs/item` : ''})
                        </span>
                      </span>
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-lg border border-line p-2 text-xs"
                        value={intakeQuantities[index] ?? item.quantity}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          setIntakeQuantities((current) =>
                            current.map((qty, i) => (i === index ? value : qty)),
                          )
                        }}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  className="mt-3 w-full rounded-lg border border-line p-2 text-xs"
                  rows={2}
                  placeholder="Notes (optional) — e.g. '1 shirt missing, customer notified'"
                  value={intakeNotes}
                  onChange={(event) => setIntakeNotes(event.target.value)}
                />
                <div className="mt-3 flex gap-2">
                  <Button primary disabled={saving} onClick={confirmIntake}>
                    Confirm receipt
                  </Button>
                  <Button disabled={saving} onClick={() => setIntakeMode(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {canManage && order.status === 'ready' && (
              <Button
                primary
                className="mt-4"
                disabled={saving}
                onClick={() => changeStatus('delivered')}
              >
                Mark order delivered
              </Button>
            )}
            {canManage && !['delivered', 'cancelled'].includes(order.status) && (
              <Button className="mt-4 ml-2" disabled={saving} onClick={cancelOrder}>
                Force cancel
              </Button>
            )}
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line p-5 text-sm font-extrabold">Payments</h2>
            {payments.map((payment) => (
              <div
                key={payment._id}
                className="flex items-center gap-4 border-b border-line px-5 py-4 text-xs"
              >
                <span className="flex-1 capitalize">
                  {payment.transaction_type ?? 'payment'} · {payment.paymentMethod}
                </span>
                <StatusBadge status={payment.status} />
                <strong>{formatNaira(payment.amount)}</strong>
              </div>
            ))}
            {payments.length === 0 && (
              <p className="p-5 text-xs text-gray-400">No payments recorded.</p>
            )}
          </Panel>
          <Panel className="overflow-hidden">
            <h2 className="border-b border-line p-5 text-sm font-extrabold">Order items</h2>
            {order.items.map((item, index) => (
              <div
                key={item.service_id ? `${item.service_id}-${index}` : index}
                className="grid grid-cols-[1fr_auto_auto] gap-5 border-b border-gray-100 px-5 py-4 text-xs"
              >
                <span>
                  <strong className="block">{formatOrderItem(item)}</strong>
                  <small className="text-gray-400">
                    {item.item_category || item.category || 'Garment service'}
                    {item.piece_count > 1 ? ` · ${item.piece_count} pcs/item` : ''}
                  </small>
                </span>
                <span>
                  {item.quantity} {item.quantity === 1 ? 'item' : 'items'}
                  {item.unit_price ? ` @ ${formatNaira(item.unit_price)}` : ''}
                </span>
                <strong>{formatNaira(item.subtotal)}</strong>
              </div>
            ))}
            {/* Totals Breakdown */}
            <div className="bg-gray-50/50 p-5 text-xs space-y-2 border-t border-line">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal</span>
                <span>{formatNaira(order.total_price)}</span>
              </div>
              {order.express_surcharge > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Express Surcharge</span>
                  <span>+{formatNaira(order.express_surcharge)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-ink pt-2 border-t border-gray-200">
                <span>Total Amount Due</span>
                <span>
                  {formatNaira(
                    order.amount_due || order.total_price + (order.express_surcharge || 0),
                  )}
                </span>
              </div>
            </div>
          </Panel>
          {order.intake && (
            <Panel className="overflow-hidden">
              <h2 className="border-b border-line p-5 text-sm font-extrabold">Intake correction</h2>
              <div className="p-5 text-xs text-gray-600">
                <p className="mb-2">
                  Customer originally declared:{' '}
                  {order.intake.original_items
                    .map((item) => `${formatOrderItem(item)} × ${item.quantity}`)
                    .join(', ')}
                </p>
                {order.intake.notes && <p className="mb-2 italic">"{order.intake.notes}"</p>}
                <p className="text-gray-400">
                  Verified {formatTime(order.intake.verified_at, 'Unknown time')}
                </p>
              </div>
            </Panel>
          )}
        </div>
        <div className="grid content-start gap-4">
          {user.role === 'customer' ? (
            <>
              <Panel className="p-5 bg-gradient-to-br from-sky-50/40 via-white to-white border-sky-100">
                <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-brand">
                  Assigned Branch
                </h2>
                <Detail icon={Building2} value={branch?.name ?? 'Branch'} />
                <Detail icon={MapPin} value={branch?.address ?? 'Not provided'} />
                {branch?.phone && <Detail icon={Phone} value={branch.phone} />}
              </Panel>

              {branch?.phone && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-xs">
                  <p className="font-extrabold text-ink">Need to change your pickup?</p>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                    Contact your branch team directly for immediate assistance with your garments.
                  </p>
                  <a
                    href={`tel:${branch.phone}`}
                    className="mt-3 inline-flex items-center gap-1.5 font-bold text-brand hover:underline"
                  >
                    <Phone className="size-3.5" />
                    Call branch: {branch.phone}
                  </a>
                </div>
              )}
            </>
          ) : (
            <Panel className="p-5">
              <h2 className="mb-4 text-sm font-extrabold">Customer</h2>
              <Detail icon={UserRound} value={customer?.name ?? 'Customer'} />
              <Detail icon={Mail} value={customer?.email ?? 'Not provided'} />
              <Detail icon={Phone} value={customer?.phone ?? 'Not provided'} />
              <Detail icon={MapPin} value={customer?.address ?? 'Not provided'} />
            </Panel>
          )}

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
              value={`Received ${formatTime(order.received_at, 'Not received yet')}`}
            />
            <Detail
              icon={CalendarDays}
              value={`Delivered ${formatTime(order.delivered_at, 'Not delivered yet')}`}
            />
            <Detail
              icon={CalendarDays}
              value={
                order.actual_turnaround_hours != null
                  ? `${order.actual_turnaround_hours} hour turnaround (completed)`
                  : order.express_surcharge > 0 || order.fulfillment?.priority === 'express'
                    ? 'Express turnaround (24 hours)'
                    : order.fulfillment?.turnaround_hours
                      ? `${order.fulfillment.turnaround_hours} hour turnaround`
                      : 'Standard turnaround (48 hours)'
              }
            />
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Detail
                icon={CalendarDays}
                value={
                  order.delivery_time
                    ? `Estimated ready: ${formatTime(order.delivery_time, 'TBD')}`
                    : order.processing_started_at &&
                        (order.fulfillment?.turnaround_hours ||
                          (order.express_surcharge > 0 || order.fulfillment?.priority === 'express'
                            ? 24
                            : 48))
                      ? `Estimated ready: ${formatTime(new Date(new Date(order.processing_started_at).getTime() + (order.fulfillment?.turnaround_hours || (order.express_surcharge > 0 || order.fulfillment?.priority === 'express' ? 24 : 48)) * 3600 * 1000))}`
                      : 'Estimated ready: Within 24-48 hours'
                }
              />
            )}
          </Panel>
        </div>
      </div>

      {reassignModalOpen && activeWorkflow && (
        <ReassignModal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          workflowId={activeWorkflow._id}
          orderId={order._id}
          branchId={order.branch_id?._id || order.branch_id}
          currentAttendantId={activeStep?.employee_id?._id || activeStep?.employee_id}
          onReassigned={async (updatedWorkflow) => {
            if (updatedWorkflow) {
              setWorkflows((current) =>
                current.map((w) => (w._id === updatedWorkflow._id ? updatedWorkflow : w)),
              )
            }
            const refreshed = await getOrder(id)
            setOrder(refreshed.data.data)
            loadWorkflows()
          }}
        />
      )}
    </>
  )
}

function CustomerOrderTracker({ status }) {
  const steps = [
    { key: 'placed', label: 'Order Scheduled', desc: 'Pickup booked' },
    { key: 'received', label: 'Collected & Received', desc: 'At branch facility' },
    { key: 'processing', label: 'Washing & Care', desc: 'Care treatment' },
    { key: 'quality_check', label: 'Quality Check & Press', desc: 'Hand finished' },
    { key: 'delivered', label: 'Delivered', desc: 'Back with you' },
  ]

  const statusMap = {
    placed: 0,
    received: 1,
    in_progress: 2,
    processing: 2,
    washing: 2,
    drying: 2,
    ironing: 3,
    quality_check: 3,
    ready: 3,
    ready_for_delivery: 3,
    out_for_delivery: 3,
    delivered: 4,
    completed: 4,
  }

  const currentStep = statusMap[status] ?? 0
  const isCancelled = status === 'cancelled'

  if (isCancelled) {
    return (
      <Panel className="mb-4 p-5 border-rose-200 bg-rose-50/50">
        <div className="flex items-center gap-3 text-rose-700">
          <span className="size-8 rounded-full bg-rose-100 flex items-center justify-center font-bold">
            ✕
          </span>
          <div>
            <h3 className="font-extrabold text-sm">Order Cancelled</h3>
            <p className="text-xs text-rose-600">
              This pickup request was cancelled. Contact support or your branch if this was an
              error.
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel className="mb-5 p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
            Live Order Status
          </span>
          <h2 className="text-base font-extrabold text-ink">Fulfilment Progress</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Tracking Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative">
        {steps.map((s, idx) => {
          const isDone = idx < currentStep
          const isCurrent = idx === currentStep
          return (
            <div
              key={s.key}
              className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2.5"
            >
              <span
                className={`size-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 transition-all ${
                  isDone
                    ? 'bg-brand text-white shadow-xs'
                    : isCurrent
                      ? 'bg-brand text-white ring-4 ring-sky-100 scale-110 shadow-sm'
                      : 'border-2 border-slate-200 text-slate-400'
                }`}
              >
                {isDone ? <Check className="size-4 stroke-[3]" /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1 sm:flex-initial">
                <p
                  className={`text-xs font-bold leading-tight ${
                    isCurrent ? 'text-brand' : isDone ? 'text-ink' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-[10.5px] text-muted hidden sm:block mt-0.5">{s.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
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
