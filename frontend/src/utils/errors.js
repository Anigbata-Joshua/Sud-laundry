// Error presentation helper: map backend and network failures to safe user-facing messages.
export const getErrorMessage = (error) => error?.response?.data?.message || error?.message || 'Something went wrong'
