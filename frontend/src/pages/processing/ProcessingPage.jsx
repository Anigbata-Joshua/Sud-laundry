import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEmployees } from '../../api/employees.api'
import { getOrder } from '../../api/orders.api'
import {
  createProcessingWorkflow,
  getOrderProcessingWorkflows,
  getProcessingWorkflows,
  reviewProcessingQuality,
  updateProcessingStep,
} from '../../api/processingWorkflows.api'
import { createSupplyRequest } from '../../api/supplyRequests.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'

const emptyStep = { name: '', employee_id: '' }
const SUPPLY_STAGES = ['washing', 'processing', 'packaging']

export default function ProcessingPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState([])
  const [order, setOrder] = useState(null)
  const [employees, setEmployees] = useState([])
  const [steps, setSteps] = useState([{ ...emptyStep }])
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [view, setView] = useState('active')
  const [customerQuery, setCustomerQuery] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const canManage = ['admin', 'branch_manager'].includes(user.role)
  const { prompt } = useDialog()

  function load() {
    const request = orderId ? getOrderProcessingWorkflows(orderId) : getProcessingWorkflows()
    request
      .then((response) => setWorkflows(response.data.data))
      .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load processing.'))
  }

  useEffect(() => {
    load()
    if (orderId) {
      getOrder(orderId)
        .then((response) => setOrder(response.data.data))
        .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load order.'))
    }
    if (orderId && canManage) {
      getEmployees()
        .then((response) => setEmployees(response.data.data))
        .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load employees.'))
    }
    // Reload only when the selected order changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const branchEmployees = useMemo(() => {
    if (!order) return employees
    const branchId = order.branch_id?._id ?? order.branch_id
    return employees.filter(
      (employee) => (employee.branch_id?._id ?? employee.branch_id) === branchId,
    )
  }, [employees, order])

  const hasActiveWorkflow = workflows.some((workflow) => workflow.status === 'active')
  const canCreate = order && ['received', 'processing'].includes(order.status) && !hasActiveWorkflow
  const visibleWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      // A workflow marked 'completed' still needs a QC decision while its
      // order is 'quality_check' — that's an open action, not history.
      const awaitingQualityCheck =
        workflow.status === 'completed' && workflow.order_id?.status === 'quality_check'
      const isHistory =
        ['completed', 'qc_failed'].includes(workflow.status) && !awaitingQualityCheck
      if ((view === 'history') !== isHistory) return false
      const customer = workflow.order_id?.customer_id?.name ?? ''
      if (!customer.toLowerCase().includes(customerQuery.toLowerCase())) return false
      if (historyDate && new Date(workflow.createdAt).toISOString().slice(0, 10) !== historyDate) {
        return false
      }
      return true
    })
  }, [customerQuery, historyDate, view, workflows])

  function updateStep(index, field, value) {
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? { ...step, [field]: value } : step)),
    )
  }

  async function createWorkflow(event) {
    event.preventDefault()
    setBusy('create')
    setMessage('')
    try {
      await createProcessingWorkflow({ order_id: orderId, steps })
      setSteps([{ ...emptyStep }])
      setCreating(false)
      setOrder((current) => ({ ...current, status: 'processing' }))
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to create workflow.')
    } finally {
      setBusy('')
    }
  }

  async function actOnStep(workflowId, stepId, action) {
    setBusy(stepId)
    setMessage('')
    try {
      await updateProcessingStep(workflowId, stepId, action)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to update task.')
    } finally {
      setBusy('')
    }
  }

  async function review(workflowId, result) {
    let notes = ''
    if (result === 'fail') {
      const entered = await prompt('Why did quality control fail?', {
        title: 'QC Failure Reason',
        label: 'Inspection notes / rework reason',
        placeholder: 'e.g. Stains remain on fabric, requires re-wash',
        required: true,
        confirmLabel: 'Record QC Fail',
        tone: 'error',
      })
      if (entered === null) return
      notes = entered
    }
    setBusy(workflowId)
    setMessage('')
    try {
      await reviewProcessingQuality(workflowId, result, notes)
      setOrder((current) => ({ ...current, status: result === 'pass' ? 'ready' : 'processing' }))
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to record quality result.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Internal operations"
        title={
          orderId
            ? `Processing ${order ? `ORD-${order._id.slice(-6).toUpperCase()}` : ''}`
            : user.role === 'employee'
              ? 'My tasks'
              : 'Processing'
        }
        subtitle={
          orderId
            ? 'Build and monitor this order’s internal process.'
            : 'Monitor internal processing workflows and assigned tasks.'
        }
      >
        {orderId && (
          <Button onClick={() => navigate(`/orders/${orderId}`)}>
            <ArrowLeft className="size-4" /> Order details
          </Button>
        )}
        {orderId && canManage && canCreate && (
          <Button primary onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create workflow
          </Button>
        )}
      </PageHeading>

      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
      <Panel className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex rounded-lg bg-gray-50 p-1">
          {['active', 'history'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${view === item ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}
            >
              {item}
            </button>
          ))}
        </div>
        {view === 'history' && (
          <>
            <input
              className="rounded-lg border border-line p-2 text-xs"
              type="date"
              value={historyDate}
              onChange={(event) => setHistoryDate(event.target.value)}
            />
            <input
              className="rounded-lg border border-line p-2 text-xs sm:w-64"
              placeholder="Filter by customer name"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
            />
          </>
        )}
      </Panel>
      {orderId && order && (
        <Panel className="mb-4 flex items-center gap-3 p-4 text-xs">
          <StatusBadge status={order.status} />
          <span>{order.customer_id?.name ?? 'Customer'}</span>
          {!canCreate && workflows.length === 0 && (
            <span className="ml-auto text-gray-400">
              Set this order to Received before creating a workflow.
            </span>
          )}
        </Panel>
      )}

      <div className="grid gap-4">
        {visibleWorkflows.map((workflow) => (
          <WorkflowCard
            key={workflow._id}
            workflow={workflow}
            user={user}
            busy={busy}
            canManage={canManage}
            orderPage={Boolean(orderId)}
            onStepAction={actOnStep}
            onReview={review}
          />
        ))}
        {visibleWorkflows.length === 0 && (
          <Panel className="p-12 text-center text-xs text-gray-400">
            {view === 'history'
              ? 'No completed workflows match these filters.'
              : 'No active processing workflows.'}
          </Panel>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Panel className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Create processing workflow</h2>
              <button type="button" onClick={() => setCreating(false)}>
                <X className="size-5" />
              </button>
            </div>
            <form className="mt-5 grid gap-3" onSubmit={createWorkflow}>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <Field label={`Process ${index + 1}`}>
                    <select
                      required
                      value={step.name}
                      onChange={(event) => updateStep(index, 'name', event.target.value)}
                    >
                      <option value="">Select stage</option>
                      {[
                        'intake',
                        'washing',
                        'processing',
                        'quality_check',
                        'packaging',
                        'delivery_ready',
                      ].map((stage) => (
                        <option key={stage} value={stage}>
                          {stage.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Assigned employee">
                    <select
                      required
                      value={step.employee_id}
                      onChange={(event) => updateStep(index, 'employee_id', event.target.value)}
                    >
                      <option value="">Select employee</option>
                      {branchEmployees.map((employee) => (
                        <option key={employee._id} value={employee._id}>
                          {employee.user_id?.name} · {employee.job_title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    type="button"
                    disabled={steps.length === 1}
                    onClick={() =>
                      setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                onClick={() => setSteps((current) => [...current, { ...emptyStep }])}
              >
                <Plus className="size-4" /> Add process
              </Button>
              <Button primary type="submit" disabled={busy === 'create'}>
                {busy === 'create' ? 'Creating…' : 'Create workflow and begin processing'}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </>
  )
}

function WorkflowCard({ workflow, user, busy, canManage, orderPage, onStepAction, onReview }) {
  const order = workflow.order_id
  const [requestedSteps, setRequestedSteps] = useState({})
  const [supplyBusy, setSupplyBusy] = useState('')
  const [supplyMessage, setSupplyMessage] = useState({})

  async function requestSupplies(stepId) {
    setSupplyBusy(stepId)
    setSupplyMessage((current) => ({ ...current, [stepId]: '' }))
    try {
      const response = await createSupplyRequest({ workflow_id: workflow._id, step_id: stepId })
      const items = response.data.data.calculated_items
      setRequestedSteps((current) => ({ ...current, [stepId]: true }))
      setSupplyMessage((current) => ({
        ...current,
        [stepId]:
          items.length > 0
            ? `Requested: ${items.map((item) => `${item.product_name} × ${item.quantity}`).join(', ')}. Waiting on officer approval.`
            : 'Request sent — awaiting officer approval.',
      }))
    } catch (error) {
      setSupplyMessage((current) => ({
        ...current,
        [stepId]: error.response?.data?.message ?? 'Unable to request supplies.',
      }))
    } finally {
      setSupplyBusy('')
    }
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Cycle {workflow.cycle}
          </p>
          <h2 className="text-sm font-extrabold">{order?.customer_id?.name ?? 'Laundry order'}</h2>
        </div>
        <StatusBadge status={workflow.status} />
        {!orderPage && (
          <Link
            className="ml-auto text-xs font-bold text-brand"
            to={`/orders/${order?._id}/processing`}
          >
            Open workflow
          </Link>
        )}
      </div>
      <div className="grid gap-0 p-4">
        {workflow.steps.map((step, index) => {
          const assignedUser = step.employee_id?.user_id
          const isMine = (assignedUser?._id ?? assignedUser) === (user._id ?? user.id)
          const previousComplete = workflow.steps
            .slice(0, index)
            .every((item) => item.status === 'completed')
          return (
            <div
              key={step._id}
              className="grid gap-3 border-b border-gray-100 py-4 md:grid-cols-[36px_1fr_auto] md:items-center"
            >
              <b className="grid size-8 place-items-center rounded-full bg-sky-50 text-xs text-brand">
                {index + 1}
              </b>
              <div>
                <strong className="block text-xs">{step.name}</strong>
                <span className="text-[10px] text-gray-400">
                  {assignedUser?.name ?? 'Employee'} · {step.status.replaceAll('_', ' ')}
                </span>
              </div>
              {isMine && previousComplete && step.status === 'assigned' && (
                <div className="grid gap-1.5">
                  {SUPPLY_STAGES.includes(step.name) && !requestedSteps[step._id] && (
                    <Button
                      disabled={supplyBusy === step._id}
                      onClick={() => requestSupplies(step._id)}
                    >
                      {supplyBusy === step._id ? 'Requesting…' : 'Request supplies'}
                    </Button>
                  )}
                  <Button
                    primary
                    disabled={busy === step._id}
                    onClick={() => onStepAction(workflow._id, step._id, 'accept')}
                  >
                    Accept task
                  </Button>
                  {supplyMessage[step._id] && (
                    <p className="text-[10px] text-gray-500">{supplyMessage[step._id]}</p>
                  )}
                </div>
              )}
              {isMine && step.status === 'accepted' && (
                <Button
                  primary
                  disabled={busy === step._id}
                  onClick={() => onStepAction(workflow._id, step._id, 'complete')}
                >
                  <Check className="size-4" /> Mark completed
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {canManage && order?.status === 'quality_check' && workflow.status === 'completed' && (
        <div className="flex gap-2 border-t border-line p-4">
          <Button
            primary
            disabled={busy === workflow._id}
            onClick={() => onReview(workflow._id, 'pass')}
          >
            <Check className="size-4" /> Pass QC
          </Button>
          <Button disabled={busy === workflow._id} onClick={() => onReview(workflow._id, 'fail')}>
            <RotateCcw className="size-4" /> Fail and reprocess
          </Button>
        </div>
      )}
      {workflow.qc_notes && (
        <p className="border-t border-line bg-red-50 p-3 text-xs text-red-700">
          QC failed: {workflow.qc_notes}
        </p>
      )}
    </Panel>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-xs font-bold">
      {label}
      <span className="[&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-line [&>input]:p-2.5 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-line [&>select]:bg-white [&>select]:p-2.5 [&>select]:font-normal">
        {children}
      </span>
    </label>
  )
}
