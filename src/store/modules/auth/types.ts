export interface UserInfo {
  id: string
  username: string
  email: string
  avatar?: string
  name?: string
  role: 'admin' | 'user' | 'vip'
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
}

export interface LoginCredentials {
  username: string
  password: string
  remember?: boolean
}

export interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
  inviteCode?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserInfo | null
  token: string | null
  permissions: string[]
  loginLoading: boolean
  registerLoading: boolean
}

export interface AuthResponse {
  success: boolean
  message?: string
  token?: string
  user?: UserInfo
  permissions?: string[]
}

export interface TokenValidationResponse {
  valid: boolean
  user?: UserInfo
  permissions?: string[]
}