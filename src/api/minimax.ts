import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { minimaxStore } from "./minimaxStore";
import type { MinimaxTask } from "./minimaxStore";
import { sleep } from "./suno";
import { UnifiedVideoStore } from "./videoStore";
import type { UnifiedVideoTask } from "./videoStore";
import { convertMinimaxToUnified } from "./videoAdapter";
import { saveVideoToCOS } from "./videoStorage";

function getHeaderAuthorization() {
  let headers: Record<string, string> = {};

  if (homeStore.myData.vtoken) {
    headers = {
      ...headers,
      'x-vtoken': homeStore.myData.vtoken,
      'x-ctoken': homeStore.myData.ctoken,
    };
  }

  if (gptServerStore.myData.MINIMAX_KEY) {
    headers = {
      ...headers,
      Authorization: `Bearer ${gptServerStore.myData.MINIMAX_KEY}`,
    };
    return headers;
  }

  if (gptServerStore.myData.OPENAI_API_KEY) {
    headers = {
      ...headers,
      Authorization: `Bearer ${gptServerStore.myData.OPENAI_API_KEY}`,
    };
    return headers;
  }

  const authStore = useAuthStore();
  if (authStore.token) {
    headers = {
      ...headers,
      'x-ptoken': authStore.token,
    };
  }

  return headers;
}

const getUrl = (url: string) => {
  if (url.startsWith('http')) return url;

  const proPrefix = url.includes('/pro') ? '/pro' : '';
  const cleanUrl = url.replaceAll('/pro', '');

  if (gptServerStore.myData.MINIMAX_SERVER) {
    return `${gptServerStore.myData.MINIMAX_SERVER}${proPrefix}/minimax${cleanUrl}`;
  }

  if (gptServerStore.myData.OPENAI_API_BASE_URL) {
    return `${gptServerStore.myData.OPENAI_API_BASE_URL}${proPrefix}/minimax${cleanUrl}`;
  }

  return `${proPrefix}/minimax${cleanUrl}`;
};

interface FetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  silent?: boolean;
  upFile?: boolean;
}

export const minimaxFetch = async (url: string, data?: any, options?: FetchOptions) => {
  const silent = options?.silent ?? false;
  let headers = options?.upFile ? {} : { 'Content-Type': 'application/json' };

  if (options?.headers)
    headers = options.headers;

  headers = { ...headers, ...getHeaderAuthorization() };

  const requestInit: RequestInit = {
    method: options?.method ?? (data ? 'POST' : 'GET'),
    headers,
  };

  if (data && !options?.upFile)
    requestInit.body = JSON.stringify(data);

  try {
    const finalUrl = getUrl(url);
    mlog('[MiniMax] Fetch:', finalUrl);
    if (data)
      mlog('[MiniMax] Payload:', JSON.stringify(data, null, 2));

    const response = await fetch(finalUrl, requestInit);

    if (!response.ok) {
      let message = `发生错误: ${response.status}`;
      try {
        const errJson = await response.json();
        message = errJson?.error?.message
          || errJson?.message
          || errJson?.base_resp?.status_msg
          || message;
      }
      catch (err) {
        // ignore json parse error
      }

      if (!silent)
        homeStore.myData.ms && homeStore.myData.ms.error(message);

      throw new Error(message);
    }

    const result = await response.json();
    return result;
  }
  catch (error: any) {
    if (!silent) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch')
        homeStore.myData.ms && homeStore.myData.ms.error('网络异常，无法连接到MiniMax服务');
      else
        homeStore.myData.ms && homeStore.myData.ms.error(error.message || '请求失败');
    }

    throw error;
  }
};

function normalizeTaskResponse(task_id: string, payload: any): MinimaxTask {
  const data = payload?.data ?? payload;
  const result = data?.result ?? data?.task_result ?? payload?.result ?? payload?.task_result;
  const file = payload?.file ?? data?.file;

  const task: MinimaxTask = {
    ...payload,
    ...data,
    task_id: data?.task_id ?? payload?.task_id ?? task_id,
    status: data?.status ?? payload?.status,
    task_status: data?.task_status ?? payload?.task_status ?? data?.status ?? payload?.status,
    prompt: data?.prompt ?? payload?.prompt,
    model: data?.model ?? payload?.model,
    duration: data?.duration ?? payload?.duration ?? result?.duration,
    resolution: data?.resolution ?? payload?.resolution ?? result?.resolution,
    base_resp: data?.base_resp ?? payload?.base_resp,
    result: result ?? payload?.result,
    task_result: data?.task_result ?? payload?.task_result ?? result,
    data: data?.data ?? payload?.data,
    progress: data?.progress ?? payload?.progress,
    file,
    created_at: data?.created_at ?? payload?.created_at ?? Date.now(),
    updated_at: data?.updated_at ?? payload?.updated_at ?? Date.now(),
  };

  return task;
}

export const minimaxGenerate = async (params: {
  model: string;
  prompt: string;
  duration?: number;
  resolution?: '768P' | '1080P';
  first_frame_image?: string;
  prompt_optimizer?: boolean;
  mode?: string;
  last_frame_image?: string;
  frame_images?: string[];
}) => {
  const requestBody: Record<string, any> = {
    model: params.model,
    prompt: params.prompt,
    duration: params.duration,
    resolution: params.resolution,
  };

  if (params.prompt_optimizer !== undefined)
    requestBody.prompt_optimizer = params.prompt_optimizer
  if (params.mode === 'first_tail') {
    requestBody.mode = 'first_tail'
    const frames = params.frame_images?.length
      ? params.frame_images
      : [params.first_frame_image, params.last_frame_image].filter((img): img is string => !!img)
    if (!frames || frames.length < 2)
      throw new Error('首尾帧模式至少需要提供首尾两张图片')
    requestBody.frame_images = frames
    requestBody.first_frame_image = frames[0]
    requestBody.last_frame_image = frames[frames.length - 1]
  }
  else if (params.first_frame_image) {
    requestBody.first_frame_image = params.first_frame_image
  }

  const response = await minimaxFetch('/v1/video_generation', requestBody);

  const taskId = response?.task_id ?? response?.data?.task_id;
  if (!taskId)
    throw new Error('MiniMax未返回任务ID');

  const task: MinimaxTask = {
    task_id: taskId,
    status: 'pending',
    prompt: params.prompt,
    model: params.model,
    duration: params.duration,
    resolution: params.resolution,
    first_frame_image: params.first_frame_image,
    last_frame_image: params.last_frame_image,
    frame_images: params.frame_images ?? (params.mode === 'first_tail'
      ? [params.first_frame_image, params.last_frame_image].filter((img): img is string => !!img)
      : undefined),
    mode: params.mode,
    base_resp: response?.base_resp,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  minimaxStore.save(task);

  const unifiedStore = new UnifiedVideoStore();
  const unifiedTask = convertMinimaxToUnified(task);
  unifiedStore.save(unifiedTask);

  homeStore.setMyData({ act: 'MiniMaxFeed' });

  return task;
};

export const minimaxGetTask = async (task_id: string, options?: { silent?: boolean }) => {
  try {
    const response = await minimaxFetch(`/v1/query/video_generation?task_id=${task_id}`, undefined, {
      method: 'GET',
      silent: options?.silent ?? false,
    });
    return normalizeTaskResponse(task_id, response);
  }
  catch (error) {
    try {
      const response = await minimaxFetch(`/v1/video_generation/${task_id}`, undefined, {
        method: 'GET',
        silent: options?.silent ?? false,
      });
      return normalizeTaskResponse(task_id, response);
    }
    catch (err) {
      const fallbackResponse = await minimaxFetch(`/v1/video_generation?task_id=${task_id}`, undefined, {
        method: 'GET',
        silent: options?.silent ?? false,
      });
      return normalizeTaskResponse(task_id, fallbackResponse);
    }
  }
};

export const minimaxFeed = async (task_id: string, prompt?: string) => {
  const unifiedStore = new UnifiedVideoStore();

  const existingTask = unifiedStore.getById(task_id);
  if (!existingTask) {
    const pending: UnifiedVideoTask = {
      id: task_id,
      service: 'minimax',
      url: '',
      status: 'pending',
      prompt: prompt || 'MiniMax Video Task',
      model: 'MiniMax-Hailuo-2.3',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    unifiedStore.save(pending);
    homeStore.setMyData({ act: 'MiniMaxFeed' });
  }

  for (let i = 0; i < 200; i++) {
    try {
      const task = await minimaxGetTask(task_id, { silent: i !== 0 });
      task.last_feed = Date.now();
      if (prompt && !task.prompt)
        task.prompt = prompt;

      minimaxStore.save(task);

      const unifiedTask = convertMinimaxToUnified(task);
      unifiedStore.save(unifiedTask);

      homeStore.setMyData({ act: 'MiniMaxFeed' });

      // 视频生成成功时,下载到COS并保存JSON记录
      const status = (task.task_status || task.status || '').toLowerCase();
      if (['succeed', 'succeeded', 'success', 'finished', 'completed'].includes(status) && task.file_url) {
        console.log('[MiniMax Video Save] 视频生成成功,开始下载到COS:', task.file_url);

        // 异步保存到COS (不阻塞用户体验)
        saveVideoToCOS({
          id: task.task_id,
          service: 'minimax',
          model: 'MiniMax-Hailuo-2.3',
          prompt: task.prompt || '',
          original_url: task.file_url,
          duration: task.duration,
          status: 'success',
          created_at: task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString(),
          metadata: {
            file_id: task.file_id,
          }
        }).then(() => {
          console.log('[MiniMax Video Save] ✅ 视频已下载到COS并保存JSON记录');
        }).catch(err => {
          console.warn('[MiniMax Video Save] ⚠️ 保存失败（不影响用户体验）:', err);
        });
      }

      if (['succeed', 'succeeded', 'success', 'finished', 'completed'].includes(status))
        break;

      if (['failed', 'error', 'canceled', 'cancelled'].includes(status))
        break;
    }
    catch (error) {
      mlog('[MiniMax] feed error:', error);
    }

    await sleep(5200);
  }
};
