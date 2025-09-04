import { post, get } from '@/utils/request'

export interface BalanceTransaction {
  id: string
  type: 'debit' | 'credit' | 'charge'
  amount: number
  balance: number
  timestamp: number
  service?: string
  operation?: string
  model?: string
  metadata?: any
}

export interface BalanceStats {
  balance: number
  totalSpent: number
  totalRecharged: number
  transactionCount: number
  lastTransaction?: BalanceTransaction
}

export interface ApiResponse<T = any> {
  status: string
  message?: string
  data: T
}

export const balanceApi = {
  // 获取当前余额
  async getBalance(): Promise<ApiResponse<{ balance: number; userId: string }>> {
    try {
      const response = await get<{ balance: number; userId: string }>('/balance')
      return response
    } catch (error: any) {
      throw new Error(error.message || '获取余额失败')
    }
  },

  // 获取余额统计
  async getBalanceStats(): Promise<ApiResponse<BalanceStats>> {
    try {
      const response = await get<BalanceStats>('/balance/stats')
      return response
    } catch (error: any) {
      throw new Error(error.message || '获取余额统计失败')
    }
  },

  // 获取交易记录
  async getTransactions(options: {
    limit?: number
    offset?: number
  } = {}): Promise<ApiResponse<BalanceTransaction[]>> {
    try {
      const params = new URLSearchParams()
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())
      
      const queryString = params.toString()
      const url = queryString ? `/balance/transactions?${queryString}` : '/balance/transactions'
      
      const response = await get<BalanceTransaction[]>(url)
      return response
    } catch (error: any) {
      throw new Error(error.message || '获取交易记录失败')
    }
  },

  // 充值余额
  async recharge(amount: number): Promise<ApiResponse<{ balance: number }>> {
    try {
      const response = await post<{ balance: number }>('/balance/recharge', { amount })
      return response
    } catch (error: any) {
      throw new Error(error.message || '充值失败')
    }
  }
}