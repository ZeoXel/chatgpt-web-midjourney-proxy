import { ss } from '@/utils/storage';

/**
 * 统一视频任务类型 - 符合第一性原理
 * 所有视频服务的核心数据结构
 */
export interface UnifiedVideoTask {
  // 核心标识
  id: string;
  service: 'vidu' | 'runway' | 'pika' | 'kling' | 'runwayml' | 'sora2' | 'minimax';

  // 核心内容
  url: string;                    // 视频URL (原始URL,暂不上传云存储)
  poster?: string;                // 封面图URL
  status: 'pending' | 'processing' | 'success' | 'failed';
  prompt: string;

  // 元数据
  model: string;                  // 模型名称 (vidu2.0, gen3-turbo等)
  duration?: number;              // 视频时长(秒)
  aspect_ratio?: string;          // 宽高比
  created_at: number;             // 创建时间戳
  updated_at: number;             // 更新时间戳

  // 辅助字段
  error?: string;                 // 错误信息
  progress?: number;              // 进度 0-100
  extra?: Record<string, any>;    // 服务特有数据,用于扩展功能
  expired?: boolean;              // 链接是否已过期
  expire_reason?: string;         // 过期原因
  expired_at?: number;            // 标记过期时间
}

/**
 * 统一视频Store类
 * 替代所有独立的Store (ViduStore, RunwayStore等)
 */
export class UnifiedVideoStore {
  private localKey = 'unified-video-store';
  private maxTasks = 100; // 所有服务共享,最多保存100个任务

  /**
   * 保存或更新任务
   */
  save(task: UnifiedVideoTask) {
    if (!task.id) throw new Error('Task id is required');

    // 验证created_at的合理性（不能是未来时间，不能太旧）
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const oneHourFuture = now + 60 * 60 * 1000;

    let validatedCreatedAt = task.created_at || now;
    if (validatedCreatedAt > oneHourFuture || validatedCreatedAt < oneYearAgo) {
      console.warn(`⚠️ [VideoStore] Invalid created_at for ${task.service}:${task.id}: ${validatedCreatedAt}, using current time`);
      validatedCreatedAt = now;
    }

    let arr = this.getAll();
    const index = arr.findIndex(v => v.id === task.id);

    if (index > -1) {
      // 更新现有任务 - 保留原始created_at，但验证合理性
      const existing = arr[index];
      const existingCreatedAt = existing.created_at;
      const hasUrlChanged = task.url && task.url !== existing.url;
      const nextExpired = task.expired ?? (hasUrlChanged ? false : existing.expired ?? false);
      const nextExpireReason = nextExpired
        ? task.expire_reason ?? (hasUrlChanged ? undefined : existing.expire_reason)
        : undefined;
      const nextExpiredAt = nextExpired
        ? task.expired_at ?? (hasUrlChanged ? undefined : existing.expired_at)
        : undefined;

      arr[index] = {
        ...existing,
        ...task,
        created_at: existingCreatedAt, // 保留原始创建时间
        updated_at: now,
        expired: nextExpired,
        expire_reason: nextExpireReason,
        expired_at: nextExpiredAt
      };
    } else {
      // 添加新任务
      arr.push({
        ...task,
        created_at: validatedCreatedAt,
        updated_at: now,
        expired: task.expired ?? false,
        expire_reason: task.expire_reason,
        expired_at: task.expired_at
      });
    }

    // 限制数量,按创建时间排序保留最新100个
    arr = arr
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, this.maxTasks);

    ss.set(this.localKey, arr);
    return this;
  }

  /**
   * 获取所有任务 - 按创建时间降序排序（最新的在前）
   */
  getAll(): UnifiedVideoTask[] {
    try {
      const obj = ss.get(this.localKey) as UnifiedVideoTask[] | undefined;
      const tasks = obj ?? [];
      // 确保总是按创建时间降序返回
      return tasks.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.error('Failed to load unified video tasks:', error);
      return [];
    }
  }

  /**
   * 按服务筛选任务
   */
  getByService(service: string): UnifiedVideoTask[] {
    return this.getAll()
      .filter(v => v.service === service)
      .sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * 根据ID获取单个任务
   */
  getById(id: string): UnifiedVideoTask | null {
    return this.getAll().find(v => v.id === id) ?? null;
  }

  /**
   * 删除任务
   */
  delete(id: string): boolean {
    let arr = this.getAll();
    const index = arr.findIndex(v => v.id === id);
    if (index < 0) return false;

    arr.splice(index, 1);
    ss.set(this.localKey, arr);
    return true;
  }

  /**
   * 清理旧任务
   * 保留规则:
   * 1. 最近7天的任务
   * 2. 处理中或待处理的任务(无论时间)
   */
  cleanup() {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let arr = this.getAll().filter(task => {
        // 保留最近7天的任务
        if (task.created_at > sevenDaysAgo) return true;
        // 保留未完成的任务
        if (task.status === 'processing' || task.status === 'pending') return true;
        return false;
      });

      ss.set(this.localKey, arr);
      console.log(`✅ Video cleanup completed: ${arr.length} tasks remaining`);
    } catch (error) {
      console.error('Failed to cleanup video tasks:', error);
    }
  }

  /**
   * 标记指定任务的链接为过期状态
   */
  markExpired(id: string, reason?: string) {
    try {
      const arr = this.getAll();
      const index = arr.findIndex(task => task.id === id);
      if (index === -1)
        return false;

      if (arr[index].expired)
        return false;

      arr[index] = {
        ...arr[index],
        expired: true,
        expire_reason: reason,
        expired_at: Date.now()
      };

      ss.set(this.localKey, arr);
      return true;
    } catch (error) {
      console.error('Failed to mark video task expired:', error);
      return false;
    }
  }

  /**
   * 获取待处理的任务(用于轮询状态)
   */
  getPendingTasks(): UnifiedVideoTask[] {
    return this.getAll().filter(task =>
      task.status === 'processing' || task.status === 'pending'
    );
  }

  /**
   * 批量更新任务状态
   */
  updateTaskState(id: string, updates: Partial<UnifiedVideoTask>) {
    const task = this.getById(id);
    if (task) {
      Object.assign(task, updates, { updated_at: Date.now() });
      this.save(task);
    }
  }

  /**
   * 获取存储统计信息
   */
  getStats() {
    const tasks = this.getAll();
    return {
      total: tasks.length,
      byService: {
        vidu: tasks.filter(t => t.service === 'vidu').length,
        runway: tasks.filter(t => t.service === 'runway').length,
        pika: tasks.filter(t => t.service === 'pika').length,
        kling: tasks.filter(t => t.service === 'kling').length,
        minimax: tasks.filter(t => t.service === 'minimax').length,
        sora2: tasks.filter(t => t.service === 'sora2').length,
      },
      byStatus: {
        success: tasks.filter(t => t.status === 'success').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        pending: tasks.filter(t => t.status === 'pending').length,
      }
    };
  }

  /**
   * 清空所有任务
   */
  clear() {
    ss.remove(this.localKey);
  }
}

// 导出单例实例,方便使用
export const unifiedVideoStore = new UnifiedVideoStore();
