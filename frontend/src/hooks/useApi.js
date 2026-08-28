// API lifecycle hook template: standardize request loading, success, cancellation, and errors.
export function useApi() {
  return { data: null, loading: false, error: null }
}
