import { Building2, Check, MapPin, Phone } from 'lucide-react'

export default function BranchCard({
  branch,
  selected = false,
  onSelect,
  index = 0,
  disabled = false,
  className = '',
}) {
  if (!branch) return null

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(branch._id || branch.id)}
      style={{ animationDelay: `${index * 50}ms` }}
      aria-pressed={selected}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 text-left transition-all duration-300 cursor-pointer ${
        selected
          ? 'border-[#4F7DF3] bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 shadow-lg shadow-blue-500/10 ring-2 ring-[#4F7DF3] scale-[1.01]'
          : 'border-slate-200 bg-white hover:border-[#4F7DF3]/50 hover:shadow-md hover:-translate-y-0.5'
      } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`}
    >
      {/* Checkmark indicator badge */}
      <span
        className={`absolute right-3.5 top-3.5 flex size-6 items-center justify-center rounded-full text-white shadow-md transition-all duration-300 ease-out ${
          selected
            ? 'scale-100 opacity-100 bg-[#4F7DF3]'
            : 'scale-0 opacity-0 pointer-events-none bg-slate-200'
        }`}
        aria-hidden="true"
      >
        <Check className="size-3.5 stroke-[3]" />
      </span>

      <div>
        <div className="flex items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${
              selected
                ? 'bg-[#4F7DF3] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-[#4F7DF3]'
            }`}
          >
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1 pr-6">
            <span className="block text-sm font-black tracking-tight text-[#0F172A] group-hover:text-[#4F7DF3] transition-colors truncate">
              {branch.name}
            </span>
          </div>
        </div>

        {branch.address && (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed">
            <MapPin className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span className="line-clamp-2">{branch.address}</span>
          </div>
        )}
      </div>

      {branch.phone && (
        <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 font-mono text-[11px] text-slate-600">
          <Phone className="size-3 shrink-0 text-[#26C1C9]" />
          <span>{branch.phone}</span>
        </div>
      )}
    </button>
  )
}
