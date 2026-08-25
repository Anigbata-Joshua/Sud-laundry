// Auth context contract: the provider should expose the current user and auth actions here.
import { createContext } from 'react'

const AuthContext = createContext(null)

export default AuthContext
