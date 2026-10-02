// Toast context contract: the provider exposes notify(), dismiss(), confirm(), and prompt() here.
//
// Toast shape:
// {
//   id: number,
//   title?: string,
//   message: string,
//   tone?: 'success' | 'warning' | 'error' | 'info',
//   position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
//   duration?: number
// }
import { createContext } from 'react'

const ToastContext = createContext(null)

export default ToastContext
