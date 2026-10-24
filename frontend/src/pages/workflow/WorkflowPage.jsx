import { useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink, User, RefreshCw, X } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getOrders } from '../../api/orders.api'
import { getProcessingWorkflows } from '../../api/processingWorkflows.api'
import PageHeading from '../../components/common/PageHeading'
import ReassignModal from '../../components/orders/ReassignModal'
import { formatOrderItem } from '../../utils/formatters'
import { useAuth } from '../../hooks/useAuth'

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
  const { user } = useAuth()
  const canManage = ['admin', 'branch_manager'].includes(user?.role)
  const [orders, setOrders] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reassignTarget, setReassignTarget] = useState(null)

  function loadData() {
    const params = { limit: 100, ...(branchId ? { branch_id: branchId } : {}) }
    Promise.all([
      getOrders(params),
      getProcessingWorkflows(branchId ? { branch_id: branchId } : {}).catch(() => ({
        data: { data: [] },
      })),
    ])
      .then(([ordersRes, workflowsRes]) => {
        setOrders(ordersRes.data.data || [])
        setWorkflows(workflowsRes.data?.data || [])
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message ?? 'Unable to load workflow.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const workflowsByOrder = useMemo(() => {
    const map = new Map()
    for (const wf of workflows) {
      const oId = wf.order_id?._id || wf.order_id
      if (!oId) continue
      const strId = String(oId)
      const existing = map.get(strId)
      if (
        !existing ||
        (existing.status !== 'active' && wf.status === 'active') ||
        wf.cycle > existing.cycle
      ) {
        map.set(strId, wf)
      }
    }
    return map
  }, [workflows])

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
                {stageOrders.map((order) => {
                  const workflow = workflowsByOrder.get(String(order._id))
                  const activeStep =
                    workflow?.steps?.find((s) => s.status !== 'completed') ||
                    workflow?.steps?.[workflow?.steps?.length - 1]
                  const attendant = activeStep?.employee_id
                  const attendantName = attendant?.user_id?.name || attendant?.job_title || null

                  return (
                    <article
                      key={order._id}
                      className="mb-2 rounded-lg border border-gray-200 bg-white p-3 shadow-2xs"
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
                        {order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0} items
                        · {order.items?.[0] ? formatOrderItem(order.items[0]) : 'Laundry order'}
                      </p>

                      {/* Attendant badge & quick Reassign */}
                      {['received', 'processing', 'quality_check'].includes(order.status) && (
                        <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-gray-100 pt-2 text-[10px]">
                          <span
                            className="flex items-center gap-1 font-semibold text-slate-700 truncate"
                            title={attendantName || 'Unassigned'}
                          >
                            <User className="size-3 text-sky-600 shrink-0" />
                            <span className="truncate">{attendantName || 'Unassigned'}</span>
                          </span>
                          {canManage && workflow && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReassignTarget({ workflow, order, activeStep })
                              }}
                              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold text-sky-700 hover:bg-sky-50 transition-colors"
                              title="Reassign attendant"
                            >
                              <RefreshCw className="size-2.5" /> Reassign
                            </button>
                          )}
                        </div>
                      )}

                      <small className="mt-2 flex items-center gap-1 text-[9px] capitalize text-gray-400">
                        <Clock3 className="size-3" />
                        {order.status.replaceAll('_', ' ')}
                      </small>
                    </article>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}

      {reassignTarget && (
        <ReassignModal
          isOpen={Boolean(reassignTarget)}
          onClose={() => setReassignTarget(null)}
          workflowId={reassignTarget.workflow._id}
          orderId={reassignTarget.order._id}
          branchId={reassignTarget.order.branch_id?._id || reassignTarget.order.branch_id}
          currentAttendantId={
            reassignTarget.activeStep?.employee_id?._id || reassignTarget.activeStep?.employee_id
          }
          onReassigned={(updatedWorkflow) => {
            setReassignTarget(null)
            if (updatedWorkflow) {
              setWorkflows((current) =>
                current.map((w) => (w._id === updatedWorkflow._id ? updatedWorkflow : w)),
              )
            }
            loadData()
          }}
        />
      )}
    </>
  )
}
