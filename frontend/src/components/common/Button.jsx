export default function Button({ children, primary = false, className = '', ...props }) {
  const variant = primary
    ? 'border-brand bg-brand text-white hover:bg-[#5949c8]'
    : 'border-line bg-white text-[#5d616d] hover:bg-gray-50'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
