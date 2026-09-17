import { Clock, Layers, PlusCircle, Shirt } from 'lucide-react'
import MetricCard from '../dashboard/MetricCard'
import { formatNaira } from '../../utils/formatters'

export default function ServiceMetrics({ services }) {
  const regularServices = services.filter((s) => s.type !== 'add-on')
  const addOns = services.filter((s) => s.type === 'add-on')

  const totalPrice = services.reduce((acc, s) => acc + (Number(s.price) || 0), 0)
  const avgPrice = services.length > 0 ? Math.round(totalPrice / services.length) : 0

  const minHours = regularServices.reduce((min, s) => {
    const hours = Number(s.turnaround_hours)
    return hours && hours > 0 ? (min === null ? hours : Math.min(min, hours)) : min
  }, null)

  const maxHours = regularServices.reduce((max, s) => {
    const hours = Number(s.turnaround_hours)
    return hours && hours > 0 ? Math.max(max, hours) : max
  }, 0)

  const turnaroundRange =
    minHours !== null
      ? minHours === maxHours
        ? `${minHours}h standard`
        : `${minHours}h – ${maxHours}h window`
      : 'On-demand'

  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Shirt}
        tone="sky"
        label="Active Catalog Items"
        value={services.length}
        note={`${regularServices.length} standard · ${addOns.length} add-ons`}
      />
      <MetricCard
        icon={Layers}
        tone="green"
        label="Average Unit Price"
        value={formatNaira(avgPrice)}
        note="Across active catalog"
      />
      <MetricCard
        icon={PlusCircle}
        tone="teal"
        label="Special Care Add-ons"
        value={addOns.length}
        note="Stain, starch, fragrance & express"
      />
      <MetricCard
        icon={Clock}
        tone="blue"
        label="Turnaround Window"
        value={turnaroundRange}
        note="Promised delivery time"
      />
    </section>
  )
}
