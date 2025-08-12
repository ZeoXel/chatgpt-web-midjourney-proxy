import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { ViduTask, viduStore } from "./viduStore";
import { sleep } from "./suno";

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
    
    // Pro 前缀处理（根据 Vidu API 文档调整）
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
        let url = '/generations/' + id;  // 根据 Vidu API 调整路径
        
        try {
            let d: ViduTask = await viduFetch(url);
            if (d.id) {
                d.last_feed = new Date().getTime()
                viduS.save(d);
                homeStore.setMyData({act: 'FeedViduTask'});
                
                // 检查任务是否完成（根据 Vidu API 状态字段调整）
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
 * 分类任务轮询（支持不同的视频生成类型）
 * 用于处理文本转视频、图片转视频等不同类型的任务
 */
export const viduFeed = async (id: string, cat: string, prompt: string) => {
    const viduS = new viduStore();
    let url = '/v1/videos/text2video/'; // 默认文本转视频
    
    // 根据类别确定 API 路径
    if (cat == 'image2video') {
        url = '/v1/videos/image2video/';
    }
    // 可以添加更多类型，如 'video2video', 'style_transfer' 等
    
    url = url + id;
    
    for (let i = 0; i < 200; i++) {
        try {
            let a = await viduFetch(url)
            let task = a as ViduTask;
            task.last_feed = new Date().getTime()
            task.category = cat
            if (prompt) {
                task.prompt = prompt
            }
            
            viduS.save(task)
            homeStore.setMyData({act: 'ViduFeed'});
            
            // 检查任务完成或失败状态（根据 Vidu API 调整）
            if (task.state == 'failed' || task.state == 'completed') {
                break;
            }
        } catch (e) {
            console.error('Vidu feed error:', e);
            break;
        }
        await sleep(5200) // 5.2秒间隔
    }
}

/**
 * 创建文本转视频任务
 * @param prompt 视频描述文本
 * @param options 可选参数（如持续时间、尺寸等）
 */
export const createTextToVideo = async (prompt: string, options?: any) => {
    const data = {
        prompt,
        ...options
    };
    
    try {
        const result = await viduFetch('/v1/videos/text2video', data);
        if (result.id) {
            // 开始轮询任务状态
            FeedViduTask(result.id);
        }
        return result;
    } catch (error) {
        console.error('Create text to video error:', error);
        throw error;
    }
}

/**
 * 创建图片转视频任务
 * @param imageFile 图片文件
 * @param prompt 视频描述文本
 * @param options 可选参数
 */
export const createImageToVideo = async (imageFile: File, prompt: string, options?: any) => {
    const formData = new FormData();
    formData.append('image_file', imageFile);
    formData.append('prompt', prompt);
    
    // 添加其他选项
    if (options) {
        Object.keys(options).forEach(key => {
            formData.append(key, options[key]);
        });
    }
    
    try {
        const result = await viduFetch('/v1/videos/image2video', formData, {upFile: true});
        if (result.id) {
            viduFeed(result.id, 'image2video', prompt);
        }
        return result;
    } catch (error) {
        console.error('Create image to video error:', error);
        throw error;
    }
}

/**
 * 获取任务详情
 * @param taskId 任务 ID
 */
export const getViduTask = async (taskId: string) => {
    try {
        const result = await viduFetch(`/v1/tasks/${taskId}`);
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
        const result = await viduFetch(`/v1/tasks?page=${page}&limit=${limit}`);
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
    try {
        const result = await viduFetch(`/v1/tasks/${taskId}`, null, {method: 'DELETE'});
        
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
 * 检查服务器是否为特定区域服务器
 * 用于处理不同区域的 API 差异
 */
export const isSpecialServer = () => {
    const url = gptServerStore.myData.VIDU_SERVER?.toLowerCase() || '';
    if (url !== '') {
        return (url.indexOf('special-region') > -1 && url.indexOf('pro') == -1);
    }
    return (homeStore.myData.session && homeStore.myData.session.isSpecialRegion);
}