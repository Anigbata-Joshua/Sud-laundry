import { CalendarDays, Download, TrendingUp } from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import { formatNaira } from '../../utils/formatters'

function Ranking({ title, rows }) {
  return (
    <Panel className="p-5">
      <PanelTitle eyebrow="Performance" title={title} />
      {rows.map((name, index) => (
        <div
          key={name}
          className="grid grid-cols-[24px_1fr_35px] items-center gap-2 border-b border-gray-100 py-3 text-[10px]"
        >
          <b className="text-violet-400">0{index + 1}</b>
          <span className="grid gap-1.5">
            {name}
            <i className="h-1 rounded bg-gray-100">
              <em
                style={{ width: `${90 - index * 18}%` }}
                className="block h-full rounded bg-violet-600"
              />
            </i>
          </span>
          <strong>{[428, 286, 194, 112][index]}</strong>
        </div>
      ))}
    </Panel>
  )
}

export default function ReportsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Business intelligence"
        title="Reports"
        subtitle="Understand revenue, order volume, customers, and service performance."
      >
        <Button>
          <CalendarDays className="size-4" /> Aug 1 — Aug 31
        </Button>
        <Button primary>
          <Download className="size-4" /> Export report
        </Button>
      </PageHeading>
      <section className="mb-4 grid min-h-45 items-end rounded-xl bg-[#222432] px-7 pt-6 text-white md:grid-cols-[0.8fr_1.2fr]">
        <div className="pb-7">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-gray-400">
            Net revenue · August
          </p>
          <strong className="block text-3xl">{formatNaira(18420000)}</strong>
          <span className="mt-2 flex items-center gap-1 text-[10px] text-emerald-300">
            <TrendingUp className="size-3.5" />
            14.2% vs July
          </span>
        </div>
        <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="h-35 w-full">
          <path
            d="M0,105 C50,82 70,94 110,68 S175,74 210,50 S285,62 320,32 S390,52 430,22 S470,29 500,8"
            fill="none"
            stroke="#8c7ef2"
            strokeWidth="3"
          />
        </svg>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Ranking
          title="Top services"
          rows={['Wash & fold', 'Dry cleaning', 'Premium care', 'Express wash']}
        />
        <Ranking
          title="Top customers"
          rows={['Bisi Adeyemi', 'Amaka Okafor', 'Tunde Kalu', 'Nneka Obi']}
        />
      </div>
    </>
  )
}
