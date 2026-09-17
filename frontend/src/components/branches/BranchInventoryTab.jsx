import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import Panel, { PanelTitle } from '../common/Panel'

export default function BranchInventoryTab({ inventory }) {
  const navigate = useNavigate()

  return (
    <div className="grid gap-5">
      {/* Low stock alerts */}
      {inventory.lowStockCount > 0 && (
        <Panel className="border-red-200 bg-red-50/40 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-red-900">
                {inventory.lowStockCount} Product(s) Below Reorder Point at this Branch
              </h3>
              <p className="text-xs text-red-700">
                Restock immediately through stock movements or supplier orders to avoid workflow delays.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.lowStockItems.map((item) => (
              <div
                key={item._id}
                className="rounded-xl border border-red-200 bg-white p-3 flex justify-between items-center"
              >
                <div>
                  <strong className="text-xs font-bold text-ink block">{item.name}</strong>
                  <span className="text-[10px] text-red-600 font-bold">
                    {item.quantity} {item.unit} remaining (Reorder at {item.reorder_point})
                  </span>
                </div>
                <Button onClick={() => navigate('/inventory')}>Restock</Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Pending Supply Requests at this branch */}
      {inventory.pendingRequestsCount > 0 && (
        <Panel className="p-5">
          <PanelTitle eyebrow="Queue" title="Pending supply requests at this branch">
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {inventory.pendingRequestsCount} Pending Approval
            </span>
          </PanelTitle>

          <div className="mt-4 grid gap-3">
            {inventory.pendingRequests.map((req) => (
              <div
                key={req._id}
                className="rounded-xl border border-line p-3.5 flex flex-wrap justify-between items-center gap-3"
              >
                <div>
                  <strong className="text-xs font-extrabold text-ink block">
                    Supply request for ORD-{req.order_id?.slice(-6).toUpperCase()}
                  </strong>
                  <span className="text-[11px] text-gray-500">
                    Requested by {req.requested_by?.user_id?.name || 'Attendant'} (
                    {req.requested_by?.job_title})
                  </span>
                </div>
                <Button primary onClick={() => navigate('/supply-requests')}>
                  Review & Approve
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Recent Stock Movements */}
      <Panel className="p-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <PanelTitle eyebrow="Audit" title="Recent stock movements at this branch" />
          <Link
            to="/stock-movements"
            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
          >
            View all movements <ExternalLink className="size-3" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-gray-400">
                <th className="pb-3">Date</th>
                <th className="pb-3">Product</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Quantity</th>
                <th className="pb-3">Logged By</th>
              </tr>
            </thead>
            <tbody>
              {(inventory.recentMovements ?? []).map((movement) => (
                <tr key={movement._id} className="border-b border-gray-100">
                  <td className="py-3 text-gray-500">
                    {new Date(movement.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 font-bold text-ink">{movement.product_id?.name}</td>
                  <td className="py-3 capitalize">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        movement.type === 'purchase'
                          ? 'bg-emerald-50 text-emerald-700'
                          : movement.type === 'usage'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {movement.type}
                    </span>
                  </td>
                  <td
                    className={`py-3 font-extrabold ${
                      movement.quantity > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}{' '}
                    {movement.product_id?.unit}
                  </td>
                  <td className="py-3 text-gray-500">
                    {movement.employee_id?.user_id?.name || 'Admin'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {inventory.recentMovements.length === 0 && (
            <p className="py-8 text-center text-xs text-gray-400">
              No stock movements logged for this branch yet.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
