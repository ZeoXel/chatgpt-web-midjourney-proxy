import { ss } from './index'

interface StorageMonitorOptions {
  warningThreshold?: number // 警告阈值（百分比）
  criticalThreshold?: number // 严重警告阈值（百分比）
  checkInterval?: number // 检查间隔（毫秒）
  onWarning?: (info: StorageInfo) => void
  onCritical?: (info: StorageInfo) => void
}

interface StorageInfo {
  total: number
  totalMB: string
  usage: string
  usagePercent: number
  details: Record<string, number>
}

const STORAGE_LIMIT = 10 * 1024 * 1024 // 假设 10MB 限制
const WARNING_KEY = 'storageWarningShown'
const LAST_CHECK_KEY = 'lastStorageCheck'

class StorageMonitor {
  private options: Required<StorageMonitorOptions>
  private checkTimer: number | null = null

  constructor(options: StorageMonitorOptions = {}) {
    this.options = {
      warningThreshold: options.warningThreshold ?? 70,
      criticalThreshold: options.criticalThreshold ?? 85,
      checkInterval: options.checkInterval ?? 30000, // 默认30秒检查一次
      onWarning: options.onWarning ?? this.defaultWarningHandler,
      onCritical: options.onCritical ?? this.defaultCriticalHandler
    }
  }

  /**
   * 获取当前存储信息
   */
  getStorageInfo(): StorageInfo {
    let total = 0
    let details: Record<string, number> = {}

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) {
        const value = window.localStorage.getItem(key)
        const size = value ? new Blob([value]).size : 0
        details[key] = size
        total += size
      }
    }

    // 按大小排序
    const sortedDetails = Object.entries(details)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    const usagePercent = (total / STORAGE_LIMIT) * 100

    return {
      total,
      totalMB: (total / 1024 / 1024).toFixed(2),
      usage: usagePercent.toFixed(1),
      usagePercent,
      details: Object.fromEntries(sortedDetails)
    }
  }

  /**
   * 检查存储空间并触发相应的回调
   */
  check(): StorageInfo {
    const info = this.getStorageInfo()
    const { usagePercent } = info

    // 检查是否需要显示警告
    const lastWarningTime = ss.get(WARNING_KEY) as number | null
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    // 至少间隔1小时才显示下一次警告
    const shouldShowWarning = !lastWarningTime || (now - lastWarningTime) > oneHour

    if (usagePercent >= this.options.criticalThreshold) {
      if (shouldShowWarning) {
        this.options.onCritical(info)
        ss.set(WARNING_KEY, now)
      }
    } else if (usagePercent >= this.options.warningThreshold) {
      if (shouldShowWarning) {
        this.options.onWarning(info)
        ss.set(WARNING_KEY, now)
      }
    }

    ss.set(LAST_CHECK_KEY, now)
    return info
  }

  /**
   * 启动自动监控
   */
  start(): void {
    if (this.checkTimer) {
      return
    }

    // 立即执行一次检查
    this.check()

    // 设置定时检查
    this.checkTimer = window.setInterval(() => {
      this.check()
    }, this.options.checkInterval)
  }

  /**
   * 停止自动监控
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * 默认警告处理器
   */
  private defaultWarningHandler(info: StorageInfo): void {
    console.warn(`⚠️ 存储空间使用率: ${info.usage}%`)
    console.warn('建议清理部分数据以避免存储失败')
  }

  /**
   * 默认严重警告处理器
   */
  private defaultCriticalHandler(info: StorageInfo): void {
    console.error(`🚨 存储空间严重不足: ${info.usage}%`)
    console.error('请立即清理数据，否则可能无法保存新内容')

    // 显示用户提示
    const message = `存储空间即将用尽！\n\n当前使用: ${info.usage}%\n已用空间: ${info.totalMB}MB\n\n建议：\n1. 前往【设置】清理存储\n2. 删除旧的聊天记录\n3. 导出重要数据`

    // 使用 setTimeout 避免阻塞主线程
    setTimeout(() => {
      if (window.confirm(message + '\n\n是否现在前往设置页面？')) {
        window.location.hash = '#/setting'
      }
    }, 0)
  }

  /**
   * 格式化字节大小
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
}

// 创建单例
export const storageMonitor = new StorageMonitor({
  warningThreshold: 70,
  criticalThreshold: 85,
  checkInterval: 60000 // 每分钟检查一次
})

// 自动启动监控
if (typeof window !== 'undefined') {
  storageMonitor.start()
}

export default StorageMonitor
