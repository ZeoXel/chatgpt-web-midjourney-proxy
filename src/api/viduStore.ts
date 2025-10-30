import { ss } from '@/utils/storage'

// Vidu视频数据结构（基于官方API响应）
export type ViduVideo = {
  id: string;
  url: string;
  cover_url: string;
}

// Vidu任务数据结构
export type ViduTask = {
  task_id: string;
  state: 'created' | 'queueing' | 'processing' | 'success' | 'succeeded' | 'failed'; // 添加succeeded状态
  model: 'viduq2-turbo' | 'viduq2-pro' | 'viduq2' | 'vidu2.0' | 'vidu1.5';
  prompt: string;
  images: string[];
  duration: number;
  seed?: number;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  resolution: string;
  movement_amplitude: 'auto' | 'small' | 'medium' | 'large';
  bgm: boolean;
  off_peak: boolean;
  credits?: number;
  created_at: string;
  err_code?: string;
  payload?: string;
  creations?: ViduVideo[];
  liked?: boolean | null;
  last_feed?: number;
  url?: string; // 添加视频URL字段
}

// 模型配置映射
export const MODEL_CONFIGS = {
  'viduq2-turbo': {
    durations: [5, 8],
    resolutions: ['1080p'],
    description: '图生/首尾生视频 - 快速模式，默认1080p',
    modes: ['img2video', 'firstTail']
  },
  'viduq2-pro': {
    durations: [5, 8],
    resolutions: ['1080p'],
    description: '图生/首尾生视频 - 专业模式，默认1080p',
    modes: ['img2video', 'firstTail']
  },
  'viduq2': {
    durations: [5, 8],
    resolutions: ['1080p'],
    description: '参考生视频，默认1080p',
    modes: ['reference']
  },
  'vidu2.0': {
    duration: 4,
    resolutions: ['360p', '720p'],
    description: '生成速度快'
  },
  'vidu1.5': {
    durations: [4, 8],
    resolutions: ['360p', '720p', '1080p'],
    description: '动态幅度大'
  }
};

// Vidu本地存储管理类
export class ViduStore {
  private localKey = 'vidu-store';
  private maxTasks = 20; // 最大存储任务数量

  // 清理任务数据，移除图片数据以节省空间
  private cleanTaskForStorage(task: ViduTask): ViduTask {
    const cleanTask = { ...task };
    // 如果图片数据过大，只保留图片URL的基本信息
    if (cleanTask.images && cleanTask.images.some(img => img.startsWith('data:'))) {
      cleanTask.images = cleanTask.images.map((img, index) => 
        img.startsWith('data:') ? `[base64-image-${index}]` : img
      );
    }
    return cleanTask;
  }

  // 限制存储的任务数量，删除旧任务
  private limitStoredTasks(tasks: ViduTask[]): ViduTask[] {
    if (tasks.length <= this.maxTasks) return tasks;
    
    // 按创建时间排序，保留最新的任务
    return tasks
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, this.maxTasks);
  }

  public save(obj: ViduTask) {
    if (!obj.task_id) throw "task_id must be provided";
    
    try {
      let arr = this.getObjs();
      let i = arr.findIndex(v => v.task_id === obj.task_id);
      
      // 清理任务数据以节省空间
      const cleanObj = this.cleanTaskForStorage(obj);
      
      if (i > -1) {
        arr[i] = cleanObj;
      } else {
        arr.push(cleanObj);
      }
      
      // 限制存储的任务数量
      arr = this.limitStoredTasks(arr);
      
      ss.set(this.localKey, arr);
    } catch (error) {
      console.error('保存任务到localStorage失败:', error);
      // 如果存储失败，尝试清理后重试
      this.cleanup();
      try {
        const cleanObj = this.cleanTaskForStorage(obj);
        ss.set(this.localKey, [cleanObj]);
      } catch (retryError) {
        console.error('重试保存失败:', retryError);
        throw new Error('localStorage空间不足，无法保存任务');
      }
    }
  }

  public getObjs(): ViduTask[] {
    try {
      return ss.get(this.localKey) ?? [];
    } catch (error) {
      console.error('从localStorage读取任务失败:', error);
      return [];
    }
  }

  public getObj(task_id: string): ViduTask | null {
    let arr = this.getObjs();
    return arr.find(v => v.task_id === task_id) ?? null;
  }

  public remove(task_id: string) {
    let arr = this.getObjs();
    let i = arr.findIndex(v => v.task_id === task_id);
    if (i > -1) {
      arr.splice(i, 1);
      ss.set(this.localKey, arr);
    }
  }

  public clear() {
    try {
      ss.remove(this.localKey);
    } catch (error) {
      console.error('清理localStorage失败:', error);
    }
  }

  // 清理旧的和已完成的任务，释放存储空间
  public cleanup() {
    try {
      const tasks = this.getObjs();
      const now = Date.now();
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 一周前
      
      // 保留最近一周的任务，或者未完成的任务
      const filteredTasks = tasks.filter(task => {
        const taskTime = new Date(task.created_at).getTime();
        return taskTime > oneWeekAgo || 
               task.state === 'created' || 
               task.state === 'queueing' || 
               task.state === 'processing';
      });
      
      // 限制数量并保存
      const limitedTasks = this.limitStoredTasks(filteredTasks);
      ss.set(this.localKey, limitedTasks);
      
      console.log(`清理完成：从 ${tasks.length} 个任务减少到 ${limitedTasks.length} 个任务`);
    } catch (error) {
      console.error('清理任务失败:', error);
      // 如果清理失败，直接清空存储
      ss.remove(this.localKey);
    }
  }

  // 获取存储空间使用情况
  public getStorageInfo() {
    try {
      const data = ss.get(this.localKey) ?? [];
      const dataSize = JSON.stringify(data).length;
      return {
        taskCount: data.length,
        storageSize: dataSize,
        maxTasks: this.maxTasks
      };
    } catch (error) {
      return {
        taskCount: 0,
        storageSize: 0,
        maxTasks: this.maxTasks
      };
    }
  }

  // 获取待处理的任务（用于状态轮询）
  public getPendingTasks(): ViduTask[] {
    return this.getObjs().filter(task => 
      task.state === 'created' || 
      task.state === 'queueing' || 
      task.state === 'processing'
    );
  }

  // 更新任务状态
  public updateTaskState(task_id: string, updates: Partial<ViduTask>) {
    let task = this.getObj(task_id);
    if (task) {
      Object.assign(task, updates);
      this.save(task);
    }
  }
}

export const viduStore = new ViduStore();