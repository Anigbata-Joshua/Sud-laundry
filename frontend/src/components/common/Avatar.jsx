const tones = {
  mint: 'bg-emerald-50 text-emerald-700',
  lilac: 'bg-violet-50 text-violet-700',
  peach: 'bg-orange-50 text-orange-700',
  blue: 'bg-blue-50 text-blue-700',
  yellow: 'bg-amber-50 text-amber-700',
  dark: 'bg-[#292c3a] text-white',
  lime: 'bg-lime-200 text-lime-950',
}

export default function Avatar({ children, tone = 'mint' }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
