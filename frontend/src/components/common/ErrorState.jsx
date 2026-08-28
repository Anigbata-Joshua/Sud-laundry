// Error-state template: show a safe message and provide retry or support actions where needed.
export default function ErrorState({ message = 'Something went wrong.' }) {
  return <p role="alert">{message}</p>
}
