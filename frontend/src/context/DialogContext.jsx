import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react'
import Button from '../components/common/Button'

const DialogContext = createContext(null)

const ICONS = {
  danger: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  primary: HelpCircle,
}

const TONES = {
  danger: {
    iconBg: 'bg-rose-50 text-rose-600',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  warning: {
    iconBg: 'bg-amber-50 text-amber-600',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  success: {
    iconBg: 'bg-emerald-50 text-emerald-600',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  info: {
    iconBg: 'bg-sky-50 text-sky-600',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  primary: {
    iconBg: 'bg-sky-50 text-sky-600',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
}

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (dialogState?.type === 'prompt') {
      setInputValue(dialogState.defaultValue || '')
      setInputError('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [dialogState])

  const closeDialog = useCallback((result) => {
    if (dialogState?.resolve) {
      dialogState.resolve(result)
    }
    setDialogState(null)
  }, [dialogState])

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        type: 'confirm',
        title: typeof options === 'string' ? 'Are you sure?' : (options.title || 'Are you sure?'),
        message: typeof options === 'string' ? options : (options.message || ''),
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        tone: options.tone || 'danger',
        resolve,
      })
    })
  }, [])

  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        type: 'prompt',
        title: options.title || 'Input Required',
        message: options.message || '',
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        isTextarea: Boolean(options.isTextarea),
        required: options.required !== false,
        confirmText: options.confirmText || 'Submit',
        cancelText: options.cancelText || 'Cancel',
        tone: options.tone || 'primary',
        resolve,
      })
    })
  }, [])

  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState({
        type: 'alert',
        title: typeof options === 'string' ? 'Notice' : (options.title || 'Notice'),
        message: typeof options === 'string' ? options : (options.message || ''),
        buttonText: options.buttonText || 'OK',
        tone: options.tone || 'info',
        resolve,
      })
    })
  }, [])

  const handlePromptSubmit = (e) => {
    e.preventDefault()
    if (dialogState.required && !inputValue.trim()) {
      setInputError('This field is required.')
      return
    }
    closeDialog(inputValue.trim())
  }

  const ToneIcon = dialogState ? (ICONS[dialogState.tone] || HelpCircle) : HelpCircle
  const toneStyle = dialogState ? (TONES[dialogState.tone] || TONES.primary) : TONES.primary

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}

      {/* Global Dialog Modal */}
      {dialogState && (
        <div
          className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-xs transition-opacity duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && dialogState.type !== 'prompt') {
              closeDialog(dialogState.type === 'confirm' ? false : null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeDialog(dialogState.type === 'confirm' ? false : null)
            }
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-2xl transition-all duration-200 animate-in zoom-in-95 fade-in">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneStyle.iconBg}`}>
                <ToneIcon className="size-5" />
              </span>
              <div className="flex-1 pr-6">
                <h3 className="text-sm font-extrabold text-ink leading-snug">{dialogState.title}</h3>
                {dialogState.message && (
                  <p className="mt-1 text-xs text-muted leading-relaxed whitespace-pre-line">{dialogState.message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => closeDialog(dialogState.type === 'confirm' ? false : null)}
                className="absolute top-5 right-5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Prompt Input Form */}
            {dialogState.type === 'prompt' ? (
              <form onSubmit={handlePromptSubmit} className="mt-4 grid gap-3">
                {dialogState.isTextarea ? (
                  <textarea
                    ref={inputRef}
                    rows={3}
                    className="w-full rounded-xl border border-line bg-white p-3 text-xs focus:border-sky-500 focus:outline-hidden"
                    placeholder={dialogState.placeholder}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      if (inputError) setInputError('')
                    }}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    className="w-full rounded-xl border border-line bg-white p-3 text-xs focus:border-sky-500 focus:outline-hidden"
                    placeholder={dialogState.placeholder}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      if (inputError) setInputError('')
                    }}
                  />
                )}

                {inputError && <p className="text-[11px] font-semibold text-rose-600">{inputError}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" onClick={() => closeDialog(null)}>
                    {dialogState.cancelText}
                  </Button>
                  <button
                    type="submit"
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs active:scale-[0.98] ${toneStyle.buttonClass}`}
                  >
                    {dialogState.confirmText}
                  </button>
                </div>
              </form>
            ) : dialogState.type === 'confirm' ? (
              /* Confirmation Action Buttons */
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" onClick={() => closeDialog(false)}>
                  {dialogState.cancelText}
                </Button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => closeDialog(true)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs active:scale-[0.98] ${toneStyle.buttonClass}`}
                >
                  {dialogState.confirmText}
                </button>
              </div>
            ) : (
              /* Alert Action Button */
              <div className="mt-6 flex justify-end">
                <Button primary type="button" autoFocus onClick={() => closeDialog(true)}>
                  {dialogState.buttonText}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

export default DialogContext
