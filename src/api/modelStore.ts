import { ss } from '@/utils/storage'

export type ModelTaskStatus = 'pending' | 'processing' | 'success' | 'failed'

export interface UnifiedModelTask {
  id: string
  service: 'tripo'
  sourceType: 'image_to_model' | 'multiview_to_model' | 'convert_model'
  status: ModelTaskStatus
  modelVersion?: string
  prompt?: string
  notes?: string
  preview?: string
  modelUrl?: string
  baseModelUrl?: string
  pbrModelUrl?: string
  stlModelUrl?: string // STL 格式下载链接
  progress?: number
  inputs?: Array<{ label: string; token?: string; url?: string; preview?: string }>
  error?: string
  extra?: Record<string, any>
  created_at: number
  updated_at: number
}

export class UnifiedModelStore {
  private localKey = 'unified-model-store'
  private maxTasks = 80

  save(task: UnifiedModelTask) {
    if (!task.id)
      throw new Error('Model task id is required')

    const now = Date.now()
    let arr = this.getAll()
    const index = arr.findIndex(item => item.id === task.id)

    if (index > -1) {
      const existing = arr[index]
      arr[index] = {
        ...existing,
        ...task,
        created_at: existing.created_at,
        updated_at: now,
      }
    }
    else {
      arr.push({
        ...task,
        created_at: task.created_at ?? now,
        updated_at: now,
      })
    }

    arr = arr
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, this.maxTasks)

    ss.set(this.localKey, arr)
    return this
  }

  getAll(): UnifiedModelTask[] {
    try {
      const data = ss.get(this.localKey) as UnifiedModelTask[] | undefined
      const list = data ?? []
      return list.sort((a, b) => b.created_at - a.created_at)
    }
    catch (error) {
      console.error('Failed to read model tasks', error)
      return []
    }
  }

  delete(id: string) {
    const arr = this.getAll()
    const index = arr.findIndex(item => item.id === id)
    if (index < 0)
      return false

    arr.splice(index, 1)
    ss.set(this.localKey, arr)
    return true
  }

  cleanup() {
    try {
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
      const arr = this.getAll().filter(item => {
        if (item.created_at > fourteenDaysAgo)
          return true
        if (item.status === 'pending' || item.status === 'processing')
          return true
        return false
      })
      ss.set(this.localKey, arr)
    }
    catch (error) {
      console.error('Failed to cleanup model tasks', error)
    }
  }
}
