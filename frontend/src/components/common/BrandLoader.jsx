import BrandLogo from './BrandLogo'

/**
 * BrandLoader component: Displays the Swirl Laundry droplet logo with an animated
 * ripple pulse, smooth ambient glow, and branded loading indicator.
 */
export default function BrandLoader({
  message = 'Loading Swirl Laundry…',
  fullScreen = false,
  className = '',
}) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-md'
    : 'flex min-h-[50vh] flex-col items-center justify-center py-16'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${containerClasses} select-none ${className}`}
    >
      <div className="relative flex flex-col items-center">
        {/* Ambient lavender/indigo halo glow */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-sky-400/20 blur-xl animate-pulse" />

        {/* Brand logo container with subtle breathing scale */}
        <div className="relative transition-transform duration-700 ease-in-out hover:scale-105">
          <BrandLogo variant="large" />
        </div>

        {/* Animated multi-dot or progress line */}
        <div className="mt-6 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="size-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="size-2 rounded-full bg-purple-400 animate-bounce" />
        </div>

        {message && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
