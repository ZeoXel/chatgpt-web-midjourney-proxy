import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { sleep } from "./suno";
import { Sora2Task, sora2Store } from "./sora2Store";
import { UnifiedVideoStore, UnifiedVideoTask } from "./videoStore";
import { convertSora2ToUnified } from "./videoAdapter";

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
            if (!d.ok) {
                let msg = '发生错误: '+ d.status
                try{
                  let bjson:any = await d.json();
                  msg = '('+ d.status+')发生错误: '+(bjson?.error?.message??'')
                }catch(e){
                }
                homeStore.myData.ms && homeStore.myData.ms.error(msg)
                throw new Error(msg);
            }

            d.json().then(d=> resolve(d)).catch(e=>{

                homeStore.myData.ms && homeStore.myData.ms.error('发生错误'+ e)
                reject(e)
            }
        )})
        .catch(e=>{
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                homeStore.myData.ms && homeStore.myData.ms.error('跨域|CORS error')
            }
            else homeStore.myData.ms && homeStore.myData.ms.error('发生错误:'+e)
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
            let a = await sora2Fetch('/v1/videos/' + id)
            let task = a as Sora2Task;
            mlog("sora2 task", a)

            task.last_feed = new Date().getTime()

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

            if(task.status === 'completed' || task.status === 'failed'){
                break;
            }
        }catch(e){
            mlog('sora2Feed error:', e);
        }
        await sleep(5200)
    }
}
