import { Clock3, Filter, MoreHorizontal, Plus, UserRound } from 'lucide-react'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import { workflowColumns } from '../../data/dashboard'

export default function WorkflowPage() {
  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Workflow board"
        subtitle="Move work through each production stage and balance the team."
      >
        <Button>
          <Filter className="size-4" /> Filter
        </Button>
        <Button primary>
          <Plus className="size-4" /> Assign task
        </Button>
      </PageHeading>
      <p className="-mt-2 mb-4 text-[10px] text-muted">
        <b>6</b> active tasks · <b>2</b> unassigned · <b>1</b> at risk
      </p>
      <section className="grid grid-cols-[repeat(5,205px)] gap-2.5 overflow-x-auto xl:grid-cols-5">
        {workflowColumns.map(([title, color, tasks]) => (
          <div
            key={title}
            className="min-h-103 rounded-xl border border-gray-200 bg-gray-100 p-2.5"
          >
            <header className="flex items-center gap-2 pb-2.5 text-[10px]">
              <i style={{ background: color }} className="size-2 rounded-full" />
              <strong>{title}</strong>
              <b className="grid size-4 place-items-center rounded bg-gray-200 text-[9px]">
                {tasks.length}
              </b>
              <Plus className="ml-auto size-3.5" />
            </header>
            {tasks.map(([id, name, service, assignee]) => (
              <article key={id} className="mb-2 rounded-lg border border-gray-200 bg-white p-3">
                <span className="flex justify-between text-[9px] font-bold text-violet-600">
                  {id}
                  <MoreHorizontal className="size-3.5" />
                </span>
                <h3 className="mt-2 mb-1 text-[11px] font-bold">{name}</h3>
                <p className="text-[9px] text-gray-400">{service}</p>
                <footer className="mt-3 flex items-center justify-between">
                  {assignee ? (
                    <Avatar tone="dark">{assignee}</Avatar>
                  ) : (
                    <small className="flex items-center gap-1 text-[9px] text-gray-400">
                      <UserRound className="size-3" /> Assign
                    </small>
                  )}
                  <small className="flex items-center gap-1 text-[9px] text-gray-400">
                    <Clock3 className="size-3" /> Today
                  </small>
                </footer>
              </article>
            ))}
          </div>
        ))}
      </section>
    </>
  )
}
