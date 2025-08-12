import { ss } from '@/utils/storage'

/**
 * 视频信息接口
 * 定义生成的视频文件相关信息
 */
type ViduVideo = {
    url: string;
    width: number;
    height: number;
    duration?: number;  // 视频时长（秒）
    thumbnail: string | null;
    download_url?: string;
    file_size?: number; // 文件大小（字节）
}

/**
 * Vidu 任务数据接口
 * 定义 Vidu API 任务的完整数据结构
 */
export interface ViduTask {
    id: string;                    // 任务唯一标识符
    prompt: string;                // 生成视频的文本描述
    state: string;                 // 任务状态：pending, processing, completed, failed
    created_at?: string;           // 创建时间
    updated_at?: string;           // 更新时间
    video?: ViduVideo;             // 生成的视频信息
    liked?: boolean | null;        // 用户是否喜欢此视频
    estimate_wait_seconds?: number | null; // 预计等待时间
    last_feed?: number;            // 最后一次状态检查时间（时间戳）
    category?: string;             // 任务类别：text2video, image2video, etc.
    
    // 额外的元数据
    error_message?: string;        // 错误信息（如果任务失败）
    progress?: number;             // 任务进度百分比（0-100）
    model_version?: string;        // 使用的模型版本
    
    // 生成参数
    generation_params?: {
        duration?: number;         // 视频长度
        aspect_ratio?: string;     // 宽高比
        style?: string;           // 视频风格
        motion_strength?: number; // 动作强度
        [key: string]: any;       // 其他自定义参数
    }
}

/**
 * Vidu 本地存储管理类
 * 负责管理 Vidu 任务的本地存储和数据操作
 */
export class viduStore {
    private localKey = 'vidu-store';
    
    /**
     * 保存任务数据到本地存储
     * @param obj 要保存的任务对象
     */
    public save(obj: ViduTask) {
        if (!obj.id) throw new Error("Task ID is required");
        
        let arr = this.getObjs();
        let i = arr.findIndex(v => v.id == obj.id);
        
        if (i > -1) {
            // 更新现有任务
            arr[i] = {...arr[i], ...obj};
        } else {
            // 添加新任务
            arr.push(obj);
        }
        
        // 按创建时间排序，最新的在前
        arr.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
        });
        
        ss.set(this.localKey, arr);
        return this;
    }
    
    /**
     * 查找任务在数组中的索引
     * @param id 任务 ID
     */
    public findIndex(id: string) { 
        return this.getObjs().findIndex(v => v.id == id);
    }

    /**
     * 获取所有任务数据
     */
    public getObjs(): ViduTask[] {
        const obj = ss.get(this.localKey) as undefined | ViduTask[];
        if (!obj) return [];
        return obj;
    }
    
    /**
     * 根据 ID 获取单个任务
     * @param id 任务 ID
     */
    public getOneById(id: string): ViduTask | null {
        const i = this.findIndex(id);
        if (i < 0) return null;
        let arr = this.getObjs();
        return arr[i];
    }
    
    /**
     * 删除任务
     * @param obj 要删除的任务对象
     */
    public delete(obj: ViduTask) {
        if (!obj.id) throw new Error("Task ID is required");
        
        let arr = this.getObjs();
        let i = arr.findIndex(v => v.id == obj.id);
        if (i < 0) return false;
        
        arr.splice(i, 1);
        ss.set(this.localKey, arr);
        return true;
    }
    
    /**
     * 根据 ID 删除任务
     * @param id 任务 ID
     */
    public deleteById(id: string) {
        let arr = this.getObjs();
        let i = arr.findIndex(v => v.id == id);
        if (i < 0) return false;
        
        arr.splice(i, 1);
        ss.set(this.localKey, arr);
        return true;
    }
    
    /**
     * 获取指定状态的任务
     * @param state 任务状态
     */
    public getByState(state: string): ViduTask[] {
        return this.getObjs().filter(task => task.state === state);
    }
    
    /**
     * 获取进行中的任务（非完成和失败状态）
     */
    public getActiveTasks(): ViduTask[] {
        return this.getObjs().filter(task => 
            task.state !== 'completed' && task.state !== 'failed'
        );
    }
    
    /**
     * 获取已完成的任务
     */
    public getCompletedTasks(): ViduTask[] {
        return this.getByState('completed');
    }
    
    /**
     * 获取失败的任务
     */
    public getFailedTasks(): ViduTask[] {
        return this.getByState('failed');
    }
    
    /**
     * 更新任务状态
     * @param id 任务 ID
     * @param state 新状态
     * @param additionalData 额外要更新的数据
     */
    public updateTaskState(id: string, state: string, additionalData?: Partial<ViduTask>) {
        const task = this.getOneById(id);
        if (!task) return false;
        
        const updatedTask = {
            ...task,
            state,
            updated_at: new Date().toISOString(),
            last_feed: new Date().getTime(),
            ...additionalData
        };
        
        this.save(updatedTask);
        return true;
    }
    
    /**
     * 清理旧任务（保留最近的 N 个任务）
     * @param keepCount 保留的任务数量
     */
    public cleanup(keepCount: number = 50) {
        const tasks = this.getObjs();
        if (tasks.length <= keepCount) return;
        
        // 保留最新的任务
        const tasksToKeep = tasks.slice(0, keepCount);
        ss.set(this.localKey, tasksToKeep);
    }
    
    /**
     * 获取任务统计信息
     */
    public getStats() {
        const tasks = this.getObjs();
        const stats = {
            total: tasks.length,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            recent: tasks.slice(0, 10).length
        };
        
        tasks.forEach(task => {
            switch (task.state) {
                case 'pending':
                    stats.pending++;
                    break;
                case 'processing':
                    stats.processing++;
                    break;
                case 'completed':
                    stats.completed++;
                    break;
                case 'failed':
                    stats.failed++;
                    break;
            }
        });
        
        return stats;
    }
    
    /**
     * 清空所有任务数据
     */
    public clear() {
        ss.set(this.localKey, []);
    }
    
    /**
     * 导出任务数据
     */
    public export(): string {
        return JSON.stringify(this.getObjs(), null, 2);
    }
    
    /**
     * 导入任务数据
     * @param data JSON 字符串格式的任务数据
     */
    public import(data: string) {
        try {
            const tasks = JSON.parse(data) as ViduTask[];
            if (Array.isArray(tasks)) {
                ss.set(this.localKey, tasks);
                return true;
            }
        } catch (e) {
            console.error('Import tasks failed:', e);
        }
        return false;
    }
}

/**
 * 用户偏好设置接口
 * 保存用户对 Vidu 服务的个性化配置
 */
export interface ViduUserPreferences {
    id: string;  // 用户标识
    
    // 默认生成参数
    default_duration?: number;     // 默认视频长度
    default_aspect_ratio?: string; // 默认宽高比
    default_style?: string;        // 默认风格
    
    // UI 偏好
    auto_play_videos?: boolean;    // 是否自动播放视频
    show_thumbnails?: boolean;     // 是否显示缩略图
    grid_view?: boolean;          // 是否使用网格视图
    
    // 通知设置
    notify_on_completion?: boolean; // 完成时通知
    notify_on_failure?: boolean;   // 失败时通知
}

/**
 * 用户偏好设置存储类
 * 管理用户的个性化配置
 */
export class viduUserPreferenceStore {
    private localKey = 'vidu-user-preferences';
    
    /**
     * 保存用户偏好
     * @param preferences 用户偏好对象
     */
    public save(preferences: ViduUserPreferences) {
        if (!preferences.id) throw new Error("User ID is required");
        ss.set(this.localKey, preferences);
        return this;
    }
    
    /**
     * 获取用户偏好
     */
    public get(): ViduUserPreferences | null {
        const preferences = ss.get(this.localKey) as undefined | ViduUserPreferences;
        return preferences || null;
    }
    
    /**
     * 更新部分偏好设置
     * @param updates 要更新的偏好设置
     */
    public update(updates: Partial<ViduUserPreferences>) {
        const current = this.get();
        if (!current) return false;
        
        const updated = {...current, ...updates};
        this.save(updated);
        return true;
    }
    
    /**
     * 清空用户偏好
     */
    public clear() {
        ss.remove(this.localKey);
    }
}