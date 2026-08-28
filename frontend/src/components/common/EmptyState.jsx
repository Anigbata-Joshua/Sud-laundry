// Empty-state template: explain why a collection is empty and offer the next relevant action.
export default function EmptyState({ message = 'Nothing here yet.' }) {
  return <p>{message}</p>
}
