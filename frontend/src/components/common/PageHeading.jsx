export default function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <header className="mb-6 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        <p className="mt-1.5 text-xs text-muted">{subtitle}</p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">{children}</div>
    </header>
  )
}
