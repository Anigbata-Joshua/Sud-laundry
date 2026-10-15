import { Building2, Clock, Edit3, Trash2 } from 'lucide-react'
import Button from '../common/Button'

export default function ServiceTable({ services, branchName, isAdmin, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[9px] uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3">Service Name</th>
            <th className="px-4 py-3">Category</th>
            {isAdmin && <th className="px-4 py-3">Branch</th>}
            <th className="px-4 py-3">Turnaround</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr
              key={service._id}
              className="border-b border-gray-100 hover:bg-gray-50/60 transition"
            >
              <td className="px-4 py-3">
                <strong className="font-extrabold text-ink text-sm block">{service.name}</strong>
              </td>
              <td className="px-4 py-3 font-medium text-gray-600">
                {service.category || 'Core Service'}
              </td>
              {isAdmin && (
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                    <Building2 className="size-3 text-gray-400" />
                    {branchName(service.branch_id?._id ?? service.branch_id)}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3 text-sky-500" />
                  {service.turnaround_hours} hrs
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button onClick={() => onEdit(service)}>
                    <Edit3 className="size-3.5" /> Edit
                  </Button>
                  <button
                    type="button"
                    title="Deactivate service"
                    onClick={() => onDelete(service)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
