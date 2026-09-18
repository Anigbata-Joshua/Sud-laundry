// Lightweight in-app notification toasts — used to confirm actions like
// placing an order or sending a message. Distinct from the persistent
// /notifications inbox (see api/notifications.api.js): toasts are transient,
// client-side feedback, while that inbox is the durable, server-backed record.
import { useCallback, useMemo, useRef, useState } from 'react'
import { Bell, CheckCircle2, TriangleAlert, X } from 'lucide-react'
import ToastContext from './toast.context'

const TONES = {
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-200',
    iconWrap: 'bg-emerald-50 text-emerald-600',
  },
  error: {
    icon: TriangleAlert,
    ring: 'border-red-200',
    iconWrap: 'bg-red-50 text-red-600',
  },
  info: {
    icon: Bell,
    ring: 'border-sky-200',
    iconWrap: 'bg-sky-50 text-brand',
  },
}

const DEFAULT_DURATION_MS = 5500

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    ({ title, message, tone = 'info', duration = DEFAULT_DURATION_MS }) => {
      counter.current += 1
      const id = counter.current
      setToasts((current) => [...current, { id, title, message, tone }])
      if (duration) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2.5 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] ?? TONES.info
          const Icon = tone.icon
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-lg shadow-slate-900/10 backdrop-blur ${tone.ring}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone.iconWrap}`}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-xs font-extrabold text-ink">{toast.title}</p>}
                {toast.message && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-500"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
