/**
 * 视频轮询恢复模块
 * 页面刷新后自动恢复 pending/processing 状态任务的轮询
 */

import { UnifiedVideoStore, type UnifiedVideoTask } from '@/api/videoStore';

// 防止重复轮询的标记
const pollingTasks = new Set<string>();

/**
 * 恢复单个任务的轮询
 */
async function resumeTaskPolling(task: UnifiedVideoTask): Promise<void> {
  // 防止重复轮询
  if (pollingTasks.has(task.id)) {
    console.log(`[PollResume] ⏭️ 跳过已在轮询的任务: ${task.service}:${task.id}`);
    return;
  }

  pollingTasks.add(task.id);
  console.log(`[PollResume] 🔄 恢复轮询: ${task.service}:${task.id}`);

  try {
    switch (task.service) {
      case 'vidu': {
        const { viduFeed } = await import('@/api/vidu');
        await viduFeed(task.id);
        break;
      }

      case 'runway': {
        const { runwayFeed } = await import('@/api/runway');
        await runwayFeed(task.id);
        break;
      }

      case 'pika': {
        const { pikaFeed } = await import('@/api/pika');
        await pikaFeed(task.id);
        break;
      }

      case 'kling': {
        const { klingFeed } = await import('@/api/kling');
        // kling 需要 cat 和 prompt 参数，从 extra 中获取
        const cat = task.extra?.cat || 'text2video';
        await klingFeed(task.id, cat, task.prompt);
        break;
      }

      case 'luma': {
        const { FeedLumaTask } = await import('@/api/luma');
        await FeedLumaTask(task.id);
        break;
      }

      case 'sora2': {
        const { sora2Feed } = await import('@/api/sora2');
        await sora2Feed(task.id);
        break;
      }

      case 'minimax': {
        const { minimaxFeed } = await import('@/api/minimax');
        await minimaxFeed(task.id, task.prompt);
        break;
      }

      case 'runwayml': {
        const { runwayMlFeedById } = await import('@/api/runwayml');
        await runwayMlFeedById(task.id);
        break;
      }

      default:
        console.warn(`[PollResume] ⚠️ 未知的视频服务: ${task.service}`);
    }
  } catch (error) {
    console.error(`[PollResume] ❌ 恢复轮询失败: ${task.service}:${task.id}`, error);
  } finally {
    pollingTasks.delete(task.id);
  }
}

/**
 * 恢复所有 pending/processing 任务的轮询
 * @param maxConcurrent 最大并发数，避免同时发起太多请求
 * @param maxAge 最大任务年龄（毫秒），超过此时间的任务不再恢复
 */
export async function resumeAllPendingPolls(
  maxConcurrent: number = 3,
  maxAge: number = 30 * 60 * 1000 // 默认30分钟
): Promise<{ resumed: number; skipped: number }> {
  const store = new UnifiedVideoStore();
  const pendingTasks = store.getPendingTasks();

  if (pendingTasks.length === 0) {
    console.log('[PollResume] ✅ 没有需要恢复的任务');
    return { resumed: 0, skipped: 0 };
  }

  console.log(`[PollResume] 🔍 发现 ${pendingTasks.length} 个待处理任务`);

  const now = Date.now();
  let resumed = 0;
  let skipped = 0;

  // 过滤出需要恢复的任务（未超时的）
  const tasksToResume = pendingTasks.filter(task => {
    const age = now - task.created_at;
    if (age > maxAge) {
      console.log(`[PollResume] ⏭️ 跳过超时任务: ${task.service}:${task.id} (${Math.round(age / 60000)}分钟前)`);
      skipped++;
      return false;
    }
    return true;
  });

  if (tasksToResume.length === 0) {
    console.log('[PollResume] ✅ 所有任务已超时，无需恢复');
    return { resumed: 0, skipped };
  }

  console.log(`[PollResume] 🚀 开始恢复 ${tasksToResume.length} 个任务 (并发: ${maxConcurrent})`);

  // 分批并发执行
  for (let i = 0; i < tasksToResume.length; i += maxConcurrent) {
    const batch = tasksToResume.slice(i, i + maxConcurrent);

    // 并发执行当前批次，但不等待完成
    batch.forEach(task => {
      resumeTaskPolling(task);
      resumed++;
    });

    // 批次之间间隔1秒，避免请求过于密集
    if (i + maxConcurrent < tasksToResume.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[PollResume] ✅ 已启动 ${resumed} 个任务的轮询恢复`);
  return { resumed, skipped };
}

/**
 * 检查是否有正在轮询的任务
 */
export function hasActivePolling(): boolean {
  return pollingTasks.size > 0;
}

/**
 * 获取当前正在轮询的任务数
 */
export function getActivePollingCount(): number {
  return pollingTasks.size;
}
