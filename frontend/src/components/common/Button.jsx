// Shared button template: define consistent variants, loading state, and accessibility behavior here.
export default function Button({ children, ...props }) {
  return <button type="button" {...props}>{children}</button>
}
