// Auth hook template: read the provider contract and expose session actions to screens.
export function useAuth() {
  return { user: null, isAuthenticated: false }
}
