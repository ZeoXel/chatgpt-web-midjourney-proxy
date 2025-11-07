/**
 * 视频任务数据转换适配器
 * 将各服务的原始数据结构转换为统一格式
 */

import { UnifiedVideoTask } from './videoStore';
import type { ViduTask } from './viduStore';
import type { RunwayTask } from './runwayStore';
import type { PikaTask } from './pikaStore';
import type { KlingTask } from './klingStore';
import type { Sora2Task } from './sora2Store';
import type { MinimaxTask } from './minimaxStore';

/**
 * Vidu → Unified
 */
export function convertViduToUnified(task: ViduTask): UnifiedVideoTask {
  return {
    id: task.task_id,
    service: 'vidu',
    url: task.creations?.[0]?.url || '',
    poster: task.creations?.[0]?.cover_url,
    status: mapViduStatus(task.state),
    prompt: task.prompt,
    model: task.model,
    duration: task.duration,
    aspect_ratio: task.aspect_ratio,
    created_at: new Date(task.created_at).getTime(),
    updated_at: task.last_feed || Date.now(),
    error: task.err_code,
    progress: undefined, // Vidu没有进度字段
    extra: {
      originalTask: task,
      resolution: task.resolution,
      movement_amplitude: task.movement_amplitude,
    }
  };
}

function mapViduStatus(state: string): UnifiedVideoTask['status'] {
  if (state === 'success' || state === 'succeeded') return 'success';
  if (state === 'failed') return 'failed';
  if (state === 'processing') return 'processing';
  if (state === 'queueing' || state === 'created') return 'pending';
  return 'pending';
}

/**
 * Runway → Unified
 */
export function convertRunwayToUnified(task: RunwayTask): UnifiedVideoTask {
  const artifact = task.artifacts?.[0];

  return {
    id: task.id,
    service: 'runway',
    url: artifact?.url || '',
    poster: artifact?.previewUrls?.[0],
    status: mapRunwayStatus(task.status),
    prompt: task.options?.text_prompt ||
            task.options?.gen2Options?.text_prompt ||
            task.name,
    model: determineRunwayModel(task),
    duration: task.options?.seconds,
    created_at: new Date(task.createdAt).getTime(),
    updated_at: task.last_feed || new Date(task.updatedAt).getTime(),
    progress: task.progressRatio ? Math.round(parseFloat(task.progressRatio) * 100) : undefined,
    error: task.status === 'FAILED' ? task.progressText : undefined,
    extra: {
      originalTask: task,
      estimatedTimeToStart: task.estimatedTimeToStartSeconds,
      fileSize: artifact?.fileSize,
    }
  };
}

function mapRunwayStatus(status: string): UnifiedVideoTask['status'] {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED') return 'failed';
  if (status === 'RUNNING') return 'processing';
  if (status === 'PENDING' || status === 'THROTTLED') return 'pending';
  return 'pending';
}

function determineRunwayModel(task: RunwayTask): string {
  // 根据taskType或options推断模型
  if (task.taskType === 'gen3') return 'gen3';
  if (task.taskType === 'gen2') return 'gen2';
  if (task.taskType === 'gen3a_turbo') return 'gen3a_turbo';
  if (task.taskType === 'europa') return 'gen3';
  if (task.taskType === 'europa-fast') return 'gen3-fast';
  if (task.taskType === 'aleph') return 'runway-aleph';

  // video2video 任务检测：如果有 video_prompt 或 structure_transformation
  if (task.options?.video_prompt || task.options?.structure_transformation !== undefined) {
    return 'runway-video2video';
  }

  if (task.options?.seconds === 5) return 'runway-aleph';

  if (task.options?.gen2Options) return 'gen2';
  return 'runway-gen3'; // 默认
}

/**
 * Pika → Unified
 */
export function convertPikaToUnified(task: PikaTask): UnifiedVideoTask {
  const video = task.videos?.[0];

  return {
    id: task.id,
    service: 'pika',
    url: video?.resultUrl || '',
    poster: video?.videoPoster || video?.imageThumb,
    status: mapPikaStatus(video?.status || ''),
    prompt: task.promptText,
    model: 'pika',
    duration: video?.duration,
    created_at: Date.now(), // Pika没有创建时间字段
    updated_at: task.last_feed || Date.now(),
    progress: video?.progress,
    error: video?.error,
    extra: {
      originalTask: task,
      seed: video?.seed,
      sharingUrl: video?.sharingUrl,
    }
  };
}

function mapPikaStatus(status: string): UnifiedVideoTask['status'] {
  if (status === 'finished') return 'success';
  if (status === 'error' || status === 'failed') return 'failed';
  if (status === 'processing') return 'processing';
  if (status === 'pending' || status === 'queued') return 'pending';
  return 'pending';
}

/**
 * Kling → Unified
 */
export function convertKlingToUnified(task: KlingTask): UnifiedVideoTask {
  const video = task.data.task_result?.videos?.[0];
  const image = task.data.task_result?.images?.[0];

  // Kling同时支持视频和图片,优先使用视频
  const isVideo = !!video;
  const url = video?.url || image?.url || '';

  // 智能转换时间戳：如果是秒级（<10000000000）则转为毫秒，否则保持原样
  const normalizeTimestamp = (ts: number) => {
    if (!ts) return Date.now();
    // 如果时间戳小于2001年（秒级时间戳），则转为毫秒
    return ts < 10000000000 ? ts * 1000 : ts;
  };

  return {
    id: task.data.task_id,
    service: 'kling',
    url,
    poster: undefined, // Kling没有poster字段
    status: mapKlingStatus(task.data.task_status),
    prompt: task.prompt || '',
    model: 'kling',
    duration: video?.duration ? parseFloat(video.duration) : undefined,
    created_at: normalizeTimestamp(task.data.created_at),
    updated_at: task.last_feed || normalizeTimestamp(task.data.updated_at),
    error: task.data.task_status_msg,
    extra: {
      originalTask: task,
      cat: task.cat,
      isVideo,
      request_id: task.request_id,
    }
  };
}

function mapKlingStatus(status: string): UnifiedVideoTask['status'] {
  if (status === 'succeed') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'processing') return 'processing';
  if (status === 'submitted' || status === 'pending') return 'pending';
  return 'pending';
}

/**
 * MiniMax → Unified
 */
export function convertMinimaxToUnified(task: MinimaxTask): UnifiedVideoTask {
  const result = task.result ?? task.task_result ?? task.data ?? {};

  const selectFirstString = (...values: Array<any>) => {
    for (const value of values) {
      if (typeof value === 'string' && value) return value;
    }
    return '';
  };

  const normalizeTimestamp = (value?: string | number) => {
    if (!value) return Date.now();
    if (typeof value === 'number') return value < 100000000000 ? value * 1000 : value;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed < 100000000000 ? parsed * 1000 : parsed;
    const date = Date.parse(value);
    return Number.isNaN(date) ? Date.now() : date;
  };

  const normalizeProgress = (progress?: number) => {
    if (typeof progress !== 'number') return undefined;
    if (progress > 1) return Math.round(progress);
    if (progress >= 0 && progress <= 1) return Math.round(progress * 100);
    return undefined;
  };

  const status = mapMinimaxStatus(task);
  const fileInfo = task.file ?? task.data?.file ?? result?.file;

  const url = selectFirstString(
    result?.video_url,
    result?.videoUrl,
    result?.video?.url,
    result?.url,
    task.video_url,
    task.data?.video_url,
    task.data?.url,
    task.result_url,
    fileInfo?.download_url,
  );

  const poster = selectFirstString(
    result?.cover_image_url,
    result?.coverUrl,
    result?.cover_image,
    result?.thumbnail_url,
    result?.thumbnail,
    task.cover_image_url,
    task.cover_url,
  );

  const duration = result?.duration ?? task.duration;
  const aspectRatio = result?.aspect_ratio ?? task.resolution ?? task.data?.aspect_ratio;

  const errorMessage = task.error
    ?? (task.base_resp?.status_code && task.base_resp.status_code !== 0 ? task.base_resp.status_msg : undefined);

  const prompt = task.prompt
    ?? task.data?.prompt
    ?? result?.prompt
    ?? '';

  const model = task.model ?? result?.model ?? 'MiniMax-Hailuo-2.3';

  return {
    id: task.task_id,
    service: 'minimax',
    url,
    poster,
    status,
    prompt,
    model,
    duration,
    aspect_ratio: aspectRatio,
    created_at: normalizeTimestamp(task.created_at),
    updated_at: normalizeTimestamp(task.last_feed ?? task.updated_at),
    error: status === 'failed' ? errorMessage : undefined,
    progress: normalizeProgress(task.progress ?? result?.progress),
    extra: {
      originalTask: task,
      base_resp: task.base_resp,
      file_id: fileInfo?.file_id ?? fileInfo?.id,
      filename: fileInfo?.filename,
      download_url: fileInfo?.download_url,
      bytes: fileInfo?.bytes,
    },
  };
}

function mapMinimaxStatus(task: MinimaxTask): UnifiedVideoTask['status'] {
  const status = (task.task_status || task.status || '').toString().toLowerCase();

  if (['success', 'succeed', 'succeeded', 'finished', 'completed'].includes(status)) return 'success';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  if (['processing', 'running', 'in_progress', 'generating'].includes(status)) return 'processing';
  if (['pending', 'created', 'queueing', 'queued', 'waiting'].includes(status)) return 'pending';

  if (task.base_resp?.status_code && task.base_resp.status_code !== 0) return 'failed';

  return 'pending';
}

/**
 * Sora2 → Unified
 */
export function convertSora2ToUnified(task: Sora2Task): UnifiedVideoTask {
  const normalizeTimestamp = (value?: number) => {
    if (!value) return Date.now();
    return value < 10000000000 ? value * 1000 : value;
  };

  const normalizeProgress = (value?: number | string) => {
    if (value === undefined || value === null) return undefined;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return undefined;
    if (numeric > 1) return Math.round(numeric);
    if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100);
    return undefined;
  };

  const videoUrl = task.video_url || task.url || '';

  return {
    id: task.id,
    service: 'sora2',
    url: videoUrl,
    poster: task.thumbnail,
    status: mapSora2Status(task.status),
    prompt: task.prompt,
    model: task.model,
    duration: task.seconds ? parseFloat(task.seconds) : undefined,
    created_at: normalizeTimestamp(task.created_at),
    updated_at: task.last_feed || normalizeTimestamp(task.completed_at ?? task.created_at),
    error: task.error,
    progress: normalizeProgress(task.progress),
    extra: {
      originalTask: task,
      size: task.size,
      watermark: task.watermark,
      video_url: videoUrl,
      completed_at: task.completed_at ? normalizeTimestamp(task.completed_at) : undefined,
    }
  };
}

function mapSora2Status(status: string): UnifiedVideoTask['status'] {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'in_progress') return 'processing';
  if (status === 'queued') return 'pending';
  return 'pending';
}

/**
 * RunwayML → Unified (如果有独立的Store)
 * 注: runwayml可能与runway使用相同数据结构
 */
export function convertRunwayMLToUnified(task: any): UnifiedVideoTask {
  // 如果runwayml数据结构与runway相同,直接复用
  return {
    ...convertRunwayToUnified(task),
    service: 'runwayml' as any,
  };
}

/**
 * 通用转换函数 - 根据服务类型自动选择转换器
 */
export function convertToUnified(
  task: ViduTask | RunwayTask | PikaTask | KlingTask | Sora2Task | MinimaxTask,
  service: 'vidu' | 'runway' | 'pika' | 'kling' | 'runwayml' | 'sora2' | 'minimax'
): UnifiedVideoTask {
  switch (service) {
    case 'vidu':
      return convertViduToUnified(task as ViduTask);
    case 'runway':
      return convertRunwayToUnified(task as RunwayTask);
    case 'pika':
      return convertPikaToUnified(task as PikaTask);
    case 'kling':
      return convertKlingToUnified(task as KlingTask);
    case 'sora2':
      return convertSora2ToUnified(task as Sora2Task);
    case 'minimax':
      return convertMinimaxToUnified(task as MinimaxTask);
    case 'runwayml':
      return convertRunwayMLToUnified(task);
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}
