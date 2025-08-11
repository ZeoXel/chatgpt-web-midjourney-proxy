/**
 * 性能监控工具
 */

// Web Vitals 相关
interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

interface PerformanceConfig {
  enableLogging: boolean
  enableReporting: boolean
  reportUrl?: string
  sampleRate: number
}

class PerformanceMonitor {
  private config: PerformanceConfig
  private metrics: PerformanceMetric[] = []
  private observer?: PerformanceObserver

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableReporting: false,
      sampleRate: 1,
      ...config,
    }

    this.init()
  }

  private init() {
    // 监听 Web Vitals
    this.observeWebVitals()
    
    // 监听资源加载
    this.observeResourceTiming()
    
    // 监听长任务
    this.observeLongTasks()
    
    // 页面卸载时发送数据
    this.setupBeforeUnload()
  }

  private observeWebVitals() {
    // Core Web Vitals
    this.observeLCP() // Largest Contentful Paint
    this.observeFID() // First Input Delay
    this.observeCLS() // Cumulative Layout Shift
    
    // Other Web Vitals
    this.observeFCP() // First Contentful Paint
    this.observeTTFB() // Time to First Byte
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      
      if (lastEntry) {
        this.recordMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: this.getLCPRating(lastEntry.startTime),
          timestamp: Date.now(),
        })
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  }

  private observeFID() {
    if (!('PerformanceObserver' in window)) return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        this.recordMetric({
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          rating: this.getFIDRating(entry.processingStart - entry.startTime),
          timestamp: Date.now(),
        })
      })
    }).observe({ type: 'first-input', buffered: true })
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return

    let clsValue = 0
    let sessionValue = 0
    let sessionEntries: any[] = []

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0]
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1]
          
          if (sessionValue && 
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000) {
            sessionValue += entry.value
            sessionEntries.push(entry)
          } else {
            sessionValue = entry.value
            sessionEntries = [entry]
          }
          
          if (sessionValue > clsValue) {
            clsValue = sessionValue
            this.recordMetric({
              name: 'CLS',
              value: clsValue,
              rating: this.getCLSRating(clsValue),
              timestamp: Date.now(),
            })
          }
        }
      })
    }).observe({ type: 'layout-shift', buffered: true })
  }

  private observeFCP() {
    if (!('PerformanceObserver' in window)) return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric({
            name: 'FCP',
            value: entry.startTime,
            rating: this.getFCPRating(entry.startTime),
            timestamp: Date.now(),
          })
        }
      })
    }).observe({ type: 'paint', buffered: true })
  }

  private observeTTFB() {
    if (!('performance' in window) || !performance.timing) return

    const timing = performance.timing
    const ttfb = timing.responseStart - timing.requestStart

    this.recordMetric({
      name: 'TTFB',
      value: ttfb,
      rating: this.getTTFBRating(ttfb),
      timestamp: Date.now(),
    })
  }

  private observeResourceTiming() {
    if (!('PerformanceObserver' in window)) return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        // 监控关键资源
        if (this.isKeyResource(entry.name)) {
          this.recordMetric({
            name: 'Resource Load Time',
            value: entry.duration,
            rating: this.getResourceRating(entry.duration),
            timestamp: Date.now(),
          })
        }
      })
    }).observe({ type: 'resource', buffered: true })
  }

  private observeLongTasks() {
    if (!('PerformanceObserver' in window)) return

    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        this.recordMetric({
          name: 'Long Task',
          value: entry.duration,
          rating: 'poor',
          timestamp: Date.now(),
        })
      })
    }).observe({ type: 'longtask', buffered: true })
  }

  private setupBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      this.sendMetrics()
    })

    // 页面可见性变化时也发送数据
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendMetrics()
      }
    })
  }

  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric)

    if (this.config.enableLogging) {
      console.group(`📊 Performance: ${metric.name}`)
      console.log(`Value: ${metric.value.toFixed(2)}ms`)
      console.log(`Rating: ${metric.rating}`)
      console.log(`Timestamp: ${new Date(metric.timestamp).toISOString()}`)
      console.groupEnd()
    }

    // 实时报告关键指标
    if (this.shouldReport(metric)) {
      this.reportMetric(metric)
    }
  }

  private shouldReport(metric: PerformanceMetric): boolean {
    return (
      this.config.enableReporting &&
      Math.random() < this.config.sampleRate &&
      ['LCP', 'FID', 'CLS'].includes(metric.name)
    )
  }

  private async reportMetric(metric: PerformanceMetric) {
    if (!this.config.reportUrl) return

    try {
      await fetch(this.config.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      })
    } catch (error) {
      console.warn('Failed to report metric:', error)
    }
  }

  private sendMetrics() {
    if (!this.config.enableReporting || this.metrics.length === 0) return

    const payload = {
      metrics: this.metrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }

    // 使用 sendBeacon 确保数据发送
    if (navigator.sendBeacon && this.config.reportUrl) {
      navigator.sendBeacon(
        this.config.reportUrl,
        JSON.stringify(payload)
      )
    }

    this.metrics = []
  }

  // 评分方法
  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good'
    if (value <= 4000) return 'needs-improvement'
    return 'poor'
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good'
    if (value <= 300) return 'needs-improvement'
    return 'poor'
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }

  private getFCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good'
    if (value <= 3000) return 'needs-improvement'
    return 'poor'
  }

  private getTTFBRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 800) return 'good'
    if (value <= 1800) return 'needs-improvement'
    return 'poor'
  }

  private getResourceRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1000) return 'good'
    if (value <= 2500) return 'needs-improvement'
    return 'poor'
  }

  private isKeyResource(url: string): boolean {
    const keyExtensions = ['.js', '.css', '.woff2', '.woff']
    return keyExtensions.some(ext => url.includes(ext))
  }

  // 公共方法
  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  public clearMetrics(): void {
    this.metrics = []
  }

  public mark(name: string): void {
    if ('performance' in window && performance.mark) {
      performance.mark(name)
    }
  }

  public measure(name: string, startMark: string, endMark?: string): number {
    if ('performance' in window && performance.measure) {
      performance.measure(name, startMark, endMark)
      const entries = performance.getEntriesByName(name, 'measure')
      return entries.length > 0 ? entries[entries.length - 1].duration : 0
    }
    return 0
  }
}

// 创建全局实例
export const performanceMonitor = new PerformanceMonitor({
  enableLogging: process.env.NODE_ENV === 'development',
  enableReporting: process.env.NODE_ENV === 'production',
  sampleRate: 0.1, // 10% 采样率
})

// 便捷方法
export const markStart = (name: string) => {
  performanceMonitor.mark(`${name}-start`)
}

export const markEnd = (name: string) => {
  performanceMonitor.mark(`${name}-end`)
  return performanceMonitor.measure(name, `${name}-start`, `${name}-end`)
}

// 组件性能监控装饰器
export const withPerformanceTracking = (name: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const trackingName = `${name}-${propertyKey}`
      markStart(trackingName)

      try {
        const result = await originalMethod.apply(this, args)
        const duration = markEnd(trackingName)
        
        if (duration > 100) {
          console.warn(`⚠️ Slow operation detected: ${trackingName} took ${duration.toFixed(2)}ms`)
        }

        return result
      } catch (error) {
        markEnd(trackingName)
        throw error
      }
    }

    return descriptor
  }
}

export default performanceMonitor