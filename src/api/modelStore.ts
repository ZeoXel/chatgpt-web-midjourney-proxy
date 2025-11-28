import { ss } from '@/utils/storage'
import type { ModelRecord } from './modelStorage'

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

  /**
   * 获取合并后的模型列表（COS JSON + localStorage）
   */
  async getAllWithCOS(): Promise<UnifiedModelTask[]> {
    try {
      console.log('[Model Store] 🔄 开始合并COS和本地数据...')

      const { loadModelsFromCOS } = await import('./modelStorage')

      const [cosModels, localModels] = await Promise.all([
        loadModelsFromCOS({ limit: 200 }),
        Promise.resolve(this.getAll())
      ])

      console.log(`[Model Store] 数据源统计:
  - COS: ${cosModels.length} 个
  - 本地: ${localModels.length} 个`)

      const modelMap = new Map<string, UnifiedModelTask>()

      // COS数据优先
      cosModels.forEach((cosModel: ModelRecord) => {
        const task: UnifiedModelTask = {
          id: cosModel.id,
          service: cosModel.service as 'tripo',
          sourceType: cosModel.sourceType as any,
          status: cosModel.status as any,
          modelVersion: cosModel.modelVersion,
          prompt: cosModel.prompt,
          notes: cosModel.notes,
          preview: cosModel.cos_preview_url,
          modelUrl: cosModel.cos_model_url,
          created_at: new Date(cosModel.created_at).getTime(),
          updated_at: Date.now(),
          extra: { ...cosModel.metadata, source: 'cos' }
        }
        modelMap.set(task.id, task)
      })

      // 本地数据补充
      localModels.forEach(model => {
        if (!modelMap.has(model.id)) {
          modelMap.set(model.id, { ...model, extra: { ...model.extra, source: 'local' } })
        }
      })

      const merged = Array.from(modelMap.values())
      merged.sort((a, b) => b.created_at - a.created_at)

      console.log(`[Model Store] ✅ 合并完成: ${merged.length} 个模型`)

      return merged
    } catch (error) {
      console.error('[Model Store] ❌ 合并失败:', error)
      return this.getAll()
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
