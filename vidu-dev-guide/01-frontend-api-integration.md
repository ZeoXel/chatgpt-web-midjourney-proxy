# 前端 API 集成模式

基于 Kling 和 Luma API 的前端集成模式分析和 Vidu API 接入指南。

## 1. API 客户端架构模式

### 1.1 核心文件结构
```
src/api/
├── vidu.ts              # API 客户端实现
├── viduStore.ts         # 本地存储管理
└── index.ts             # API 导出汇总
```

### 1.2 请求客户端模式 (基于 luma.ts 和 kling.ts)

#### 认证头部处理
```typescript
function getHeaderAuthorization() {
    let headers = {}
    
    // VToken 认证
    if (homeStore.myData.vtoken) {
        const vtokenh = { 
            'x-vtoken': homeStore.myData.vtoken,
            'x-ctoken': homeStore.myData.ctoken
        };
        headers = {...headers, ...vtokenh}
    }
    
    // API Key 认证
    if (!gptServerStore.myData.VIDU_KEY) {
        const authStore = useAuthStore()
        if (authStore.token) {
            const bmi = { 'x-ptoken': authStore.token };
            headers = {...headers, ...bmi }
            return headers;
        }
        return headers
    }
    
    // Bearer Token
    const bmi = {
        'Authorization': 'Bearer ' + gptServerStore.myData.VIDU_KEY
    }
    headers = {...headers, ...bmi }
    return headers
}
```

#### URL 处理模式
```typescript
const getUrl = (url: string) => {
    if (url.indexOf('http') == 0) return url;
    
    // Pro 前缀处理 (如果需要)
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
```

#### 统一请求方法
```typescript
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
```

## 2. 数据存储模式

### 2.1 任务数据接口定义
```typescript
// viduStore.ts 示例结构
export interface ViduTask {
    id: string;
    prompt: string;
    state: string;
    created_at?: string;
    updated_at?: string;
    video?: {
        url: string;
        width: number;
        height: number;
        thumbnail: string | null;
        download_url?: string;
    };
    last_feed?: number;
    category?: string;
}
```

### 2.2 本地存储管理器
```typescript
export class viduStore {
    private localKey = 'vidu-store';
    
    public save(obj: ViduTask) {
        if (!obj.id) throw "id must";
        let arr = this.getObjs();
        let i = arr.findIndex(v => v.id == obj.id);
        if (i > -1) arr[i] = obj;
        else arr.push(obj);
        ss.set(this.localKey, arr);
        return this;
    }
    
    public findIndex(id: string) { 
        return this.getObjs().findIndex(v => v.id == id)
    }

    public getObjs(): ViduTask[] {
        const obj = ss.get(this.localKey) as undefined | ViduTask[];
        if (!obj) return [];
        return obj;
    }
    
    public getOneById(id: string): ViduTask | null {
        const i = this.findIndex(id)
        if (i < 0) return null;
        let arr = this.getObjs();
        return arr[i]
    }
    
    public delete(obj: ViduTask) {
        if (!obj.id) throw "id must";
        let arr = this.getObjs();
        let i = arr.findIndex(v => v.id == obj.id);
        if (i < 0) return false
        arr.splice(i, 1);
        ss.set(this.localKey, arr);
        return true;
    }
}
```

## 3. 任务轮询机制

### 3.1 异步任务轮询 (参考 luma.ts 的 FeedLumaTask)
```typescript
export const FeedViduTask = async (id: string) => {
    if (id == '') return '';
    const viduS = new viduStore();
    
    for (let i = 0; i < 120; i++) {
        let url = '/generations/' + id;
        
        try {
            let d: ViduTask = await viduFetch(url);
            if (d.id) {
                d.last_feed = new Date().getTime()
                viduS.save(d);
                homeStore.setMyData({act: 'FeedViduTask'});
                
                // 检查任务是否完成
                if (d.state == 'completed' && d.video && d.video?.download_url) {
                    break;
                }
            }
        } catch (e) {
            console.error('Feed task error:', e);
            break;
        }
        
        await sleep(5 * 1000); // 5秒间隔
    }
}
```

### 3.2 分类任务轮询 (参考 kling.ts 的 klingFeed)
```typescript
export const viduFeed = async (id: string, cat: string, prompt: string) => {
    const viduS = new viduStore();
    let url = '/v1/videos/text2video/'; // 根据 Vidu API 调整
    
    if (cat == 'image2video') {
        url = '/v1/videos/image2video/';
    }
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
            
            if (task.state == 'failed' || task.state == 'completed') {
                break;
            }
        } catch (e) {
            break;
        }
        await sleep(5200)
    }
}
```

## 4. Store 集成

### 4.1 在 homeStore.ts 中添加状态
```typescript
// 在 homeStore 中添加 Vidu 相关状态
const homeStore = {
    myData: {
        // ... 其他状态
        viduTasks: [] as ViduTask[],
        activeViduTask: null as ViduTask | null,
    }
}
```

### 4.2 在 gptServerStore 中添加配置
```typescript
const gptServerStore = {
    myData: {
        // ... 其他配置
        VIDU_SERVER: '',
        VIDU_KEY: '',
    }
}
```

## 5. 使用示例

### 5.1 创建视频任务
```typescript
const createViduVideo = async (prompt: string, options?: any) => {
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
        console.error('Create video error:', error);
        throw error;
    }
}
```

### 5.2 图片转视频
```typescript
const imageToVideo = async (imageUrl: string, prompt: string, options?: any) => {
    const data = {
        image_url: imageUrl,
        prompt,
        ...options
    };
    
    try {
        const result = await viduFetch('/v1/videos/image2video', data);
        if (result.id) {
            viduFeed(result.id, 'image2video', prompt);
        }
        return result;
    } catch (error) {
        console.error('Image to video error:', error);
        throw error;
    }
}
```

## 6. 错误处理

### 6.1 网络错误处理
- CORS 错误检测和提示
- 网络超时处理
- API 限流处理

### 6.2 业务错误处理
- API 返回错误状态处理
- 任务失败状态处理
- 数据格式验证

## 7. 最佳实践

1. **状态管理**: 使用本地存储保持任务状态持久化
2. **轮询优化**: 合理设置轮询间隔，避免过于频繁请求
3. **错误恢复**: 实现重试机制和错误恢复策略
4. **资源清理**: 及时清理完成或失败的任务数据
5. **用户体验**: 提供清晰的任务状态反馈和进度指示