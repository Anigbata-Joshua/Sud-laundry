import { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES = {
  success: {
    container: 'bg-white/95 border-emerald-200 shadow-emerald-500/10 text-emerald-950',
    iconBg: 'bg-emerald-50 text-emerald-600',
    accent: 'bg-emerald-500',
  },
  error: {
    container: 'bg-white/95 border-rose-200 shadow-rose-500/10 text-rose-950',
    iconBg: 'bg-rose-50 text-rose-600',
    accent: 'bg-rose-500',
  },
  warning: {
    container: 'bg-white/95 border-amber-200 shadow-amber-500/10 text-amber-950',
    iconBg: 'bg-amber-50 text-amber-600',
    accent: 'bg-amber-500',
  },
  info: {
    container: 'bg-white/95 border-sky-200 shadow-sky-500/10 text-sky-950',
    iconBg: 'bg-sky-50 text-sky-600',
    accent: 'bg-sky-500',
  },
}

let toastCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type, message, description = '', duration = 4000) => {
    const id = ++toastCounter
    const newToast = { id, type, message, description, duration }

    setToasts((prev) => [...prev.slice(-4), newToast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }, [removeToast])

  const toast = {
    success: (message, description, duration) => addToast('success', message, description, duration),
    error: (message, description, duration) => addToast('error', message, description, duration),
    warning: (message, description, duration) => addToast('warning', message, description, duration),
    info: (message, description, duration) => addToast('info', message, description, duration),
    dismiss: removeToast,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2.5 sm:max-w-md"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          const style = STYLES[t.type] || STYLES.info

          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${style.container}`}
            >
              {/* Left edge colored bar */}
              <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${style.accent}`} />

              <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${style.iconBg}`}>
                <Icon className="size-4.5" />
              </span>

              <div className="grid flex-1 gap-0.5 pt-0.5 pr-2">
                <strong className="text-xs font-bold leading-tight">{t.message}</strong>
                {t.description && (
                  <p className="text-[11px] font-medium opacity-80 leading-relaxed">{t.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastContext
