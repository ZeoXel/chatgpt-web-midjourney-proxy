import { post } from '@/utils/request'
import type { 
  LoginCredentials, 
  RegisterData, 
  AuthResponse, 
  TokenValidationResponse,
  UserInfo 
} from '@/store/modules/auth/types'

/**
 * 用户认证API接口
 */
export const authApi = {
  /**
   * 用户登录
   */
  login: (credentials: LoginCredentials): Promise<AuthResponse> => {
    return post({
      url: '/auth/login',
      data: credentials,
    })
  },

  /**
   * 用户注册
   */
  register: (data: RegisterData): Promise<AuthResponse> => {
    return post({
      url: '/auth/register',
      data,
    })
  },

  /**
   * 用户登出
   */
  logout: (): Promise<{ success: boolean }> => {
    return post({
      url: '/auth/logout',
    })
  },

  /**
   * 刷新访问令牌
   */
  refreshToken: (token: string): Promise<AuthResponse> => {
    return post({
      url: '/auth/refresh',
      data: { token },
    })
  },

  /**
   * 验证令牌有效性
   */
  validateToken: (token: string): Promise<TokenValidationResponse> => {
    return post({
      url: '/auth/validate',
      data: { token },
    })
  },

  /**
   * 更新用户资料
   */
  updateProfile: (data: Partial<UserInfo>): Promise<AuthResponse> => {
    return post({
      url: '/auth/profile',
      data,
    })
  },

  /**
   * 获取用户信息
   */
  getUserInfo: (): Promise<{ user: UserInfo; permissions: string[] }> => {
    return post({
      url: '/auth/user',
    })
  },

  /**
   * 修改密码
   */
  changePassword: (data: {
    oldPassword: string
    newPassword: string
    confirmPassword: string
  }): Promise<{ success: boolean; message: string }> => {
    return post({
      url: '/auth/change-password',
      data,
    })
  },

  /**
   * 忘记密码 - 发送重置邮件
   */
  forgotPassword: (email: string): Promise<{ success: boolean; message: string }> => {
    return post({
      url: '/auth/forgot-password',
      data: { email },
    })
  },

  /**
   * 重置密码
   */
  resetPassword: (data: {
    token: string
    newPassword: string
    confirmPassword: string
  }): Promise<{ success: boolean; message: string }> => {
    return post({
      url: '/auth/reset-password',
      data,
    })
  },

  /**
   * 验证邮箱
   */
  verifyEmail: (token: string): Promise<{ success: boolean; message: string }> => {
    return post({
      url: '/auth/verify-email',
      data: { token },
    })
  },

  /**
   * 重发验证邮件
   */
  resendVerification: (email: string): Promise<{ success: boolean; message: string }> => {
    return post({
      url: '/auth/resend-verification',
      data: { email },
    })
  },
}