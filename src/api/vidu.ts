import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { ViduTask, viduStore } from "./viduStore";
import { sleep } from "./suno";

/**
 * Vidu V2 API 接口类型定义
 */
export interface ViduV2Request {
    model: string;
    images: string[];
    prompt: string;
    duration?: number;
    seed?: string;
    aspect_ratio?: string;
    resolution?: string;
    movement_amplitude?: string;
}

export interface ViduV2Response {
    id: string;
    type: string;
    state: string;
    model: string;
    style: string;
    moderation: boolean;
    input: {
        creation_id: string;
        prompts: Array<{
            type: string;
            content: string;
            negative: boolean;
        }>;
        seed: number;
        enhance: boolean;
        multi_image_boost: boolean;
    };
    output_params: {
        sample_count: number;
        duration: number;
        aspect_ratio: string;
        resolution: string;
        movement_amplitude: string;
    };
    err_code: string;
    creations_count: number;
    model_version: string;
    created_at: string;
    video?: {
        download_url?: string;
        thumbnail_url?: string;
    };
}

/**
 * 获取认证头部信息
 * 支持多种认证方式：vtoken、API密钥、用户token
 */
function getHeaderAuthorization() {
    let headers = {}
    
    // VToken 认证（如果可用）
    if (homeStore.myData.vtoken) {
        const vtokenh = { 
            'x-vtoken': homeStore.myData.vtoken, 
            'x-ctoken': homeStore.myData.ctoken
        };
        headers = {...headers, ...vtokenh}
    }
    
    // API 密钥认证
    if (!gptServerStore.myData.VIDU_KEY) {
        const authStore = useAuthStore()
        if (authStore.token) {
            const bmi = { 'x-ptoken': authStore.token };
            headers = {...headers, ...bmi }
            return headers;
        }
        return headers
    }
    
    // Bearer Token 认证
    const bmi = {
        'Authorization': 'Bearer ' + gptServerStore.myData.VIDU_KEY
    }
    headers = {...headers, ...bmi }
    return headers
}

/**
 * 获取完整的 API URL
 * 支持自定义服务器和 Pro 版本
 */
const getUrl = (url: string) => {
    if (url.indexOf('http') == 0) return url;
    
    // Pro 前缀处理
    const pro_prefix = url.indexOf('/pro') > -1 ? '/pro' : '';
    url = url.replaceAll('/pro', '')
    
    if (gptServerStore.myData.VIDU_SERVER) {
        if (gptServerStore.myData.VIDU_SERVER.indexOf('/pro') > 0) {
            return `${gptServerStore.myData.VIDU_SERVER}/vidu${url}`;
        }
        return `${gptServerStore.myData.VIDU_SERVER}${pro_prefix}/vidu${url}`;
    }
    return `${pro_prefix}/vidu${url}`;
}

/**
 * 统一的 Vidu API 请求方法
 * 支持 GET、POST 请求和文件上传
 */
export const viduFetch = (url: string, data?: any, opt2?: any) => {
    mlog('viduFetch', url);
    let headers = opt2?.upFile ? {} : {'Content-Type': 'application/json'}
    
    if (opt2 && opt2.headers) headers = opt2.headers;
    headers = {...headers, ...getHeaderAuthorization()}
   
    return new Promise<any>((resolve, reject) => {
        let opt: RequestInit = {method: 'GET'};
        opt.headers = headers;
        
        if (opt2?.upFile) {
            opt.method = 'POST';
            opt.body = data as FormData;
        } else if (data) {
            opt.body = JSON.stringify(data);
            opt.method = 'POST';
        }
        
        fetch(getUrl(url), opt)
        .then(async (d) => {
            if (!d.ok) { 
                let msg = '发生错误: ' + d.status
                try { 
                    let bjson: any = await d.json();
                    msg = '(' + d.status + ')发生错误: ' + (bjson?.error?.message ?? '')
                } catch (e) { 
                }
                homeStore.myData.ms && homeStore.myData.ms.error(msg)
                throw new Error(msg);
            }
     
            d.json().then(d => resolve(d)).catch(e => { 
                homeStore.myData.ms && homeStore.myData.ms.error('发生错误' + e)
                reject(e) 
            })
        })
        .catch(e => { 
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                homeStore.myData.ms && homeStore.myData.ms.error('跨域|CORS error')
            } else {
                homeStore.myData.ms && homeStore.myData.ms.error('发生错误:' + e)
            }
            mlog('e', e.stat)
            reject(e)
        })
    })
}

/**
 * 轮询 Vidu 任务状态
 * 持续检查任务完成情况，最多轮询120次
 */
export const FeedViduTask = async (id: string) => {
    if (id == '') return '';
    
    const viduS = new viduStore();
    
    for (let i = 0; i < 120; i++) {
        let url = '/ent/v2/generations/' + id;
        
        try {
            let d: ViduV2Response = await viduFetch(url);
            if (d.id) {
                // 转换为 ViduTask 格式
                const task: ViduTask = {
                    id: d.id,
                    state: d.state,
                    model: d.model,
                    prompt: d.input?.prompts?.[0]?.content || '',
                    video: d.video,
                    created_at: d.created_at,
                    last_feed: new Date().getTime(),
                    duration: d.output_params?.duration || 4,
                    aspect_ratio: d.output_params?.aspect_ratio || '16:9',
                    resolution: d.output_params?.resolution || '720p',
                    movement_amplitude: d.output_params?.movement_amplitude || 'auto'
                };
                
                viduS.save(task);
                homeStore.setMyData({act: 'FeedViduTask'});
                
                // 检查任务是否完成
                if (d.state == 'completed' && d.video && d.video?.download_url) {
                    break;
                }
                
                // 检查任务是否失败
                if (d.state == 'failed') {
                    break;
                }
            }
        } catch (e) {
            console.error('Feed task error:', e);
            break;
        }
        
        await sleep(5 * 1000); // 5秒间隔轮询
    }
}

/**
 * 创建 Vidu V2 参考主体生成视频任务
 * 根据 OpenAPI 规范实现
 */
export const createViduV2ReferenceToVideo = async (params: ViduV2Request): Promise<ViduV2Response> => {
    const url = '/ent/v2/reference2video';
    
    // 验证必需参数
    if (!params.model || !params.images || !Array.isArray(params.images) || params.images.length === 0) {
        throw new Error('model 和 images 是必需参数，且 images 必须是非空数组');
    }
    if (!params.prompt) {
        throw new Error('prompt 是必需参数');
    }
    
    // 构建请求数据
    const requestData: ViduV2Request = {
        model: params.model,
        images: params.images,
        prompt: params.prompt,
        duration: params.duration || 4,
        seed: params.seed || '0',
        aspect_ratio: params.aspect_ratio || '16:9',
        resolution: params.resolution || '720p',
        movement_amplitude: params.movement_amplitude || 'auto'
    };
    
    try {
        const result: ViduV2Response = await viduFetch(url, requestData);
        
        if (result.id) {
            // 开始轮询任务状态
            setTimeout(() => {
                FeedViduTask(result.id);
            }, 1000);
        }
        
        return result;
    } catch (error) {
        console.error('Create Vidu V2 reference to video error:', error);
        throw error;
    }
}

/**
 * 获取 Vidu 任务详情
 * @param taskId 任务 ID
 */
export const getViduTask = async (taskId: string): Promise<ViduV2Response> => {
    if (!taskId) {
        throw new Error('taskId 是必需参数');
    }
    
    try {
        const result = await viduFetch(`/ent/v2/generations/${taskId}`);
        return result;
    } catch (error) {
        console.error('Get Vidu task error:', error);
        throw error;
    }
}

/**
 * 获取任务列表
 * @param page 页码
 * @param limit 每页数量
 */
export const getViduTasks = async (page: number = 1, limit: number = 20) => {
    try {
        const result = await viduFetch(`/ent/v2/generations?page=${page}&limit=${limit}`);
        return result;
    } catch (error) {
        console.error('Get Vidu tasks error:', error);
        throw error;
    }
}

/**
 * 删除任务
 * @param taskId 任务 ID
 */
export const deleteViduTask = async (taskId: string) => {
    if (!taskId) {
        throw new Error('taskId 是必需参数');
    }
    
    try {
        const result = await viduFetch(`/ent/v2/generations/${taskId}`, null, {method: 'DELETE'});
        
        // 同时从本地存储删除
        const viduS = new viduStore();
        const tasks = viduS.getObjs();
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            viduS.delete(task);
        }
        
        return result;
    } catch (error) {
        console.error('Delete Vidu task error:', error);
        throw error;
    }
}

/**
 * 检查服务器是否为香港服务器
 * 用于处理不同区域的 API 差异
 */
export const isHkServer = () => {
    const url = gptServerStore.myData.VIDU_SERVER?.toLowerCase() || '';
    if (url !== '') {
        return (url.indexOf('hk') > -1 && url.indexOf('pro') == -1);
    }
    return (homeStore.myData.session && homeStore.myData.session.isHk);
}

/**
 * 模型信息配置
 * 根据 API 文档提供的积分和价格信息
 */
export const viduModels = {
    'viduq1': {
        name: 'Vidu Q1',
        duration: '5S',
        resolution: '1080p',
        credits: 8,
        price: 0.4 // 8积分 * 0.05 PTC
    },
    'vidu2.0': {
        name: 'Vidu 2.0',
        duration: '4S',
        resolution: '720p',
        credits: 8,
        price: 0.4
    },
    'vidu1.5': {
        name: 'Vidu 1.5',
        versions: {
            '360p_4s': { duration: '4S', resolution: '360P', credits: 8, price: 0.4 },
            '720p_4s': { duration: '4S', resolution: '720P', credits: 20, price: 1.0 },
            '1080p_4s': { duration: '4S', resolution: '1080P', credits: 40, price: 2.0 },
            '720p_8s': { duration: '8S', resolution: '720P', credits: 40, price: 2.0 }
        }
    },
    'vidu1.0': {
        name: 'Vidu 1.0',
        versions: {
            '360p_4s': { duration: '4S', resolution: '360P', credits: 8, price: 0.4 },
            '360p_8s': { duration: '8S', resolution: '360P', credits: 16, price: 0.8 }
        }
    }
};

/**
 * 获取模型价格信息
 * @param model 模型名称
 * @param resolution 分辨率（可选）
 * @param duration 时长（可选）
 */
export const getModelPrice = (model: string, resolution?: string, duration?: string) => {
    const modelInfo = viduModels[model as keyof typeof viduModels];
    if (!modelInfo) return null;
    
    if ('versions' in modelInfo) {
        // 多版本模型
        const versionKey = `${resolution?.toLowerCase()}_${duration?.toLowerCase()}`;
        return modelInfo.versions[versionKey as keyof typeof modelInfo.versions] || null;
    } else {
        // 单版本模型
        return modelInfo;
    }
};