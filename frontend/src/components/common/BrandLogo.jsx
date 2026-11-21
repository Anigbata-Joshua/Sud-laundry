import { BRAND } from '../../constants/brand'

/**
 * Swirl Laundry SVG Logo component.
 * Displays a small splash/drop mark above the wide letter-spaced SWIRL name, with LAUNDRY underneath.
 * Uses indigo (#4f46e5) and lavender (#c084fc / #a855f7) palette.
 */
export default function BrandLogo({
  variant = 'default',
  showText = true,
  inverted = false,
  className = '',
}) {
  const isCompact = variant === 'compact'
  const isLarge = variant === 'large'
  const isSidebar = variant === 'sidebar'

  const iconSize = isCompact ? 'size-6' : isLarge ? 'size-11' : isSidebar ? 'size-8' : 'size-9'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Splash / Droplet SVG Icon */}
      <div
        className={`relative grid ${iconSize} shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-400 p-1.5 shadow-sm shadow-indigo-900/20`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-full text-white"
        >
          {/* Water drop shape */}
          <path
            d="M12 2.5C12 2.5 5 11.2 5 15.5C5 19.366 8.134 22.5 12 22.5C15.866 22.5 19 19.366 19 15.5C19 11.2 12 2.5 12 2.5Z"
            fill="currentColor"
            fillOpacity="0.9"
          />
          {/* Splash swirl ripple accent in lavender */}
          <path
            d="M12 7C12 7 8 12.5 8 15.2C8 17.5 9.8 19.2 12 19.2C13.2 19.2 14.3 18.6 15 17.7"
            stroke="#e0e7ff"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="14.5" cy="12.5" r="1.25" fill="#c084fc" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-black tracking-[0.22em] uppercase ${
              isLarge
                ? 'text-2xl'
                : isCompact
                  ? 'text-sm tracking-[0.18em]'
                  : isSidebar
                    ? 'text-base tracking-[0.2em]'
                    : 'text-lg'
            } ${inverted ? 'text-white' : 'text-slate-900'}`}
          >
            {BRAND.shortName}
          </span>
          <span
            className={`font-bold tracking-[0.38em] uppercase ${
              isLarge ? 'text-[10px]' : 'text-[8.5px]'
            } ${inverted ? 'text-indigo-200' : 'text-indigo-600'}`}
          >
            {BRAND.subTitle}
          </span>
        </div>
      )}
    </div>
  )
}
