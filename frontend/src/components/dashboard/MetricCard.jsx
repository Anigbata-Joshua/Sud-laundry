const iconTones = {
  violet: 'bg-violet-50 text-violet-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  coral: 'bg-red-50 text-red-600',
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
