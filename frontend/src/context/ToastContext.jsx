// Lightweight in-app notification toasts — used to confirm actions
// This provider also replaces the browser's native window.confirm/window.prompt
// with in-app modals (see confirm()/prompt() below, exposed via useDialog()).
import { useCallback, useMemo, useRef, useState } from 'react'
import { Bell, CheckCircle2, OctagonAlert, TriangleAlert, X } from 'lucide-react'
import ToastContext from './toast.context'

const TONES = {
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-200',
    iconWrap: 'bg-emerald-50 text-emerald-600',
  },
  warning: {
    icon: TriangleAlert,
    ring: 'border-amber-200',
    iconWrap: 'bg-amber-50 text-amber-600',
  },
  error: { icon: OctagonAlert, ring: 'border-red-200', iconWrap: 'bg-red-50 text-red-600' },
  info: { icon: Bell, ring: 'border-sky-200', iconWrap: 'bg-sky-50 text-brand' },
}

const POSITIONS = {
  'top-right': 'top-4 right-4 sm:right-5 inset-x-0 sm:inset-x-auto items-center sm:items-end',
  'top-left': 'top-4 left-4 sm:left-5 inset-x-0 sm:inset-x-auto items-center sm:items-start',
  'bottom-right': 'bottom-4 right-4 sm:right-5 inset-x-0 sm:inset-x-auto items-center sm:items-end',
  'bottom-left': 'bottom-4 left-4 sm:left-5 inset-x-0 sm:inset-x-auto items-center sm:items-start',
}

const DEFAULT_DURATION_MS = 5500

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)
  const [dialog, setDialog] = useState(null)
  const [promptValue, setPromptValue] = useState('')

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    ({ title, message, tone = 'info', position = 'top-right', duration = DEFAULT_DURATION_MS }) => {
      counter.current += 1
      const id = counter.current
      const safePosition = POSITIONS[position] ? position : 'top-right'
      setToasts((current) => [...current, { id, title, message, tone, position: safePosition }])
      if (duration) {
        window.setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss],
  )

  // confirm(message, options) -> Promise<boolean>
  // Resolves true if the user confirms, false if they cancel or dismiss.
  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title: options.title ?? 'Please confirm',
        message,
        tone: options.tone ?? 'warning',
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        resolve,
      })
    })
  }, [])

  // prompt(message, options) -> Promise<string | null>
  // Resolves the entered string on confirm, null on cancel/dismiss.
  // If options.required is true, the confirm button stays disabled until
  // the field is non-empty.
  const prompt = useCallback((message, options = {}) => {
    setPromptValue(options.defaultValue ?? '')
    return new Promise((resolve) => {
      setDialog({
        type: 'prompt',
        title: options.title ?? 'Enter details',
        message,
        label: options.label,
        placeholder: options.placeholder,
        required: options.required ?? false,
        confirmLabel: options.confirmLabel ?? 'Submit',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        tone: options.tone ?? 'info',
        resolve,
      })
    })
  }, [])

  const closeDialog = useCallback(
    (result) => {
      dialog?.resolve(result)
      setDialog(null)
      setPromptValue('')
    },
    [dialog],
  )

  const value = useMemo(
    () => ({ notify, dismiss, confirm, prompt }),
    [notify, dismiss, confirm, prompt],
  )

  const dialogTone = dialog ? (TONES[dialog.tone] ?? TONES.warning) : null
  const DialogIcon = dialogTone?.icon
  const promptDisabled = dialog?.type === 'prompt' && dialog.required && !promptValue.trim()

  // Group toasts by position
  const toastsByPosition = useMemo(() => {
    const grouped = {}
    for (const toast of toasts) {
      const pos = toast.position || 'top-right'
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(toast)
    }
    return grouped
  }, [toasts])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {Object.entries(toastsByPosition).map(([pos, items]) => {
        const positionClass = POSITIONS[pos] ?? POSITIONS['top-right']
        return (
          <div
            key={pos}
            aria-live="polite"
            aria-atomic="false"
            className={`pointer-events-none fixed z-[100] flex flex-col gap-2.5 px-4 ${positionClass}`}
          >
            {items.map((toast) => {
              const tone = TONES[toast.tone] ?? TONES.info
              const Icon = tone.icon
              return (
                <div
                  key={toast.id}
                  role="status"
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white/95 p-4 shadow-lg shadow-slate-900/10 backdrop-blur ${tone.ring}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone.iconWrap}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {toast.title && (
                      <p className="text-xs font-extrabold text-ink">{toast.title}</p>
                    )}
                    {toast.message && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                        {toast.message}
                      </p>
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
        )
      })}

      {dialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 px-4"
          role="presentation"
          onClick={() => closeDialog(dialog.type === 'confirm' ? false : null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDialog(dialog.type === 'confirm' ? false : null)
          }}
        >
          <div
            role={dialog.type === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="dialog-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {DialogIcon && (
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${dialogTone.iconWrap}`}
                >
                  <DialogIcon className="size-4.5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p id="dialog-title" className="text-sm font-extrabold text-ink">
                  {dialog.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{dialog.message}</p>

                {dialog.type === 'prompt' && (
                  <div className="mt-3">
                    {dialog.label && (
                      <label
                        htmlFor="dialog-prompt-input"
                        className="mb-1 block text-xs font-semibold text-ink"
                      >
                        {dialog.label}
                      </label>
                    )}
                    <textarea
                      id="dialog-prompt-input"
                      autoFocus
                      rows={3}
                      value={promptValue}
                      placeholder={dialog.placeholder}
                      onChange={(event) => setPromptValue(event.target.value)}
                      className="w-full resize-none rounded-xl border border-slate-200 p-2.5 text-[13px] text-ink outline-none focus:border-brand"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDialog(dialog.type === 'confirm' ? false : null)}
                className="rounded-xl px-3.5 py-2 text-[13px] font-semibold text-muted hover:bg-slate-50"
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus={dialog.type === 'confirm'}
                disabled={promptDisabled}
                onClick={() => closeDialog(dialog.type === 'confirm' ? true : promptValue)}
                className="rounded-xl bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
