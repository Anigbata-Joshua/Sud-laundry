import { Edit3, Layers, Trash2 } from 'lucide-react'
import Button from '../common/Button'
import { formatNaira } from '../../utils/formatters'

const CATEGORY_COLORS = {
  Casuals: 'bg-sky-50 text-sky-700 border-sky-200',
  'Native & Traditional': 'bg-amber-50 text-amber-700 border-amber-200',
  'Corporate Wear': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Outerwear & Jackets': 'bg-purple-50 text-purple-700 border-purple-200',
  'Bedding & Household': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function CatalogItemCard({ item, canManage, onEdit, onDelete }) {
  const badgeClass = CATEGORY_COLORS[item.category] || 'bg-gray-50 text-gray-700 border-gray-200'

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-xs transition hover:border-sky-300 hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
              >
                {item.category}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                <Layers className="size-3 text-gray-500" />
                {item.piece_count} {item.piece_count === 1 ? 'piece' : 'pieces'}
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-extrabold text-ink transition group-hover:text-sky-700">
              {item.name}
            </h3>
            {item.description && (
              <p className="mt-1 text-xs text-muted line-clamp-2">{item.description}</p>
            )}
          </div>
        </div>

        {/* Service Prices Matrix */}
        <div className="mt-4 border-t border-gray-100 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
            Service Pricing
          </span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(item.services || []).map((s) => (
              <div
                key={s.service_name}
                className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                  s.is_available
                    ? 'bg-gray-50/80 text-ink'
                    : 'bg-gray-50/40 text-gray-300 line-through'
                }`}
              >
                <span
                  className="text-[11px] font-medium truncate max-w-[110px]"
                  title={s.service_name}
                >
                  {s.service_name}
                </span>
                <span className="font-bold text-sky-800 text-[11px]">
                  {s.is_available ? formatNaira(s.price) : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {canManage && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <Button onClick={() => onEdit(item)}>
            <Edit3 className="size-3.5" /> Edit
          </Button>
          <button
            type="button"
            title="Deactivate item"
            onClick={() => onDelete(item)}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </article>
  )
}
