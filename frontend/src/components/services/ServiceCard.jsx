import { Building2, Clock, Droplets, Edit3, Flame, Sparkles, Trash2 } from 'lucide-react'
import Button from '../common/Button'

function getCategoryMeta(category = '') {
  const cat = category.toLowerCase()
  if (cat.includes('dry')) {
    return {
      icon: Sparkles,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconBg: 'bg-indigo-50 text-indigo-600',
    }
  }
  if (cat.includes('iron') || cat.includes('press')) {
    return {
      icon: Flame,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
    }
  }
  return {
    icon: Droplets,
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600',
  }
}

export default function ServiceCard({ service, branchName, isAdmin, onEdit, onDelete }) {
  const meta = getCategoryMeta(service.category)
  const Icon = meta.icon

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-xs transition hover:border-sky-300 hover:shadow-md">
      <div>
        {/* Top bar: Category badge & Name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`grid size-11 place-items-center rounded-xl transition ${meta.iconBg} group-hover:scale-105`}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeColor}`}
              >
                {service.category || 'Core Service'}
              </span>
              <h3 className="mt-1 text-base font-extrabold text-ink transition group-hover:text-sky-700">
                {service.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Turnaround & Branch Specs */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
            <Clock className="size-3.5 text-sky-600" />
            {service.turnaround_hours} hr promised turnaround
          </span>

          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Building2 className="size-3 text-slate-500" />
              {branchName(service.branch_id?._id ?? service.branch_id)}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Active in POS
        </span>

        <div className="flex items-center gap-2">
          <Button onClick={() => onEdit(service)}>
            <Edit3 className="size-3.5" /> Edit
          </Button>
          <button
            type="button"
            title="Deactivate service"
            onClick={() => onDelete(service)}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}
