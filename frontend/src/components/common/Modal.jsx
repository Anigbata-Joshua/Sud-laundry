// Modal template: add focus management, dismissal, and accessible labeling before production use.
export default function Modal({ children }) {
  return <div role="dialog">{children}</div>
}
