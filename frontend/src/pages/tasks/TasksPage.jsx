import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProcessingWorkflows, updateProcessingStep } from '../../api/processingWorkflows.api'
import Panel from '../../components/common/Panel'
import PageHeading from '../../components/common/PageHeading'
import StatusBadge from '../../components/tables/StatusBadge'
import Button from '../../components/common/Button'
import { useAuth } from '../../hooks/useAuth'

const stages = ['intake', 'washing', 'processing', 'quality_check', 'packaging', 'delivery_ready']

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [query, setQuery] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const workflowResponse = await getProcessingWorkflows()
      const workflowTasks = (workflowResponse.data.data ?? []).flatMap((workflow) =>
        workflow.steps.map((step) => ({
          ...step,
          _id: `${workflow._id}:${step._id}`,
          stepId: step._id,
          workflowId: workflow._id,
          stage: step.name,
          employee_id: step.employee_id,
          order_id: workflow.order_id,
          createdAt: step.createdAt ?? workflow.createdAt,
        })),
      )
      setTasks(workflowTasks)
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load tasks.')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        if (filter && task.status !== filter) return false
        if (stageFilter && task.stage !== stageFilter) return false
        if (taskDate && new Date(task.createdAt).toISOString().slice(0, 10) !== taskDate)
          return false
        const employee =
          task.employee_id?.user_id?.name ??
          task.employee_id?.name ??
          task.employee_id?.job_title ??
          ''
        const orderId = task.order_id?._id ?? task.order_id ?? ''
        return `${employee} ${orderId}`.toLowerCase().includes(query.toLowerCase())
      }),
    [filter, query, stageFilter, taskDate, tasks],
  )

  async function changeWorkflowStep(task, action) {
    try {
      await updateProcessingStep(task.workflowId, task.stepId, action)
      await load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to update task.')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Tasks"
        subtitle="View assignments and move work through each processing stage."
      />
      {message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <input
            className="rounded-lg border border-line p-2 text-xs sm:w-64"
            placeholder="Search employee or order"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="rounded-lg border border-line p-2 text-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {['assigned', 'accepted', 'completed'].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-line p-2 text-xs"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-line p-2 text-xs"
            type="date"
            value={taskDate}
            onChange={(event) => setTaskDate(event.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {['Order', 'Employee', 'Stage', 'Status', 'Actions'].map((item) => (
                  <th
                    key={item}
                    className="border-b border-line px-4 py-3 text-[9px] uppercase text-gray-400"
                  >
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr key={task._id}>
                  <td className="border-b border-line px-4 py-3">
                    <Link
                      className="font-bold text-brand"
                      to={`/orders/${task.order_id?._id ?? task.order_id}`}
                    >
                      ORD-
                      {String(task.order_id?._id ?? task.order_id)
                        .slice(-6)
                        .toUpperCase()}
                    </Link>
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    {task.employee_id?.user_id?.name ??
                      task.employee_id?.name ??
                      task.employee_id?.job_title ??
                      'Employee'}
                  </td>
                  <td className="border-b border-line px-4 py-3 capitalize">
                    {task.stage.replaceAll('_', ' ')}
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="border-b border-line px-4 py-3">
                    {task.status === 'completed' ? (
                      <span className="text-[10px] text-gray-400">
                        Completed{' '}
                        {task.completed_at
                          ? new Date(task.completed_at).toLocaleDateString('en-NG')
                          : ''}
                      </span>
                    ) : (task.employee_id?.user_id?._id ?? task.employee_id?.user_id) ===
                      (user._id ?? user.id) ? (
                      <Button
                        primary
                        onClick={() =>
                          changeWorkflowStep(
                            task,
                            task.status === 'assigned' ? 'accept' : 'complete',
                          )
                        }
                      >
                        {task.status === 'assigned' ? 'Accept' : 'Mark completed'}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-gray-400">Assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}