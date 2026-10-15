import { Clock, Droplets, Layers, Shirt } from 'lucide-react'
import MetricCard from '../dashboard/MetricCard'

export default function ServiceMetrics({ services = [], catalogItems = [] }) {
  const uniqueCategories = new Set(catalogItems.map((c) => c.category).filter(Boolean)).size

  const minHours = services.reduce((min, s) => {
    const hours = Number(s.turnaround_hours)
    return hours && hours > 0 ? (min === null ? hours : Math.min(min, hours)) : min
  }, null)

  const maxHours = services.reduce((max, s) => {
    const hours = Number(s.turnaround_hours)
    return hours && hours > 0 ? Math.max(max, hours) : max
  }, 0)

  const turnaroundRange =
    minHours !== null
      ? minHours === maxHours
        ? `${minHours}h standard`
        : `${minHours}h – ${maxHours}h window`
      : '24h – 72h'

  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Shirt}
        tone="sky"
        label="Active Garment Items"
        value={catalogItems.length}
        note="Priced per service matrix"
      />
      <MetricCard
        icon={Layers}
        tone="purple"
        label="Garment Categories"
        value={`${uniqueCategories || 5} Categories`}
        note="Casuals, Native, Corporate & more"
      />
      <MetricCard
        icon={Droplets}
        tone="blue"
        label="Core Laundry Services"
        value={`${services.length} Processes`}
        note="Standard branch operations"
      />
      <MetricCard
        icon={Clock}
        tone="teal"
        label="Turnaround Window"
        value={turnaroundRange}
        note="Promised delivery time"
      />
    </section>
  )
}
