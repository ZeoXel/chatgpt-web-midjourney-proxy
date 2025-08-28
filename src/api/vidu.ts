import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { ViduTask, viduStore } from "./viduStore";
import { sleep } from "./suno";

// 获取认证头部
function getHeaderAuthorization() {
  let headers = {};
  
  // Token处理逻辑
  if (homeStore.myData.vtoken) {
    const vtokenh = { 
      'x-vtoken': homeStore.myData.vtoken, 
      'x-ctoken': homeStore.myData.ctoken 
    };
    headers = {...headers, ...vtokenh};
  }
  
  if (!gptServerStore.myData.VIDU_KEY) {
    const authStore = useAuthStore();
    if (authStore.token) {
      const bmi = { 'x-ptoken': authStore.token };
      headers = {...headers, ...bmi};
      return headers;
    }
    return headers;
  }
  
  const bmi = {
    'Authorization': 'Token ' + gptServerStore.myData.VIDU_KEY
  };
  headers = {...headers, ...bmi};
  return headers;
}

// 获取API URL
const getUrl = (url: string) => {
  if (url.indexOf('http') === 0) return url;
  
  const pro_prefix = url.indexOf('/pro') > -1 ? '/pro' : '';
  url = url.replaceAll('/pro', '');
  
  // 在开发环境中始终使用本地代理
  if (import.meta.env.DEV) {
    return `${pro_prefix}/vidu${url}`;
  }
  
  if (gptServerStore.myData.VIDU_SERVER) {
    if (gptServerStore.myData.VIDU_SERVER.indexOf('/pro') > 0) {
      return `${gptServerStore.myData.VIDU_SERVER}/vidu${url}`;
    }
    return `${gptServerStore.myData.VIDU_SERVER}${pro_prefix}/vidu${url}`;
  }
  return `${pro_prefix}/vidu${url}`;
}

// 通用的API请求封装
export const viduFetch = (url: string, data?: any, opt2?: any) => {
  mlog('viduFetch', url);
  let headers = {'Content-Type': 'application/json'};
  if (opt2 && opt2.headers) headers = opt2.headers;
  
  headers = {...headers, ...getHeaderAuthorization()};
  
  const requestOptions = {
    method: data ? 'POST' : 'GET',
    headers,
    ...(data && { body: JSON.stringify(data) })
  };
  
  return fetch(getUrl(url), requestOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .catch(error => {
      mlog('viduFetch error', error);
      throw error;
    });
};

// 生成视频（参考生视频）
export const viduGenerate = async (params: {
  model: 'viduq1' | 'vidu2.0' | 'vidu1.5';
  images: string[];
  prompt: string;
  duration?: number;
  seed?: number;
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  resolution?: string;
  movement_amplitude?: 'auto' | 'small' | 'medium' | 'large';
  bgm?: boolean;
  off_peak?: boolean;
  payload?: string;
}) => {
  try {
    mlog('viduGenerate', params);
    const response = await viduFetch('/tasks', params);
    
    if (response && response.task_id) {
      // 保存到本地存储
      const task: ViduTask = {
        task_id: response.task_id,
        state: response.state || 'created',
        model: params.model,
        prompt: params.prompt,
        images: params.images,
        duration: response.duration || params.duration,
        seed: response.seed,
        aspect_ratio: response.aspect_ratio || params.aspect_ratio || '16:9',
        resolution: response.resolution || params.resolution,
        movement_amplitude: response.movement_amplitude || params.movement_amplitude || 'auto',
        bgm: response.bgm || params.bgm || false,
        off_peak: response.off_peak || params.off_peak || false,
        credits: response.credits,
        created_at: response.created_at || new Date().toISOString(),
        payload: response.payload || params.payload
      };
      
      viduStore.save(task);
      return task;
    }
    
    throw new Error('Invalid response from Vidu API');
  } catch (error) {
    mlog('viduGenerate error', error);
    throw error;
  }
};

// 查询任务状态
export const viduGetTask = async (task_id: string): Promise<ViduTask | null> => {
  try {
    mlog('viduGetTask', task_id);
    const response = await viduFetch(`/tasks/${task_id}/creations`);
    
    if (response) {
      const task = viduStore.getObj(task_id);
      if (task) {
        // 更新任务状态
        const updatedTask = {
          ...task,
          state: response.state,
          err_code: response.err_code,
          credits: response.credits,
          creations: response.creations || [],
          last_feed: Date.now()
        };
        
        viduStore.save(updatedTask);
        return updatedTask;
      }
    }
    
    return null;
  } catch (error) {
    mlog('viduGetTask error', error);
    return null;
  }
};

// 取消任务
export const viduCancelTask = async (task_id: string): Promise<boolean> => {
  try {
    mlog('viduCancelTask', task_id);
    await viduFetch(`/tasks/${task_id}/cancel`, { id: task_id });
    
    // 更新本地状态
    viduStore.updateTaskState(task_id, { state: 'failed', err_code: 'UserCancelled' });
    return true;
  } catch (error) {
    mlog('viduCancelTask error', error);
    return false;
  }
};

// 轮询待处理任务状态
export const pollPendingTasks = async (): Promise<void> => {
  const pendingTasks = viduStore.getPendingTasks();
  
  for (const task of pendingTasks) {
    try {
      await viduGetTask(task.task_id);
      // 添加延迟避免过于频繁的请求
      await sleep(1000);
    } catch (error) {
      mlog('pollPendingTasks error', error);
    }
  }
};

// 错误码映射
export const VIDU_ERROR_MESSAGES = {
  'BadRequest': '不合法的请求',
  'FieldLacking': '缺少必需字段',
  'FieldUnwanted': '包含不需要的字段',
  'FieldItemCountOutOfRange': '字段超出限制',
  'PageSizeOutOfRange': '图像尺寸有问题',
  'ImageDownloadFailure': '图片下载失败，请检查图片链接',
  'TaskPromptPolicyViolation': 'Prompt 触发内容审核',
  'ImageFormatInvalid': '图像格式不符合要求',
  'AuditSubmitIllegal': '输入没有通过安全审核',
  'CreditInsufficient': '积分不足',
  'CreationPolicyViolation': '生成物触发风控',
  'ModelUnavailable': '请求的模型不可用',
  'UserCancelled': '用户手动终止任务',
  'FieldInvalid': '传入参数未通过合法性校验',
  'ImageCheckBodyJointsFailed': '人体检测失败，请重新上传',
  'ImageCheckFaceFailed': '人脸检测失败，请重新上传',
  'ImageObjectsUndetected': '人体或人脸有遮挡，请重新上传',
  'Unauthorized': '未认证',
  'Forbidden': '请求没有权限',
  'TaskNotFound': '任务ID没找到',
  'CreationNotFound': '生成物ID没找到',
  'NotFound': '请求资源不存在',
  'Conflict': '资源主键冲突',
  'QuotaExceeded': '超过并发限制',
  'TooManyRequests': '请求太频繁',
  'SystemThrottling': '资源超过限制',
  'Canceled': '请求被取消',
  'InternalServiceFailure': '服务器内部错误，请稍后重试'
};

// 获取错误信息
export const getViduErrorMessage = (err_code?: string): string => {
  if (!err_code) return '未知错误';
  return VIDU_ERROR_MESSAGES[err_code as keyof typeof VIDU_ERROR_MESSAGES] || err_code;
};