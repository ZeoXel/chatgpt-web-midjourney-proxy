import fs from 'fs/promises'
import path from 'path'
import { mlog } from '../middleware/auth'

// 余额记录接口
export interface BalanceRecord {
  userId: string
  balance: number
  lastUpdated: number
  transactions: BalanceTransaction[]
}

// 交易记录接口
export interface BalanceTransaction {
  id: string
  type: 'debit' | 'credit' | 'charge' // 扣费 | 充值 | 消费
  amount: number
  balance: number // 交易后余额
  timestamp: number
  service?: string
  operation?: string
  model?: string
  metadata?: any
}

class BalanceModel {
  private static dataDir = path.join(process.cwd(), 'data', 'balance')
  private static cache: Map<string, BalanceRecord> = new Map()
  private static readonly DEFAULT_BALANCE = 1000.0 // 默认余额1000
  
  // 初始化数据目录
  static async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      mlog('余额数据目录初始化成功:', this.dataDir)
    } catch (error) {
      mlog('余额数据目录初始化失败:', error)
    }
  }

  // 获取数据文件路径
  private static getDataFilePath(userId: string): string {
    return path.join(this.dataDir, `balance-${userId}.json`)
  }

  // 读取用户余额记录
  private static async readBalanceFile(userId: string): Promise<BalanceRecord> {
    const filePath = this.getDataFilePath(userId)
    
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // 文件不存在时创建默认记录
      const defaultRecord: BalanceRecord = {
        userId,
        balance: this.DEFAULT_BALANCE,
        lastUpdated: Date.now(),
        transactions: [{
          id: `init-${Date.now()}`,
          type: 'credit',
          amount: this.DEFAULT_BALANCE,
          balance: this.DEFAULT_BALANCE,
          timestamp: Date.now(),
          metadata: { reason: 'Initial balance' }
        }]
      }
      
      await this.saveBalanceFile(userId, defaultRecord)
      return defaultRecord
    }
  }

  // 保存用户余额记录
  private static async saveBalanceFile(userId: string, record: BalanceRecord) {
    const filePath = this.getDataFilePath(userId)
    try {
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
      // 更新缓存
      this.cache.set(userId, record)
    } catch (error) {
      mlog('保存余额文件失败:', error)
      throw error
    }
  }

  // 获取用户余额
  static async getBalance(userId: string): Promise<number> {
    try {
      // 先检查缓存
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.lastUpdated < 60000) { // 1分钟缓存
        return cached.balance
      }

      const record = await this.readBalanceFile(userId)
      this.cache.set(userId, record)
      return record.balance
    } catch (error) {
      mlog('获取余额失败:', error)
      return this.DEFAULT_BALANCE // 出错时返回默认余额
    }
  }

  // 扣减余额（用于消费）
  static async deductBalance(
    userId: string,
    amount: number,
    service: string,
    operation: string,
    model?: string,
    metadata?: any
  ): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      if (amount <= 0) {
        return { success: false, balance: 0, message: '扣减金额必须大于0' }
      }

      const record = await this.readBalanceFile(userId)
      
      // 检查余额是否足够
      if (record.balance < amount) {
        return { 
          success: false, 
          balance: record.balance, 
          message: '余额不足' 
        }
      }

      // 扣减余额
      const newBalance = record.balance - amount
      const transaction: BalanceTransaction = {
        id: `debit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'charge',
        amount: -amount, // 负数表示扣减
        balance: newBalance,
        timestamp: Date.now(),
        service,
        operation,
        model,
        metadata
      }

      // 更新记录
      record.balance = newBalance
      record.lastUpdated = Date.now()
      record.transactions.push(transaction)

      // 保持最近1000条交易记录
      if (record.transactions.length > 1000) {
        record.transactions = record.transactions.slice(-1000)
      }

      await this.saveBalanceFile(userId, record)

      mlog(`余额扣减成功: 用户${userId} 扣减${amount} 余额${newBalance}`)
      return { success: true, balance: newBalance }
      
    } catch (error) {
      mlog('扣减余额失败:', error)
      return { success: false, balance: 0, message: '扣减余额时发生错误' }
    }
  }

  // 充值余额
  static async addBalance(
    userId: string,
    amount: number,
    metadata?: any
  ): Promise<{ success: boolean; balance: number; message?: string }> {
    try {
      if (amount <= 0) {
        return { success: false, balance: 0, message: '充值金额必须大于0' }
      }

      const record = await this.readBalanceFile(userId)
      const newBalance = record.balance + amount

      const transaction: BalanceTransaction = {
        id: `credit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'credit',
        amount: amount,
        balance: newBalance,
        timestamp: Date.now(),
        metadata
      }

      // 更新记录
      record.balance = newBalance
      record.lastUpdated = Date.now()
      record.transactions.push(transaction)

      // 保持最近1000条交易记录
      if (record.transactions.length > 1000) {
        record.transactions = record.transactions.slice(-1000)
      }

      await this.saveBalanceFile(userId, record)

      mlog(`余额充值成功: 用户${userId} 充值${amount} 余额${newBalance}`)
      return { success: true, balance: newBalance }
      
    } catch (error) {
      mlog('充值余额失败:', error)
      return { success: false, balance: 0, message: '充值余额时发生错误' }
    }
  }

  // 获取交易记录
  static async getTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BalanceTransaction[]> {
    try {
      const record = await this.readBalanceFile(userId)
      return record.transactions
        .slice()
        .reverse() // 最新的在前
        .slice(offset, offset + limit)
    } catch (error) {
      mlog('获取交易记录失败:', error)
      return []
    }
  }

  // 获取用户余额统计
  static async getBalanceStats(userId: string): Promise<{
    balance: number
    totalSpent: number
    totalRecharged: number
    transactionCount: number
    lastTransaction?: BalanceTransaction
  }> {
    try {
      const record = await this.readBalanceFile(userId)
      
      let totalSpent = 0
      let totalRecharged = 0
      
      for (const tx of record.transactions) {
        if (tx.type === 'charge') {
          totalSpent += Math.abs(tx.amount)
        } else if (tx.type === 'credit') {
          totalRecharged += tx.amount
        }
      }

      return {
        balance: record.balance,
        totalSpent,
        totalRecharged,
        transactionCount: record.transactions.length,
        lastTransaction: record.transactions[record.transactions.length - 1]
      }
      
    } catch (error) {
      mlog('获取余额统计失败:', error)
      return {
        balance: this.DEFAULT_BALANCE,
        totalSpent: 0,
        totalRecharged: 0,
        transactionCount: 0
      }
    }
  }

  // 检查用户是否有足够余额
  static async hasEnoughBalance(userId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getBalance(userId)
      return balance >= requiredAmount
    } catch (error) {
      mlog('检查余额失败:', error)
      return false
    }
  }
}

// 初始化余额数据目录
BalanceModel.init()

export { BalanceModel }