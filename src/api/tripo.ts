import { gptServerStore, homeStore, useAuthStore } from '@/store'
import { mlog } from './mjapi'
import { sleep } from './suno'
import { UnifiedModelStore, type UnifiedModelTask, type ModelTaskStatus } from './modelStore'
import { smartUploadImage } from './imageUpload'

type TaskType = 'image_to_model' | 'multiview_to_model'

const FINAL_STATUS = new Set(['success', 'failed', 'banned', 'expired', 'cancelled'])

function buildAuthHeaders() {
  const headers: Record<string, string> = {}
  if (homeStore.myData.vtoken)
    headers['x-vtoken'] = homeStore.myData.vtoken
  if (homeStore.myData.ctoken)
    headers['x-ctoken'] = homeStore.myData.ctoken

  const authStore = useAuthStore()
  const tripoKey = gptServerStore.myData.TRIPO_KEY?.trim()
  const fallbackKey = gptServerStore.myData.OPENAI_API_KEY?.trim()

  if (tripoKey)
    headers.Authorization = `Bearer ${tripoKey}`
  else if (fallbackKey)
    headers.Authorization = `Bearer ${fallbackKey}`
  else if (authStore.token)
    headers['x-ptoken'] = authStore.token

  return headers
}

function normalizeBase(url?: string | null) {
  if (!url)
    return ''
  const base = url.trim()
  if (!base)
    return ''
  if (!/^https?:\/\//i.test(base))
    return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function resolveGatewayBase() {
  // 优先使用 TRIPO_SERVER 专用配置
  const tripoServer = normalizeBase(gptServerStore.myData.TRIPO_SERVER)
  if (tripoServer)
    return tripoServer

  // 如果配置了真实的 Tripo API Key (tsk-xxx)，直接使用官方 API
  const tripoKey = gptServerStore.myData.TRIPO_KEY?.trim()
  if (tripoKey && tripoKey.startsWith('tsk-')) {
    return 'https://api.tripo3d.ai'
  }

  // 回退到 OPENAI_API_BASE_URL（网关）
  const openaiBase = normalizeBase(gptServerStore.myData.OPENAI_API_BASE_URL)
  if (openaiBase)
    return openaiBase

  // 未配置，返回空字符串(将使用本地代理)
  return ''
}

function gatewayHasTripoPath(base: string) {
  try {
    const parsed = new URL(base)
    return /\/tripo(\/|$)/.test(parsed.pathname)
  }
  catch (error) {
    return /\/tripo(\/|$)/.test(base)
  }
}

function getUrl(url: string) {
  if (url.startsWith('http'))
    return url

  // 特殊处理: 上传接口始终使用本地代理(后端本地保存)
  if (url.includes('/upload/sts')) {
    return `/tripo${url}`
  }

  // 其他请求: 使用网关地址
  const base = resolveGatewayBase()

  // 未配置网关地址,使用本地代理
  if (!base)
    return `/tripo${url}`

  const needsTripo = !gatewayHasTripoPath(base)
  const prefix = needsTripo ? '/tripo' : ''
  return `${base}${prefix}${url}`
}

async function tripoFetch<T = any>(url: string, options: RequestInit & { isForm?: boolean } = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  const authHeaders = buildAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value))

  if (!options.isForm && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')

  const response = await fetch(getUrl(url), {
    method: options.method || (options.body ? 'POST' : 'GET'),
    body: options.body,
    headers,
  })

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText)
    throw new Error(`Tripo API 请求失败 (${response.status}): ${msg}`)
  }

  return await response.json() as T
}

/**
 * 使用后端代理的 Tripo 上传接口
 * 后端会将文件转发到网关，网关再转发到 Tripo
 */
async function uploadToTripoViaBackend(file: File): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    mlog('[Tripo] 使用后端代理上传...')

    // 使用后端代理路由 /tripo/upload/sts
    const response = await fetch('/tripo/upload/sts', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`上传失败 (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    mlog('[Tripo] 上传响应:', result)

    if (result.code !== 0 || !result.data?.image_token) {
      throw new Error(result.message || '上传失败：未返回 image_token')
    }

    return result.data.image_token
  }
  catch (error: any) {
    mlog('[Tripo] 上传失败:', error)
    throw error
  }
}

export async function tripoUploadImage(file: File) {
  try {
    mlog('[Tripo] 开始上传图片到 Supabase...')
    const uploadResult = await smartUploadImage(file)

    if (uploadResult.type !== 'url') {
      throw new Error('Tripo 需要公网可访问的 URL，请确保 Supabase 已配置')
    }

    mlog('[Tripo] 图片上传成功:', uploadResult.url)
    return uploadResult.url
  }
  catch (error: any) {
    mlog('[Tripo] 图片上传失败:', error)
    throw new Error(error.message || '上传失败')
  }
}

/*
// 旧方案：使用 Supabase（已废弃，因为网关无法正确处理外部 URL）
export async function tripoUploadImage(file: File) {
  try {
    // 1. 上传到 Supabase 获取公网 URL
    mlog('[Tripo] 开始上传图片到 Supabase...')
    const uploadResult = await smartUploadImage(file)

    if (uploadResult.type !== 'url') {
      throw new Error('Tripo 需要公网可访问的 URL，请确保 Supabase 已配置')
    }

    mlog('[Tripo] 图片上传成功:', uploadResult.url)

    // 2. 返回格式兼容的 token (实际上是 URL)
    return uploadResult.url
  }
  catch (error: any) {
    mlog('[Tripo] 图片上传失败:', error)
    throw new Error(error.message || '上传失败')
  }
}
*/

interface ImageToModelOptions {
  model_version: string
  texture: boolean
  pbr: boolean
  quad: boolean
  auto_size: boolean
  smart_low_poly: boolean
  model_seed?: number
  texture_seed?: number
  texture_alignment?: string
  style?: string
  note?: string
  file: {
    url: string  // 使用 Supabase 公网 URL
    type?: string
  }
}

interface MultiviewToModelOptions {
  model_version: string
  texture: boolean
  pbr: boolean
  quad: boolean
  smart_low_poly: boolean
  face_limit?: number
  texture_seed?: number
  texture_alignment?: string
  files: Array<{
    view: string
    url: string  // 使用 Supabase URL
    type?: string
  }>
  note?: string
}

export async function createImageToModelTask(options: ImageToModelOptions) {
  const payload = {
    type: 'image_to_model',
    model_version: options.model_version,
    texture: options.texture,
    pbr: options.pbr,
    quad: options.quad,
    auto_size: options.auto_size,
    smart_low_poly: options.smart_low_poly,
    model_seed: options.model_seed || undefined,
    texture_seed: options.texture_seed || undefined,
    texture_alignment: options.texture_alignment || undefined,
    style: options.style || undefined,
    file: {
      type: options.file.type?.split('/')[1] || 'jpeg',  // 简化格式: image/jpeg → jpeg
      url: options.file.url,  // 正确格式：对象包含 type 和 url
    },
  }

  mlog('[Tripo] 创建任务 payload:', JSON.stringify(payload, null, 2))

  const res = await tripoFetch<{ code: number; data: { task_id: string } }>('/task', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (res.code !== 0 || !res.data?.task_id)
    throw new Error('Tripo 创建任务失败')

  return res.data.task_id
}

export async function createMultiviewToModelTask(options: MultiviewToModelOptions) {
  // Tripo API 要求 files 必须是精确 4 个元素的数组: [front, left, back, right]
  // 缺失的视角用空对象 {} 占位
  const viewOrder: Array<'front' | 'left' | 'back' | 'right'> = ['front', 'left', 'back', 'right']
  const files = viewOrder.map((view) => {
    const file = options.files.find(f => f.view === view)
    if (!file || !file.url) {
      return {} // 缺失视角用空对象占位
    }
    return {
      type: file.type || 'jpeg',
      url: file.url,
    }
  })

  const payload = {
    type: 'multiview_to_model',
    model_version: options.model_version,
    texture: options.texture,
    pbr: options.pbr,
    quad: options.quad,
    smart_low_poly: options.smart_low_poly,
    face_limit: options.face_limit || undefined,
    texture_seed: options.texture_seed || undefined,
    texture_alignment: options.texture_alignment || undefined,
    files, // 4 元素数组，不包含 view 字段
  }

  mlog('[Tripo] 创建多视角任务 payload:', JSON.stringify(payload, null, 2))

  const res = await tripoFetch<{ code: number; data: { task_id: string } }>('/task', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (res.code !== 0 || !res.data?.task_id)
    throw new Error('Tripo 多视角任务创建失败')

  return res.data.task_id
}

function mapStatus(status?: string): ModelTaskStatus {
  if (!status)
    return 'pending'
  if (status === 'queued')
    return 'pending'
  if (status === 'running')
    return 'processing'
  if (status === 'success')
    return 'success'
  return 'failed'
}

function buildTaskSnapshot(task: any, meta: { sourceType: TaskType; note?: string; modelVersion?: string; inputs?: UnifiedModelTask['inputs'] }): UnifiedModelTask {
  const createdAt = task?.create_time ? Number(task.create_time) * 1000 : Date.now()
  return {
    id: task.task_id,
    service: 'tripo',
    sourceType: meta.sourceType,
    status: mapStatus(task.status),
    modelVersion: meta.modelVersion,
    notes: meta.note,
    prompt: task.input?.prompt,
    preview: task.output?.rendered_image,
    modelUrl: task.output?.model,
    baseModelUrl: task.output?.base_model,
    pbrModelUrl: task.output?.pbr_model,
    progress: task.progress,
    inputs: meta.inputs,
    error: task.status === 'failed' ? task.message || task.output?.message : undefined,
    extra: task,
    created_at: createdAt,
    updated_at: Date.now(),
  }
}

async function fetchTask(taskId: string) {
  const res = await tripoFetch<{ code: number; data: any }>(`/task/${taskId}`)
  if (res.code !== 0)
    throw new Error(res?.message || 'Tripo 查询失败')
  return res.data
}

export async function tripoFeed(taskId: string, meta: { sourceType: TaskType; note?: string; modelVersion?: string; inputs?: UnifiedModelTask['inputs'] }) {
  const store = new UnifiedModelStore()
  const pending: UnifiedModelTask = {
    id: taskId,
    service: 'tripo',
    sourceType: meta.sourceType,
    status: 'pending',
    notes: meta.note,
    modelVersion: meta.modelVersion,
    inputs: meta.inputs,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
  store.save(pending)
  homeStore.setMyData({ act: 'TripoFeed' })

  for (let i = 0; i < 240; i++) {
    try {
      const task = await fetchTask(taskId)
      mlog('[Tripo] feed', taskId, task.status, task.progress)
      store.save(buildTaskSnapshot(task, meta))
      homeStore.setMyData({ act: 'TripoFeed' })
      if (FINAL_STATUS.has(task.status))
        break
    }
    catch (error) {
      console.error('Tripo 轮询失败', error)
      break
    }
    await sleep(5000)
  }
}

export async function refreshTripoTask(taskId: string) {
  try {
    const data = await fetchTask(taskId)
    const store = new UnifiedModelStore()
    store.save(buildTaskSnapshot(data, {
      sourceType: data.type ?? 'image_to_model',
      modelVersion: data.input?.model_version,
    }))
    homeStore.setMyData({ act: 'TripoFeed' })
  }
  catch (error: any) {
    homeStore.myData.ms?.error?.(error.message || error)
  }
}

export function tripoStatusTag(status: ModelTaskStatus) {
  switch (status) {
    case 'success':
      return { type: 'success', label: '成功' }
    case 'processing':
      return { type: 'warning', label: '制作中' }
    case 'pending':
      return { type: 'info', label: '排队中' }
    default:
      return { type: 'error', label: '失败' }
  }
}
