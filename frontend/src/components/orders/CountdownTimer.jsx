import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

// Ticks every minute rather than every second — a laundry order's ETA
// doesn't need second-level precision, and this avoids needless re-renders.
const TICK_MS = 60_000

function getRemaining(target) {
  const diffMs = new Date(target).getTime() - Date.now()
  const isOverdue = diffMs < 0
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { isOverdue, days, hours, minutes }
}

function formatDuration({ days, hours, minutes }) {
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`)
  return parts.length > 0 ? parts.join(' ') : 'less than a minute'
}

// Not shown once an order is delivered or cancelled — there's nothing left
// to count down to at that point.
const INACTIVE_STATUSES = ['delivered', 'cancelled']

// Give an ETA to customer
export default function CountdownTimer({
  deliveryTime,
  processingStartedAt,
  turnaroundHours,
  status,
}) {
  const isPrecise = Boolean(processingStartedAt && turnaroundHours)
  // If processing has started, countdown from the time processing started
  // Otherwise, countdown from the delivery time
  const target = isPrecise
    ? new Date(new Date(processingStartedAt).getTime() + turnaroundHours * 60 * 60 * 1000)
    : deliveryTime
      ? new Date(deliveryTime)
      : null

  const targetTime = target ? target.getTime() : null
  const [remaining, setRemaining] = useState(() => (target ? getRemaining(target) : null))

  useEffect(() => {
    if (!targetTime) return
    const interval = setInterval(() => {
      setRemaining(getRemaining(new Date(targetTime)))
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [targetTime])

  if (!target || !remaining || INACTIVE_STATUSES.includes(status)) return null

  const label = isPrecise
    ? remaining.isOverdue
      ? `Overdue by ${formatDuration(remaining)}`
      : `Ready in ${formatDuration(remaining)}`
    : remaining.isOverdue
      ? `Estimated time passed — awaiting processing`
      : `Estimated: ready in ${formatDuration(remaining)}`

  return (
    <p
      className={`mt-2 flex items-center gap-2 text-xs font-semibold ${
        !isPrecise ? 'italic text-gray-400' : remaining.isOverdue ? 'text-red-600' : 'text-brand'
      }`}
    >
      <Clock className="size-3.5" />
      {label}
    </p>
  )
}
