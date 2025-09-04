import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { balanceApi, type BalanceStats, type BalanceTransaction } from '@/api/balance'

export interface BalanceState {
  balance: number
  userId: string
  stats: BalanceStats | null
  transactions: BalanceTransaction[]
  loading: boolean
  error: string | null
}

export const useBalanceStore = defineStore('balance', () => {
  // 状态
  const balance = ref(0)
  const userId = ref('')
  const stats = ref<BalanceStats | null>(null)
  const transactions = ref<BalanceTransaction[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const formattedBalance = computed(() => {
    return balance.value.toFixed(2)
  })

  const hasTransactions = computed(() => {
    return transactions.value.length > 0
  })

  const recentTransactions = computed(() => {
    return transactions.value.slice(0, 10)
  })

  // 获取余额
  const fetchBalance = async () => {
    try {
      loading.value = true
      error.value = null
      
      const response = await balanceApi.getBalance()
      if (response.status === 'Success') {
        balance.value = response.data.balance
        userId.value = response.data.userId
      } else {
        throw new Error(response.message || '获取余额失败')
      }
    } catch (err: any) {
      error.value = err.message || '获取余额失败'
      console.error('获取余额失败:', err)
      
      // 如果API失败，提供fallback数据用于开发
      balance.value = 1000
      userId.value = 'demo-user'
    } finally {
      loading.value = false
    }
  }

  // 获取余额统计
  const fetchBalanceStats = async () => {
    try {
      loading.value = true
      error.value = null
      
      const response = await balanceApi.getBalanceStats()
      if (response.status === 'Success') {
        stats.value = response.data
        // 更新余额（如果stats中包含最新余额）
        if (response.data.balance !== undefined) {
          balance.value = response.data.balance
        }
      } else {
        throw new Error(response.message || '获取余额统计失败')
      }
    } catch (err: any) {
      error.value = err.message || '获取余额统计失败'
      console.error('获取余额统计失败:', err)
      
      // 如果API失败，提供fallback数据用于开发
      stats.value = {
        balance: balance.value,
        totalSpent: 0,
        totalRecharged: 1000,
        transactionCount: 1
      }
    } finally {
      loading.value = false
    }
  }

  // 获取交易记录
  const fetchTransactions = async (options: { limit?: number; offset?: number } = {}) => {
    try {
      loading.value = true
      error.value = null
      
      const response = await balanceApi.getTransactions(options)
      if (response.status === 'Success') {
        transactions.value = response.data
      } else {
        throw new Error(response.message || '获取交易记录失败')
      }
    } catch (err: any) {
      error.value = err.message || '获取交易记录失败'
      console.error('获取交易记录失败:', err)
      
      // 如果API失败，提供fallback数据用于开发
      transactions.value = [
        {
          id: 'init-' + Date.now(),
          type: 'credit',
          amount: 1000,
          balance: 1000,
          timestamp: Date.now(),
          metadata: { reason: '初始余额' }
        }
      ]
    } finally {
      loading.value = false
    }
  }

  // 充值余额
  const recharge = async (amount: number) => {
    try {
      loading.value = true
      error.value = null
      
      const response = await balanceApi.recharge(amount)
      if (response.status === 'Success') {
        balance.value = response.data.balance
        // 刷新相关数据
        await Promise.all([
          fetchBalanceStats(),
          fetchTransactions({ limit: 50 })
        ])
        return true
      } else {
        throw new Error(response.message || '充值失败')
      }
    } catch (err: any) {
      error.value = err.message || '充值失败'
      console.error('充值失败:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  // 刷新所有数据
  const refreshAll = async () => {
    await Promise.all([
      fetchBalance(),
      fetchBalanceStats(),
      fetchTransactions({ limit: 50 })
    ])
  }

  // 清除错误
  const clearError = () => {
    error.value = null
  }

  return {
    // 状态
    balance,
    userId,
    stats,
    transactions,
    loading,
    error,
    
    // 计算属性
    formattedBalance,
    hasTransactions,
    recentTransactions,
    
    // 方法
    fetchBalance,
    fetchBalanceStats,
    fetchTransactions,
    recharge,
    refreshAll,
    clearError
  }
})