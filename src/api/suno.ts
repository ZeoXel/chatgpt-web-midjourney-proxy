import { gptServerStore,homeStore,useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { sunoStore,SunoMedia } from "./sunoStore";
import { saveSunoAudioToCOS } from "./sunoStorage";

const getUrl=(url:string)=>{
    if(url.indexOf('http')==0) return url;
    if(gptServerStore.myData.SUNO_SERVER){
        if( gptServerStore.myData.SUNO_SERVER.indexOf('suno')>0 ) return `${ gptServerStore.myData.SUNO_SERVER}${url}`;

        return `${ gptServerStore.myData.SUNO_SERVER}/suno${url}`;
    }
    return `/sunoapi${url}`;
}
function getHeaderAuthorization(){
    let headers={}
    if( homeStore.myData.vtoken ){
        const  vtokenh={ 'x-vtoken':  homeStore.myData.vtoken ,'x-ctoken':  homeStore.myData.ctoken};
        headers= {...headers, ...vtokenh}
    }
    if(!gptServerStore.myData.SUNO_KEY){
        const authStore = useAuthStore()
        if( authStore.token ) {
            const bmi= { 'x-ptoken':  authStore.token };
            headers= {...headers, ...bmi }
            return headers;
        }
        return headers
    }
    const bmi={
        'Authorization': 'Bearer ' +gptServerStore.myData.SUNO_KEY
    }
    headers= {...headers, ...bmi }
    return headers
}
export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
export const lyricsFetch= async ( lid:string)=>{
    for(let i=0;i<50;i++){
        let dt:any = await sunoFetch(`/lyrics/${lid}`);
        mlog("ddd",dt )
        let time= (i+1)
        if(time>20) time=20;
        if(dt.status=='complete') return dt ;
        if( dt.status=='error') return null;
        await sleep( time*1000 )
        
    }
    return null;
   
}

export function randStyle(): string {
    const s: string[] = ["acoustic", "aggressive", "anthemic", "atmospheric", "bouncy", "chill", "dark", "dreamy", "electronic", "emotional", "epic", "experimental", "futuristic", "groovy", "heartfelt", "infectious", "melodic", "mellow", "powerful", "psychedelic", "romantic", "smooth", "syncopated", "uplifting", ""];
    const l: string[] = ["afrobeat", "anime", "ballad", "bedroom pop", "bluegrass", "blues", "classical", "country", "cumbia", "dance", "dancepop", "delta blues", "electropop", "disco", "dream pop", "drum and bass", "edm", "emo", "folk", "funk", "future bass", "gospel", "grunge", "grime", "hip hop", "house", "indie", "j-pop", "jazz", "k-pop", "kids music", "metal", "new jack swing", "new wave", "opera", "pop", "punk", "raga", "rap", "reggae", "reggaeton", "rock", "rumba", "salsa", "samba", "sertanejo", "soul", "synthpop", "swing", "synthwave", "techno", "trap", "uk garage"];
    
    const randomS: string = s[Math.floor(Math.random() * s.length)];
    const randomL: string = l[Math.floor(Math.random() * l.length)];
    // const randomS2: string = s[Math.floor(Math.random() * s.length)];
    // const randomL2: string = l[Math.floor(Math.random() * l.length)];

    return randomS + " " + randomL ;
}

// 全局轮询任务管理器 - 防止重复轮询
const activeFeedTasks = new Map<string, boolean>();

export const FeedTask = async (ids: string[]) => {
    if (ids.length <= 0) return;

    // 生成唯一标识符（排序后的ID列表）
    const taskKey = ids.sort().join(',');

    // 如果该任务已在轮询中，直接返回
    if (activeFeedTasks.has(taskKey)) {
        mlog('FeedTask already running for:', taskKey);
        return;
    }

    // 标记任务开始
    activeFeedTasks.set(taskKey, true);

    // 启动轮询循环
    await feedTaskLoop(ids, taskKey);
}

async function feedTaskLoop(ids: string[], taskKey: string, retryCount = 0) {
    const sunoS = new sunoStore();
    const maxRetries = 50; // 最大轮询次数（约4分钟）

    // 超过最大重试次数，停止轮询
    if (retryCount >= maxRetries) {
        mlog('FeedTask max retries reached for:', taskKey);
        activeFeedTasks.delete(taskKey);
        return;
    }

    // 🔑 关键修复1：首次查询前等待3秒，让API准备资源
    if (retryCount === 0) {
        mlog('FeedTask initial delay 3s for:', ids);
        await sleep(3000);
    }

    try {
        // 🔑 关键修复2：批量查询失败时，尝试单个查询
        let d: any[] = [];

        try {
            // 使用静默模式，不显示500错误弹窗
            d = await sunoFetch('/feed/' + ids.join(','), undefined, undefined, true);
            mlog('FeedTask batch success:', d);
        } catch (batchError) {
            mlog('FeedTask batch failed, trying individual queries:', batchError);

            // 批量查询失败，逐个查询（静默模式）
            for (const id of ids) {
                try {
                    const single = await sunoFetch('/feed/' + id, undefined, undefined, true);
                    if (Array.isArray(single)) {
                        d.push(...single);
                    } else {
                        d.push(single);
                    }
                } catch (singleError) {
                    mlog('FeedTask single query failed for:', id, singleError);
                }
            }
        }

        // 处理返回的数据
        for (const item of d) {
            // 直接保存(Suno URL已持久化,不需要镜像)
            sunoS.save(item);

            // 当音乐生成完成时,保存URL到COS JSON文件
            if (item.status === "complete") {
                console.log('[Suno Asset Save] Suno URL已持久化,保存到COS JSON文件', {
                    id: item.id,
                    audio_url: item.audio_url
                });

                saveSunoAudioToCOS(item).catch(err => {
                    console.warn('[Suno Asset Save] 保存失败（不影响用户体验）:', err);
                });
            }

            if (item.status === "complete" || item.status === "error") {
                ids = ids.filter(v => v !== item.id);
            }
        }

        homeStore.setMyData({ act: 'FeedTask' });

        // 重置错误计数
        retryCount = 0;

    } catch (error) {
        retryCount++;
        mlog(`FeedTask error (retry ${retryCount}/${maxRetries}):`, error);

        // 🔑 关键修复3：连续失败5次后停止
        if (retryCount >= 5) {
            mlog('FeedTask stopped due to consecutive errors');
            activeFeedTasks.delete(taskKey);
            return;
        }
    }

    // 如果还有未完成的任务，继续轮询
    if (ids.length > 0) {
        await sleep(5000); // 等待5秒
        await feedTaskLoop(ids, taskKey, retryCount);
    } else {
        // 所有任务完成，清理
        activeFeedTasks.delete(taskKey);
        mlog('FeedTask completed for:', taskKey);
    }
}


export const sunoFetch=(url:string,data?:any,opt2?:any, silent = false )=>{
    mlog('sunoFetch', url  );
    let headers= {'Content-Type':'application/json'}
    if(opt2 && opt2.headers ) headers= opt2.headers;

    headers={...headers,...getHeaderAuthorization()}

    return new Promise<any>((resolve, reject) => {
        let opt:RequestInit ={method:'GET'};

        opt.headers= headers ;
        if(opt2?.upFile ){
             opt.method='POST';
             opt.body=data as FormData ;
        }
        else if(data) {
            opt.body= JSON.stringify(data) ;
            opt.method='POST';
        }
        fetch(getUrl(url),  opt )
        .then( async (d) =>{
            if (!d.ok) {
                let msg = '发生错误: '+ d.status
                try{
                  let bjson:any  = await d.json();
                  msg = '('+ d.status+')发生错误: '+(bjson?.error?.message??'' )
                }catch( e ){
                }
                // 🔑 静默模式：不显示错误弹窗
                if (!silent) {
                    homeStore.myData.ms &&  homeStore.myData.ms.error(msg )
                }
                throw new Error( msg );
            }

            d.json().then(d=> resolve(d)).catch(e=>{
                // 🔑 静默模式：不显示错误弹窗
                if (!silent) {
                    homeStore.myData.ms &&  homeStore.myData.ms.error('发生错误'+ e )
                }
                reject(e)
            }
        )})
        .catch(e=>{
            // 🔑 静默模式：不显示错误弹窗
            if (!silent) {
                if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                    homeStore.myData.ms &&  homeStore.myData.ms.error('跨域|CORS error'  )
                }
                else homeStore.myData.ms &&  homeStore.myData.ms.error('发生错误:'+e )
            }
            mlog('e', e.stat )
            reject(e)
        })
    })

}
