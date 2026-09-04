import { MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatNaira } from '../../utils/formatters'
import Avatar from '../common/Avatar'
import StatusBadge from '../tables/StatusBadge'

const headings = ['Order', 'Customer', 'Service', 'Branch', 'Status', 'Payment', 'Total']

export default function OrderTable({ rows, showActions = false }) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th
                key={heading}
                className="border-b border-line px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-gray-400"
              >
                {heading}
              </th>
            ))}
            {showActions && <th className="border-b border-line" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr
              key={order.id}
              tabIndex="0"
              role="link"
              onClick={() => navigate(`/orders/${order.dbId}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/orders/${order.dbId}`)
                }
              }}
              className="cursor-pointer text-[11px] text-gray-600 hover:bg-gray-50 focus:bg-violet-50 focus:outline-none"
            >
              <td className="border-b border-gray-100 px-3 py-3">
                <span className="block font-bold text-brand">{order.id}</span>
                <small className="text-[9px] text-gray-400">{order.pieces} pieces</small>
              </td>
              <td className="border-b border-gray-100 px-3 py-3">
                <span className="flex items-center gap-2">
                  <Avatar tone={order.tone}>{order.initials}</Avatar>
                  {order.customer}
                </span>
              </td>
              <td className="border-b border-gray-100 px-3 py-3">{order.service}</td>
              <td className="border-b border-gray-100 px-3 py-3">{order.branch}</td>
              <td className="border-b border-gray-100 px-3 py-3">
                <StatusBadge status={order.status} />
              </td>
              <td className="border-b border-gray-100 px-3 py-3">
                <StatusBadge status={order.payment} />
              </td>
              <td className="border-b border-gray-100 px-3 py-3 font-bold text-gray-800">
                {formatNaira(order.total)}
              </td>
              {showActions && (
                <td className="border-b border-gray-100 px-3 py-3">
                  <MoreHorizontal className="size-4" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
