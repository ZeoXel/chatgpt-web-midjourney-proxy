import { ss } from '@/utils/storage'

/**
 * Vidu 任务状态枚举
 */
export enum ViduTaskState {
    PENDING = 'pending',
    PROCESSING = 'processing', 
    COMPLETED = 'completed',
    FAILED = 'failed'
}

/**
 * Vidu 任务接口定义
 */
export interface ViduTask {
    id: string;
    state: string;
    model: string;
    prompt: string;
    video?: {
        download_url?: string;
        thumbnail_url?: string;
    };
    created_at: string;
    last_feed: number;
    duration?: number;
    aspect_ratio?: string;
    resolution?: string;
    movement_amplitude?: string;
    category?: string;
    error?: string;
    progress?: number;
    images?: string[]; // 参考图片
    seed?: string;
    style?: string;
    // 扩展字段
    credits_used?: number;
    estimated_cost?: number;
    generation_time?: number;
}

/**
 * Vidu 任务列表接口
 */
export interface ViduTaskList {
    tasks: ViduTask[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Vidu 模型配置接口
 */
export interface ViduModelConfig {
    name: string;
    display_name: string;
    duration_options: number[];
    resolution_options: string[];
    aspect_ratio_options: string[];
    max_images?: number;
    supports_reference?: boolean;
    credits_per_second?: number;
}

/**
 * Vidu 本地存储管理类
 */
export class viduStore {
    private readonly storageKey = 'vidu-tasks'
    
    constructor() {
        this.initStorage()
    }

    /**
     * 初始化存储
     */
    private initStorage() {
        if (!ss.get(this.storageKey)) {
            ss.set(this.storageKey, [])
        }
    }

    /**
     * 获取所有任务
     */
    getObjs(): ViduTask[] {
        try {
            const tasks = ss.get(this.storageKey) || []
            return Array.isArray(tasks) ? tasks : []
        } catch (error) {
            console.error('Error getting Vidu tasks:', error)
            return []
        }
    }

    /**
     * 根据 ID 获取单个任务
     */
    getOneById(id: string): ViduTask | null {
        const tasks = this.getObjs()
        return tasks.find(task => task.id === id) || null
    }

    /**
     * 保存任务
     */
    save(obj: ViduTask) {
        const tasks = this.getObjs()
        const index = tasks.findIndex(task => task.id === obj.id)
        
        if (index > -1) {
            tasks[index] = { ...tasks[index], ...obj }
        } else {
            tasks.unshift(obj)
        }

        // 限制存储数量，保留最新的 200 个任务
        if (tasks.length > 200) {
            tasks.splice(200)
        }

        ss.set(this.storageKey, tasks)
    }

    /**
     * 批量保存任务
     */
    saveAll(objs: ViduTask[]) {
        objs.forEach(obj => this.save(obj))
    }

    /**
     * 删除任务
     */
    delete(obj: ViduTask) {
        const tasks = this.getObjs()
        const filteredTasks = tasks.filter(task => task.id !== obj.id)
        ss.set(this.storageKey, filteredTasks)
    }

    /**
     * 批量删除任务
     */
    deleteMultiple(ids: string[]) {
        const tasks = this.getObjs()
        const filteredTasks = tasks.filter(task => !ids.includes(task.id))
        ss.set(this.storageKey, filteredTasks)
    }

    /**
     * 清空所有任务
     */
    clear() {
        ss.set(this.storageKey, [])
    }

    /**
     * 按状态筛选任务
     */
    getTasksByState(state: string): ViduTask[] {
        return this.getObjs().filter(task => task.state === state)
    }

    /**
     * 按模型筛选任务
     */
    getTasksByModel(model: string): ViduTask[] {
        return this.getObjs().filter(task => task.model === model)
    }

    /**
     * 获取正在处理的任务
     */
    getProcessingTasks(): ViduTask[] {
        return this.getObjs().filter(task => 
            task.state === 'pending' || 
            task.state === 'processing' || 
            task.state === 'running'
        )
    }

    /**
     * 获取已完成的任务
     */
    getCompletedTasks(): ViduTask[] {
        return this.getTasksByState('completed')
    }

    /**
     * 获取失败的任务
     */
    getFailedTasks(): ViduTask[] {
        return this.getTasksByState('failed')
    }

    /**
     * 按时间排序获取任务（最新优先）
     */
    getTasksSortedByTime(): ViduTask[] {
        return this.getObjs().sort((a, b) => {
            const timeA = new Date(a.created_at).getTime()
            const timeB = new Date(b.created_at).getTime()
            return timeB - timeA
        })
    }

    /**
     * 搜索任务（按提示词或ID）
     */
    searchTasks(keyword: string): ViduTask[] {
        if (!keyword.trim()) return this.getObjs()
        
        const lowerKeyword = keyword.toLowerCase()
        return this.getObjs().filter(task =>
            task.prompt.toLowerCase().includes(lowerKeyword) ||
            task.id.toLowerCase().includes(lowerKeyword) ||
            task.model.toLowerCase().includes(lowerKeyword)
        )
    }

    /**
     * 获取统计信息
     */
    getStatistics() {
        const tasks = this.getObjs()
        const total = tasks.length
        const completed = tasks.filter(t => t.state === 'completed').length
        const failed = tasks.filter(t => t.state === 'failed').length
        const processing = tasks.filter(t => 
            t.state === 'pending' || 
            t.state === 'processing' || 
            t.state === 'running'
        ).length

        // 计算总积分使用量
        const totalCredits = tasks.reduce((sum, task) => sum + (task.credits_used || 0), 0)
        const totalCost = tasks.reduce((sum, task) => sum + (task.estimated_cost || 0), 0)

        return {
            total,
            completed,
            failed,
            processing,
            success_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
            total_credits: totalCredits,
            total_cost: Number(totalCost.toFixed(2))
        }
    }

    /**
     * 导出任务数据
     */
    exportTasks(): string {
        const tasks = this.getObjs()
        return JSON.stringify(tasks, null, 2)
    }

    /**
     * 导入任务数据
     */
    importTasks(data: string): boolean {
        try {
            const tasks = JSON.parse(data) as ViduTask[]
            if (!Array.isArray(tasks)) {
                throw new Error('Invalid data format')
            }
            
            // 验证数据结构
            tasks.forEach(task => {
                if (!task.id || !task.state || !task.model || !task.prompt) {
                    throw new Error('Invalid task data structure')
                }
            })

            ss.set(this.storageKey, tasks)
            return true
        } catch (error) {
            console.error('Error importing Vidu tasks:', error)
            return false
        }
    }
}

/**
 * Vidu 香港服务器存储（如果需要区分）
 */
export class viduHkStore extends viduStore {
    protected readonly storageKey = 'vidu-hk-tasks'
}

/**
 * Vidu 配置存储
 */
export class viduConfigStore {
    private readonly storageKey = 'vidu-config'

    /**
     * 获取用户配置
     */
    getConfig() {
        return ss.get(this.storageKey) || {
            default_model: 'vidu2.0',
            default_duration: 4,
            default_aspect_ratio: '16:9',
            default_resolution: '720p',
            default_movement_amplitude: 'auto',
            auto_poll: true,
            poll_interval: 5000,
            show_notifications: true,
            auto_download: false
        }
    }

    /**
     * 保存用户配置
     */
    saveConfig(config: any) {
        const currentConfig = this.getConfig()
        ss.set(this.storageKey, { ...currentConfig, ...config })
    }

    /**
     * 重置配置
     */
    resetConfig() {
        ss.remove(this.storageKey)
    }
}

/**
 * Vidu 模型定义
 */
export const viduModelConfigs: Record<string, ViduModelConfig> = {
    'viduq1': {
        name: 'viduq1',
        display_name: 'Vidu Q1',
        duration_options: [5],
        resolution_options: ['1080p'],
        aspect_ratio_options: ['16:9'],
        supports_reference: true,
        credits_per_second: 1.6
    },
    'vidu2.0': {
        name: 'vidu2.0',
        display_name: 'Vidu 2.0',
        duration_options: [4],
        resolution_options: ['720p'],
        aspect_ratio_options: ['16:9', '9:16', '1:1'],
        supports_reference: true,
        credits_per_second: 2
    },
    'vidu1.5': {
        name: 'vidu1.5',
        display_name: 'Vidu 1.5',
        duration_options: [4, 8],
        resolution_options: ['360p', '720p', '1080p'],
        aspect_ratio_options: ['16:9', '9:16', '1:1'],
        supports_reference: true,
        credits_per_second: 2
    },
    'vidu1.0': {
        name: 'vidu1.0',
        display_name: 'Vidu 1.0',
        duration_options: [4, 8],
        resolution_options: ['360p'],
        aspect_ratio_options: ['16:9'],
        supports_reference: false,
        credits_per_second: 2
    }
}

/**
 * 导出默认存储实例
 */
export const defaultViduStore = new viduStore()
export const defaultViduHkStore = new viduHkStore()
export const defaultViduConfigStore = new viduConfigStore()