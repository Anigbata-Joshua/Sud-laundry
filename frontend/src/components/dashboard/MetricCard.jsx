const iconTones = {
  sky: 'bg-sky-50 text-sky-700 border border-sky-100',
  teal: 'bg-teal-50 text-teal-700 border border-teal-100',
  indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  lime: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  blue: 'bg-blue-50 text-blue-700 border border-blue-100',
  violet: 'bg-sky-50 text-sky-700 border border-sky-100',
  coral: 'bg-rose-50 text-rose-700 border border-rose-100',
  amber: 'bg-amber-50 text-amber-700 border border-amber-100',
}

export default function MetricCard({ icon: Icon, tone, label, value, note }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-line bg-white p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconTones[tone]}`}>
        <Icon className="size-[18px]" />
      </span>
      <div className="grid min-w-0">
        <small className="text-[11px] text-gray-500">{label}</small>
        <strong className="my-0.5 whitespace-nowrap text-lg tracking-tight">{value}</strong>
        <span className="text-[10px] text-gray-400">{note}</span>
      </div>
    </article>
  )
}
