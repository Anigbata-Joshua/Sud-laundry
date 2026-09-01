export default function Panel({ children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-line bg-white shadow-[0_2px_8px_rgba(35,38,50,0.02)] ${className}`}
    >
      {children}
    </section>
  )
}

export function PanelTitle({ eyebrow, title, children }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
          {eyebrow}
        </p>
        <h2 className="text-sm font-extrabold">{title}</h2>
      </div>
      {children}
    </div>
  )
}
