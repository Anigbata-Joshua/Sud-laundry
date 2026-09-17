import { Clock3, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import Panel from '../common/Panel'
import { formatNaira } from '../../utils/formatters'

const workflowStages = [
  { key: 'placed', label: 'Intake / Placed', color: '#9b87f5' },
  { key: 'received', label: 'Received', color: '#29b49b' },
  { key: 'processing', label: 'In Processing', color: '#f3a63b' },
  { key: 'quality_check', label: 'Quality Check', color: '#4c86df' },
  { key: 'ready', label: 'Ready for Pickup', color: '#35ad75' },
]

export default function BranchWorkflowTab({ branchName, orders }) {
  const navigate = useNavigate()

  return (
    <div className="grid gap-5">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-ink">Branch Processing Pipeline</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Live snapshot of order stages handled by attendant staff at {branchName}.
            </p>
          </div>
          <Button onClick={() => navigate('/workflow')}>
            Open master workflow board <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {workflowStages.map((stage) => {
          const stageOrders = (orders.recent ?? []).filter((o) => o.status === stage.key)
          const count = orders.statusCounts[stage.key] || 0
          return (
            <div
              key={stage.key}
              className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3.5 flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
                  {stage.label}
                </span>
                <b className="grid size-6 place-items-center rounded-lg bg-white text-xs font-black text-ink shadow-xs">
                  {count}
                </b>
              </div>

              <div className="mt-3 grid gap-2 flex-1">
                {stageOrders.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs hover:border-sky-300 transition cursor-pointer"
                    onClick={() => navigate(`/orders/${order._id}`)}
                  >
                    <div className="flex justify-between items-center text-[10px] font-bold text-sky-700">
                      <span>ORD-{order._id.slice(-6).toUpperCase()}</span>
                      <span className="text-gray-400">{formatNaira(order.total_price)}</span>
                    </div>
                    <h4 className="mt-1 text-xs font-bold text-ink truncate">
                      {order.customer_id?.name || 'Customer'}
                    </h4>
                    <div className="mt-2 flex items-center justify-between text-[9px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock3 className="size-3" />
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>{order.items?.length || 1} service(s)</span>
                    </div>
                  </div>
                ))}

                {stageOrders.length === 0 && (
                  <div className="grid place-items-center py-8 text-center text-[10px] text-gray-400">
                    No orders in this stage
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
