import { Building2, ChevronRight, Plus, Shirt } from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'

const branches = [
  ['Lekki', '14 Admiralty Way', '18 orders'],
  ['Ikeja', '22 Allen Avenue', '12 orders'],
  ['Yaba', '8 Herbert Macaulay', '8 orders'],
]
const services = [
  ['Wash & fold', '24 hrs turnaround', '₦3,500/kg'],
  ['Dry cleaning', '48 hrs turnaround', 'From ₦4,500'],
  ['Express wash', '6 hrs turnaround', '₦6,000/kg'],
  ['Premium care', '72 hrs turnaround', 'From ₦8,000'],
]

function CatalogRow({ icon: Icon, title, subtitle, value }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3">
      <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-brand">
        <Icon className="size-4" />
      </span>
      <div className="grid flex-1">
        <strong className="text-[11px]">{title}</strong>
        <small className="text-[9px] text-gray-400">{subtitle}</small>
      </div>
      <b className="text-[10px]">{value}</b>
      <ChevronRight className="size-3.5 text-gray-400" />
    </div>
  )
}

export default function BranchesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Business setup"
        title="Branches & services"
        subtitle="Configure where you operate and what customers can order."
      >
        <Button primary>
          <Plus className="size-4" /> Add service
        </Button>
      </PageHeading>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <PanelTitle eyebrow="Locations" title="Branches">
            <Plus className="size-4" />
          </PanelTitle>
          {branches.map((row) => (
            <CatalogRow
              key={row[0]}
              icon={Building2}
              title={row[0]}
              subtitle={row[1]}
              value={row[2]}
            />
          ))}
        </Panel>
        <Panel className="p-5">
          <PanelTitle eyebrow="Catalogue" title="Popular services" />
          {services.map((row) => (
            <CatalogRow key={row[0]} icon={Shirt} title={row[0]} subtitle={row[1]} value={row[2]} />
          ))}
        </Panel>
      </div>
    </>
  )
}
