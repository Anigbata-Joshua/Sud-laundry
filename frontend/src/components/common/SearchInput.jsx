import { Search } from 'lucide-react'

export default function SearchInput({ className = '', ...props }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg border border-line bg-gray-50/70 px-2.5 py-2 ${className}`}
    >
      <Search className="size-3.5 text-gray-400" />
      <input
        className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
        {...props}
      />
    </label>
  )
}
