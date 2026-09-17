export default function Button({ children, primary = false, className = '', ...props }) {
  const variant = primary
    ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700 shadow-xs active:scale-[0.98]'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs active:scale-[0.98]'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
