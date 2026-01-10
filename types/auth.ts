export interface User {
  id: string
  name: string
  email: string
  role: "user" | "admin" // Added role field to support admin users
  createdAt: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

export interface StoredUser extends User {
  password: string // Simple hash for development
}
