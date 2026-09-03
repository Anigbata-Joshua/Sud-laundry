import { useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getTasks } from '../../api/tasks.api'
import Avatar from '../../components/common/Avatar'
import PageHeading from '../../components/common/PageHeading'

const stages = [
  ['intake', 'Intake', '#9b87f5'],
  ['received', 'Received', '#29b49b'],
  ['processing', 'Processing', '#f3a63b'],
  ['quality_check', 'Quality check', '#4c86df'],
  ['delivery_ready', 'Ready', '#35ad75'],
]

const stageByOrderStatus = {
  placed: 'intake',
  received: 'received',
  processing: 'processing',
  quality_check: 'quality_check',
  ready: 'delivery_ready',
}

function getTaskStage(task) {
  return stageByOrderStatus[task.order_id?.status] ?? task.stage
}

export default function WorkflowPage() {
  const navigate = useNavigate()
  const { branchId } = useOutletContext()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getTasks()
      .then((response) => {
        if (active) setTasks(response.data.data)
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
  }, [])

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (['delivered', 'cancelled'].includes(task.order_id?.status)) return false
        return (
          !branchId ||
          task.order_id?.branch_id === branchId ||
          task.order_id?.branch_id?._id === branchId ||
          task.employee_id?.branch_id === branchId ||
          task.employee_id?.branch_id?._id === branchId
        )
      }),
    [branchId, tasks],
  )

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Workflow board"
        subtitle="Order stages update automatically from receipt, processing, and quality control."
      />
      <p className="-mt-2 mb-4 text-[10px] text-muted">
        <b>{visibleTasks.length}</b> active orders
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {loading ? (
        <p className="py-20 text-center text-xs text-gray-400">Loading workflow…</p>
      ) : (
        <section className="grid grid-cols-[repeat(5,220px)] gap-2.5 overflow-x-auto xl:grid-cols-5">
          {stages.map(([stage, title, color]) => {
            const stageTasks = visibleTasks.filter((task) => getTaskStage(task) === stage)
            return (
              <div
                key={stage}
                className="min-h-103 rounded-xl border border-gray-200 bg-gray-100 p-2.5"
              >
                <header className="flex items-center gap-2 pb-2.5 text-[10px]">
                  <i style={{ background: color }} className="size-2 rounded-full" />
                  <strong>{title}</strong>
                  <b className="grid size-5 place-items-center rounded bg-gray-200 text-[9px]">
                    {stageTasks.length}
                  </b>
                </header>
                {stageTasks.map((task) => (
                  <article
                    key={task._id}
                    className="mb-2 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${task.order_id?._id ?? task.order_id}`)}
                      className="flex w-full justify-between text-left text-[9px] font-bold text-violet-600"
                    >
                      ORD-
                      {String(task.order_id?._id ?? task.order_id)
                        .slice(-6)
                        .toUpperCase()}
                      <ExternalLink className="size-3.5" />
                    </button>
                    <h3 className="mt-2 mb-1 text-[11px] font-bold">
                      {task.order_id?.items?.[0]?.name ?? 'Laundry order'}
                    </h3>
                    <p className="text-[9px] text-gray-400">
                      {task.order_id?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0}{' '}
                      pieces
                    </p>
                    <footer className="mt-3 flex items-center justify-between">
                      <Avatar tone="dark">
                        {task.employee_id?.job_title?.slice(0, 2).toUpperCase() ?? 'UA'}
                      </Avatar>
                      <small className="flex items-center gap-1 text-[9px] text-gray-400">
                        <Clock3 className="size-3" />
                        {task.order_id?.status?.replaceAll('_', ' ') ?? 'placed'}
                      </small>
                    </footer>
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
