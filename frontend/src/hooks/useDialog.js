// useDialog() exposes confirm()/prompt() for in-app modal dialogs that
// replace window.confirm/window.prompt. Both are provided by ToastContext
import { useToast } from './useToast'

export function useDialog() {
  const { confirm, prompt } = useToast()
  return { confirm, prompt }
}
