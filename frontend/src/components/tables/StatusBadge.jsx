const tones = {
  processing: 'bg-amber-50 text-amber-700',
  placed: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-50 text-emerald-700',
  healthy: 'bg-emerald-50 text-emerald-700',
  active: 'bg-emerald-50 text-emerald-700',
  delivered: 'bg-blue-50 text-blue-700',
  unpaid: 'bg-red-50 text-red-700',
  low: 'bg-red-50 text-red-700',
  'on leave': 'bg-amber-50 text-amber-700',
}

export default function StatusBadge({ children, status = children }) {
  const key = status.toLowerCase()

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${tones[key] ?? 'bg-gray-100 text-gray-600'}`}
    >
      <span className="size-1 rounded-full bg-current" />
      {status}
    </span>
  )
}
