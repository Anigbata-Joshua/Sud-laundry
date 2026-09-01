import { MoreHorizontal } from 'lucide-react'
import { formatNaira } from '../../utils/formatters'
import Avatar from '../common/Avatar'
import StatusBadge from '../tables/StatusBadge'

const headings = ['Order', 'Customer', 'Service', 'Branch', 'Status', 'Payment', 'Total']

export default function OrderTable({ rows, showActions = false }) {
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
            <tr key={order.id} className="text-[11px] text-gray-600">
              <td className="border-b border-gray-100 px-3 py-3">
                <strong className="block text-gray-800">{order.id}</strong>
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
