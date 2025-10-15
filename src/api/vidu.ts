import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { ViduTask, viduStore } from "./viduStore";
import { sleep } from "./suno";

// 获取认证头部 - NewAPI网关版本
function getHeaderAuthorization() {
  let headers = {};

  // 优先使用vtoken
  if (homeStore.myData.vtoken) {
    const vtokenh = { 'x-vtoken': homeStore.myData.vtoken, 'x-ctoken': homeStore.myData.ctoken };
    headers = {...headers, ...vtokenh};
  }

  // NewAPI网关：使用核心OPENAI_API_KEY，不需要专用VIDU_KEY
  if (gptServerStore.myData.OPENAI_API_KEY) {
    const bmi = {
      'Authorization': 'Bearer ' + gptServerStore.myData.OPENAI_API_KEY
    };
    headers = {...headers, ...bmi};
  } else {
    // 备用认证
    const authStore = useAuthStore();
    if (authStore.token) {
      const bmi = { 'x-ptoken': authStore.token };
      headers = {...headers, ...bmi};
    }
  }

  return headers;
}

// 获取API URL - NewAPI网关版本，参考openapi.ts的实现
const getUrl = (url: string) => {
  if (url.indexOf('http') === 0) return url;

  const pro_prefix = url.indexOf('/pro') > -1 ? '/pro' : '';
  url = url.replaceAll('/pro', '');

  // 使用用户配置的OPENAI_API_BASE_URL，就像其他API一样
  if (gptServerStore.myData.OPENAI_API_BASE_URL) {
    return `${gptServerStore.myData.OPENAI_API_BASE_URL}/v1/video/generations${url}`;
  }

  // 开发环境和生产环境都使用后端代理
  return `${pro_prefix}/v1/video/generations${url}`;
}

// 通用的API请求封装
export const viduFetch = (url: string, data?: any, opt2?: any) => {
  mlog('viduFetch', url);
  mlog('viduFetch data:', JSON.stringify(data, null, 2)); // 打印请求数据
  let headers = {'Content-Type': 'application/json'};
  if (opt2 && opt2.headers) headers = opt2.headers;

  headers = {...headers, ...getHeaderAuthorization()};
  mlog('viduFetch headers:', headers); // 打印请求头

  const requestOptions = {
    method: data ? 'POST' : 'GET',
    headers,
    ...(data && { body: JSON.stringify(data) })
  };

  const finalUrl = getUrl(url);
  mlog('viduFetch final URL:', finalUrl); // 打印最终URL

  return fetch(finalUrl, requestOptions)
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

// 生成视频 - 适配NewAPI网关
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
  mode?: 'img2video' | 'firstTail' | 'reference';
}) => {
  try {
    mlog('viduGenerate', params);

    // 构建请求体 - 同时支持NewAPI网关和Vidu官方API格式
    const aspectRatioToSize = {
      '16:9': '1920x1080',
      '9:16': '1080x1920',
      '1:1': '1080x1080'
    };

    const requestData: any = {
      model: params.model,
      prompt: params.prompt,
      size: aspectRatioToSize[params.aspect_ratio || '16:9'] || '1920x1080', // NewAPI网关格式
      aspect_ratio: params.aspect_ratio || '16:9', // Vidu官方API格式
      duration: params.duration || 5,
      metadata: {
        duration: params.duration || 5,
        seed: params.seed || 0,
        resolution: params.resolution || '1080p',
        movement_amplitude: params.movement_amplitude || 'auto',
        bgm: params.bgm || false,
        payload: params.payload || '',
        callback_url: ''
      }
    };

    // 根据模式处理图片参数和模式选择
    if (params.mode === 'img2video' && params.images.length === 1) {
      // 图生视频：使用image字段（单数）
      requestData.image = params.images[0];
      requestData.mode = 'img2video';
    } else if (params.mode === 'firstTail' && params.images.length === 2) {
      // 首尾生视频：使用images数组，需要恰好2张图片
      requestData.images = params.images;
      requestData.mode = 'firstTail';
    } else if (params.mode === 'reference' && params.images.length >= 1) {
      // 参考生视频：使用images数组，支持1-7张图片
      requestData.images = params.images;
      requestData.mode = 'reference';
    } else if (params.mode === 'auto') {
      // 自动模式：根据图片数量自动判断
      if (params.images.length === 1) {
        requestData.image = params.images[0];
        requestData.mode = 'img2video';
      } else if (params.images.length === 2) {
        requestData.images = params.images;
        requestData.mode = 'firstTail';
      } else if (params.images.length >= 3) {
        requestData.images = params.images;
        requestData.mode = 'reference';
      }
      // 无图片的情况下进行文生视频（不设置mode）
    } else if (params.images.length > 0) {
      // 其他情况：有图片但模式不明确
      requestData.images = params.images;
      if (params.mode) requestData.mode = params.mode;
    }

    const response = await viduFetch('', requestData); // NewAPI: /v1/video/generations
    
    if (response && response.task_id) {
      // 保存到本地存储（不包含大量的base64图片数据）
      const task: ViduTask = {
        task_id: response.task_id,
        state: response.state || 'created',
        model: params.model,
        prompt: params.prompt,
        images: params.images.map((img, index) => 
          img.startsWith('data:') ? `[uploaded-image-${index}]` : img
        ), // 避免存储base64数据
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

// 查询任务状态 - 适配NewAPI网关
export const viduGetTask = async (task_id: string): Promise<ViduTask | null> => {
  try {
    mlog('viduGetTask', task_id);
    const response = await viduFetch(`/${task_id}`);

    if (response && response.data) {
      const task = viduStore.getObj(task_id);
      const responseData = response.data; // 实际数据在response.data中
      const taskData = responseData.data; // 任务详情在response.data.data中

      if (task) {
        // 更新任务状态 - 适配NewAPI网关响应格式
        let state = 'processing';
        if (responseData.status === 'SUCCESS' && taskData.state === 'success') {
          state = 'success';
        } else if (responseData.status === 'FAILED' || taskData.state === 'failed') {
          state = 'failed';
        }

        // 处理creations数组，修复S3链接
        const fixedCreations = (taskData.creations || []).map((creation: any) => ({
          ...creation,
          url: fixS3Url(creation.url),
          cover_url: fixS3Url(creation.cover_url)
        }));

        const updatedTask = {
          ...task,
          state,
          err_code: taskData.err_code,
          credits: taskData.credits,
          creations: fixedCreations,
          last_feed: Date.now(),
          url: fixedCreations[0]?.url // 保存第一个视频URL
        };

        viduStore.save(updatedTask);
        return updatedTask;
      } else {
        // 如果本地没有任务记录，从API响应创建一个基本的任务对象
        let state = 'processing';
        if (responseData.status === 'SUCCESS' && taskData.state === 'success') {
          state = 'success';
        } else if (responseData.status === 'FAILED' || taskData.state === 'failed') {
          state = 'failed';
        }

        // 处理creations数组，修复S3链接
        const fixedCreations = (taskData.creations || []).map((creation: any) => ({
          ...creation,
          url: fixS3Url(creation.url),
          cover_url: fixS3Url(creation.cover_url)
        }));

        const newTask: ViduTask = {
          task_id: taskData.id || task_id,
          state,
          model: 'viduq1', // 默认模型，因为查询API不返回这些信息
          prompt: '未知提示词',
          images: [],
          duration: 5,
          aspect_ratio: '16:9',
          resolution: '1080p',
          movement_amplitude: 'auto',
          bgm: false,
          off_peak: false,
          credits: taskData.credits,
          created_at: new Date().toISOString(),
          err_code: taskData.err_code,
          creations: fixedCreations,
          last_feed: Date.now(),
          url: fixedCreations[0]?.url // 保存第一个视频URL
        };

        viduStore.save(newTask);
        return newTask;
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
    await viduFetch(`/${task_id}/cancel`, { id: task_id });

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

// 修复S3链接访问问题 - 简单直接的方案
const fixS3Url = (url: string): string => {
  if (!url) return url;
  
  // 检查是否是vidu的S3链接，存在访问问题
  if (url.includes('prod-ss-vidu.s3.cn-northwest-1.amazonaws.com.cn')) {
    // 记录原始链接以便调试
    console.log('🔗 检测到S3链接:', url);
    
    // 最简单的方案：确保使用HTTPS协议
    let fixedUrl = url;
    if (!fixedUrl.startsWith('https://')) {
      fixedUrl = 'https://' + fixedUrl.replace(/^https?:\/\//, '');
    }
    
    console.log('🔧 修复后链接:', fixedUrl);
    return fixedUrl;
  }
  
  return url;
};

// 获取错误信息
export const getViduErrorMessage = (err_code?: string): string => {
  if (!err_code) return '未知错误';
  return VIDU_ERROR_MESSAGES[err_code as keyof typeof VIDU_ERROR_MESSAGES] || err_code;
};

// 长轮询单个任务状态 - 类似FeedLumaTask
export const viduFeed = async (task_id: string): Promise<void> => {
  if (!task_id) return;
  
  mlog('viduFeed started for task:', task_id);
  
  for (let i = 0; i < 120; i++) { // 最多轮询120次 (10分钟)
    try {
      const updatedTask = await viduGetTask(task_id);
      
      if (updatedTask) {
        // 更新最后获取时间
        updatedTask.last_feed = Date.now();
        viduStore.save(updatedTask);
        
        // 通知UI更新
        homeStore.setMyData({ act: 'ViduFeed' });
        
        // 如果任务已完成（成功或失败），停止轮询
        if (updatedTask.state === 'success' || updatedTask.state === 'failed') {
          mlog('viduFeed completed for task:', task_id, 'final state:', updatedTask.state);
          break;
        }
      }
      
      // 等待5秒后再次查询
      await sleep(5000);
      
    } catch (error) {
      mlog('viduFeed error:', error);
      // 遇到错误时仍继续尝试，除非是致命错误
      await sleep(5000);
    }
  }
  
  mlog('viduFeed ended for task:', task_id);
};