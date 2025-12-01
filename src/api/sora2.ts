import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { sleep } from "./suno";
import { Sora2Task, sora2Store } from "./sora2Store";
import { UnifiedVideoStore, UnifiedVideoTask } from "./videoStore";
import { convertSora2ToUnified } from "./videoAdapter";
import { saveVideoToCOS } from "./videoStorage";

// 获取认证头部 - 统一使用 NewAPI 网关认证，参考 vidu.ts 的实现
function getHeaderAuthorization(){
    let headers = {};

    // 优先使用vtoken
    if(homeStore.myData.vtoken){
        const vtokenh = { 'x-vtoken': homeStore.myData.vtoken, 'x-ctoken': homeStore.myData.ctoken };
        headers = {...headers, ...vtokenh};
    }

    // ✅ NewAPI网关：使用核心OPENAI_API_KEY，不需要专用SORA2_KEY
    if(gptServerStore.myData.OPENAI_API_KEY){
        const bmi = {
            'Authorization': 'Bearer ' + gptServerStore.myData.OPENAI_API_KEY
        };
        headers = {...headers, ...bmi};
    } else {
        // 备用认证
        const authStore = useAuthStore();
        if(authStore.token){
            const bmi = { 'x-ptoken': authStore.token };
            headers = {...headers, ...bmi};
        }
    }

    return headers;
}

// 获取API URL - 统一使用 NewAPI 网关配置
export const getUrl=(url:string)=>{
    if(url.indexOf('http')==0) return url;

    const pro_prefix= url.indexOf('/pro')>-1?'/pro':'';
    url= url.replaceAll('/pro','')

    // ✅ 优先使用统一的 OPENAI_API_BASE_URL 网关配置
    if(gptServerStore.myData.OPENAI_API_BASE_URL){
        return `${gptServerStore.myData.OPENAI_API_BASE_URL}${url}`;
    }

    // ✅ 开发环境和生产环境都使用后端代理
    // Sora2 API: /v1/videos, /v1/videos/{id}
    return `${pro_prefix}${url}`;
}

export const sora2Fetch=(url:string, data?:any, opt2?:any)=>{
    mlog('sora2Fetch', url);
    let headers: Record<string, string> = opt2?.upFile ? {} : {'Content-Type':'application/json'}

    if(opt2 && opt2.headers) headers = opt2.headers;

    headers = {...headers, ...getHeaderAuthorization()}

    // 调试日志：打印请求详情
    const finalUrl = getUrl(url);
    mlog('sora2Fetch final URL:', finalUrl);
    if(data && !opt2?.upFile){
        mlog('sora2Fetch data:', JSON.stringify(data, null, 2));
    }
    mlog('sora2Fetch headers:', headers);

    // 是否静默模式（轮询时不显示错误弹窗）
    const silent = opt2?.silent ?? false;

    return new Promise<any>((resolve, reject) => {
        let opt:RequestInit = {method:'GET'};

        opt.headers = headers;
        if(opt2?.upFile){
            opt.method = 'POST';
            opt.body = data as FormData;
        }
        else if(data) {
            opt.body = JSON.stringify(data);
            opt.method = 'POST';
        }
        fetch(finalUrl, opt)
        .then(async (d) =>{
            // ✅ 先尝试获取响应文本（无论状态码）
            let responseText = '';
            let responseData: any = null;

            try {
                responseText = await d.text();
                mlog('sora2Fetch response text:', responseText);

                // 尝试解析 JSON
                if (responseText && responseText.trim().length > 0) {
                    try {
                        responseData = JSON.parse(responseText);
                    } catch (parseError) {
                        mlog('⚠️ JSON 解析失败，响应文本:', responseText.substring(0, 200));
                    }
                }
            } catch (textError) {
                mlog('⚠️ 无法读取响应文本:', textError);
            }

            // ✅ 特殊处理：如果返回 500 但包含有效的任务 ID，视为成功
            // 原因：某些网关在任务提交成功后处理响应时可能超时，但任务已创建
            if (!d.ok) {
                // 检查是否有任务 ID（表示任务已创建）
                if (responseData && responseData.id) {
                    mlog('⚠️ [Sora2] 虽然返回错误状态，但检测到任务 ID，视为提交成功:', responseData.id);
                    resolve(responseData); // 返回任务数据
                    return;
                }

                // 真正的错误
                let msg = `发生错误: ${d.status}`;
                if (responseData?.message) {
                    msg = `(${d.status}) ${responseData.message}`;
                } else if (responseData?.error?.message) {
                    msg = `(${d.status}) ${responseData.error.message}`;
                }

                // 只在非静默模式下显示错误
                if (!silent) {
                    homeStore.myData.ms && homeStore.myData.ms.error(msg);
                }
                throw new Error(msg);
            }

            // 正常响应
            if (responseData) {
                resolve(responseData);
            } else {
                throw new Error('响应为空或无效');
            }
        })
        .catch(e=>{
            // 只在非静默模式下显示错误
            if (!silent) {
                if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                    homeStore.myData.ms && homeStore.myData.ms.error('跨域|CORS error')
                }
                else homeStore.myData.ms && homeStore.myData.ms.error('发生错误:'+e)
            }
            mlog('e', e.stat)
            reject(e)
        })
    })
}

export const sora2Feed = async(id:string)=>{
    const store = new sora2Store();
    const unifiedStore = new UnifiedVideoStore();

    // ✅ 检查是否已存在任务（sora2Input.vue已经创建了带正确prompt的任务）
    // 如果不存在才创建pending任务
    const existingTask = unifiedStore.getAll().find(t => t.id === id);
    if (!existingTask) {
        const pendingTask: UnifiedVideoTask = {
            id: id,
            service: 'sora2',
            url: '',
            status: 'pending',
            prompt: 'Loading...',
            model: 'sora-2',
            created_at: Date.now(),
            updated_at: Date.now()
        };
        unifiedStore.save(pendingTask);
        homeStore.setMyData({act:'Sora2Feed'}); // 立即触发UI刷新
    }

    for(let i=0; i<200; i++){
        try{
            // 轮询时使用静默模式，不显示错误弹窗
            let a = await sora2Fetch('/v1/videos/' + id, undefined, { silent: true })
            let task = a as Sora2Task;

            // ✅ 详细日志：打印完整的API响应
            console.log('[Sora2] 📦 API响应 (第' + (i+1) + '次轮询):', JSON.stringify(task, null, 2));
            mlog("sora2 task", a)

            task.last_feed = new Date().getTime()
            if (!task.url && task.video_url) {
                console.log('[Sora2] 🔄 从video_url复制到url:', task.video_url);
                task.url = task.video_url;
            }
            if (typeof task.progress === 'string') {
                const parsed = Number(task.progress);
                task.progress = Number.isNaN(parsed) ? task.progress : parsed;
            }

            // 保存到旧Store (保留兼容性)
            store.save(task)

            // ✅ 转换为统一格式
            const unifiedTask = convertSora2ToUnified(task);

            // ✅ 如果转换后的prompt为空，保留原有任务的prompt
            const existingTask = unifiedStore.getById(id);
            if (existingTask && (!unifiedTask.prompt || unifiedTask.prompt === 'Loading...')) {
                unifiedTask.prompt = existingTask.prompt;
            }

            mlog('🔄 [Sora2] Updating unified store:', unifiedTask.id, 'status:', unifiedTask.status);
            unifiedStore.save(unifiedTask);
            mlog('✅ [Sora2] Updated, total tasks:', unifiedStore.getAll().length);

            homeStore.setMyData({act:'Sora2Feed'});

            // 视频生成成功时,下载到COS并保存JSON记录
            console.log('[Sora2] 🔍 检查COS保存条件:', {
                id: task.id,
                status: task.status,
                '状态是completed?': task.status === 'completed',
                hasUrl: !!task.url,
                url: task.url,
                video_url: task.video_url,
                '条件满足?': task.status === 'completed' && !!task.url
            });

            if(task.status === 'completed' && task.url) {
                console.log('[Sora2 Video Save] ✅✅✅ 条件满足!开始保存到COS:', task.url);

                // ✅ 获取正确的prompt (可能在existingTask中)
                const actualPrompt = task.prompt || existingTask?.prompt || '';

                // ✅ 正确处理created_at时间戳
                const createdAtISO = task.created_at
                    ? new Date(task.created_at).toISOString()
                    : new Date().toISOString();

                console.log('[Sora2 Video Save] 📋 保存参数:', {
                    id: task.id,
                    prompt: actualPrompt,
                    url: task.url,
                    created_at: createdAtISO,
                    created_at_raw: task.created_at
                });

                // 异步保存到COS (不阻塞用户体验)
                saveVideoToCOS({
                    id: task.id,
                    service: 'sora2',
                    model: task.model || 'sora-2',
                    prompt: actualPrompt,
                    original_url: task.url,
                    poster_url: task.thumbnail,
                    duration: task.seconds ? parseFloat(task.seconds) : undefined,
                    aspect_ratio: task.size,
                    status: 'success',
                    created_at: createdAtISO,
                    metadata: {
                        watermark: task.watermark,
                        size: task.size,
                    }
                }).then(() => {
                    console.log('[Sora2 Video Save] ✅ 视频已下载到COS并保存JSON记录');
                }).catch(err => {
                    console.error('[Sora2 Video Save] ❌ 保存失败:', err);
                    console.error('[Sora2 Video Save] 错误详情:', JSON.stringify(err, null, 2));
                });
            } else {
                console.log('[Sora2] ⏭️ COS保存条件不满足,跳过 (status=' + task.status + ', hasUrl=' + !!task.url + ')');
            }

            if(task.status === 'completed' || task.status === 'failed'){
                mlog('🏁 [Sora2] 任务结束,退出轮询:', task.status);
                break;
            }
        }catch(e){
            mlog('sora2Feed error:', e);
        }
        await sleep(5200)
    }
}
