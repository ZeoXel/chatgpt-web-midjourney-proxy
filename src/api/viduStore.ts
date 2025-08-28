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
  state: 'created' | 'queueing' | 'processing' | 'success' | 'failed';
  model: 'viduq1' | 'vidu2.0' | 'vidu1.5';
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
}

// 模型配置映射
export const MODEL_CONFIGS = {
  'viduq1': {
    duration: 5,
    resolutions: ['1080p'],
    description: '高质量，画面清晰，平滑转场，运镜稳定'
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

  public save(obj: ViduTask) {
    if (!obj.task_id) throw "task_id must be provided";
    let arr = this.getObjs();
    let i = arr.findIndex(v => v.task_id === obj.task_id);
    if (i > -1) arr[i] = obj;
    else arr.push(obj);
    ss.set(this.localKey, arr);
  }

  public getObjs(): ViduTask[] {
    return ss.get(this.localKey) ?? [];
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
    ss.remove(this.localKey);
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