import { gptServerStore, homeStore, useAuthStore } from "@/store";
import { mlog } from "./mjapi";
import { sleep } from "./suno";
import { RunwayTask, runwayStore } from "./runwayStore";
import { UnifiedVideoStore, UnifiedVideoTask } from "./videoStore";
import { convertRunwayToUnified } from "./videoAdapter";

/**
 * 获取请求头授权信息 - 参考 sora2.ts 的实现
 */
function getHeaderAuthorization() {
    let headers: any = {};

    // 优先级1: vtoken + ctoken (自定义代理)
    if (homeStore.myData.vtoken) {
        const vtokenh = {
            'x-vtoken': homeStore.myData.vtoken,
            'x-ctoken': homeStore.myData.ctoken
        };
        headers = { ...headers, ...vtokenh };
    }

    // 优先级2: 统一使用 OPENAI_API_KEY（NewAPI 网关标准）
    if (gptServerStore.myData.OPENAI_API_KEY) {
        const bmi = {
            'Authorization': 'Bearer ' + gptServerStore.myData.OPENAI_API_KEY
        };
        headers = { ...headers, ...bmi };
    } else {
        // 备用认证
        const authStore = useAuthStore();
        if (authStore.token) {
            const bmi = { 'x-ptoken': authStore.token };
            headers = { ...headers, ...bmi };
        }
    }

    return headers;
}

/**
 * 构建完整 URL - 参考 sora2.ts 的实现
 */
export const getUrl = (url: string) => {
    if (url.indexOf('http') === 0) return url;

    // 优先使用统一的 OPENAI_API_BASE_URL 网关配置
    if (gptServerStore.myData.OPENAI_API_BASE_URL) {
        // 直接使用完整路径，不做任何修改
        return `${gptServerStore.myData.OPENAI_API_BASE_URL}${url}`;
    }

    // 后端代理模式：需要处理 /pro 前缀
    const pro_prefix = url.indexOf('/pro') > -1 ? '/pro' : '';
    url = url.replaceAll('/pro', '');
    return `${pro_prefix}/runway${url}`;
}

/**
 * Runway 统一请求方法
 */
export const runwayFetch = (url: string, data?: any, opt2?: any) => {
    mlog('runwayFetch', url);

    let headers: any = opt2?.upFile ? {} : { 'Content-Type': 'application/json' };
    if (opt2?.headers) headers = opt2.headers;
    headers = { ...headers, ...getHeaderAuthorization() };

    return new Promise<any>((resolve, reject) => {
        let opt: RequestInit = { method: 'GET' };
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
                    let msg = '发生错误: ' + d.status;
                    try {
                        let bjson: any = await d.json();
                        msg = '(' + d.status + ')发生错误: ' + (bjson?.error?.message ?? '');
                    } catch (e) { }
                    homeStore.myData.ms && homeStore.myData.ms.error(msg);
                    throw new Error(msg);
                }

                d.json().then(d => resolve(d)).catch(e => {
                    homeStore.myData.ms && homeStore.myData.ms.error('发生错误' + e);
                    reject(e);
                });
            })
            .catch(e => {
                if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                    homeStore.myData.ms && homeStore.myData.ms.error('跨域|CORS error');
                } else {
                    homeStore.myData.ms && homeStore.myData.ms.error('发生错误:' + e);
                }
                mlog('e', e.stat);
                reject(e);
            });
    });
}

/**
 * 任务轮询监控
 * 每 5.2 秒检查一次任务状态，最多 200 次
 */
export const runwayFeed = async (id: string) => {
    mlog('🎬 [runwayFeed] Starting feed for task:', id);
    const sunoS = new runwayStore();

    // 立即创建 pending 任务，让 UI 能马上显示"加载中"
    const unifiedStore = new UnifiedVideoStore();
    const pendingTask: UnifiedVideoTask = {
        id: id,
        service: 'runway',
        url: '',
        status: 'pending',
        prompt: 'Loading...',
        model: 'runway-video2video',
        created_at: Date.now(),
        updated_at: Date.now()
    };

    mlog('💾 [Runway] Creating pending task:', pendingTask);
    unifiedStore.save(pendingTask);
    mlog('✅ [Runway] Pending task saved, total tasks:', unifiedStore.getAll().length);
    homeStore.setMyData({ act: 'RunwayFeed' }); // 立即触发 UI 刷新
    mlog('📢 [Runway] Triggered RunwayFeed event');

    // 轮询检查任务状态
    for (let i = 0; i < 200; i++) {
        try {
            // 使用官方文档指定的查询接口: POST /runway/v1/feed
            let result = await runwayFetch('/runway/v1/feed', { task_id: id });

            mlog("Runway feed result:", result);

            // 网关返回格式: { code: 200, data: { task_id, status, video_url, ... }, msg }
            if (result.code !== 200 || !result.data) {
                mlog('⚠️ [Runway] Invalid response:', result);
                continue;
            }

            const taskData = result.data;

            // 构建兼容 RunwayTask 格式的对象
            const task: RunwayTask = {
                id: taskData.task_id,
                name: taskData.prompt || '',
                image: null,
                createdAt: taskData.create_time ? new Date(parseInt(taskData.create_time) * 1000).toISOString() : new Date().toISOString(),
                updatedAt: taskData.update_time ? new Date(parseInt(taskData.update_time) * 1000).toISOString() : new Date().toISOString(),
                taskType: 'video2video',
                options: {},
                // status 映射: "1"=处理中, "2"=失败, "3"=成功
                status: taskData.status === '3' ? 'SUCCEEDED' : taskData.status === '2' ? 'FAILED' : 'RUNNING',
                error: taskData.msg,
                progressText: taskData.msg,
                progressRatio: '0',
                artifacts: taskData.video_url ? [{ url: taskData.video_url, filename: '', createdAt: '', updatedAt: '' }] : undefined,
                sharedAsset: null,
                last_feed: new Date().getTime()
            };

            mlog("Task status:", task.status, "video_url:", taskData.video_url);

            // 保存到旧 Store (保留兼容性)
            sunoS.save(task);

            // 保存到统一 Store
            const unifiedTask = convertRunwayToUnified(task);
            mlog('🔄 [Runway] Updating unified store:', unifiedTask.id, 'status:', unifiedTask.status);
            unifiedStore.save(unifiedTask);
            mlog('✅ [Runway] Updated, total tasks:', unifiedStore.getAll().length);

            homeStore.setMyData({ act: 'RunwayFeed' });

            // 任务完成或失败时退出轮询
            if (task.status === 'FAILED' || task.status === 'SUCCEEDED') {
                mlog('✅ [Runway] Task completed with status:', task.status);
                break;
            }
        } catch (e) {
            mlog('⚠️ [Runway] Feed error:', e);
        }
        await sleep(5200);
    }
}

/**
 * Video to Video - 视频转视频风格重绘
 * @param videoUrl 视频 URL（Supabase 公网 URL 或其他可访问 URL）
 * @param model 模型名称（例如：runway-video2video）
 * @param prompt 描述词（支持中文）
 * @param structure_transformation 结构改造 0-1 之间
 * @param flip 是否竖屏（默认为 false，即 16:9 宽屏）
 */
export const runwayVideo2Video = async (
    videoUrl: string,
    model: string,
    prompt: string,
    structure_transformation: number,
    flip: boolean = false
) => {
    const payload = {
        model,
        prompt,
        video_url: videoUrl,
        structure_transformation,
        flip
    };

    mlog('runwayVideo2Video', payload);

    try {
        // 发送 JSON 请求到网关 - 使用 Runway 专用路径
        const result = await runwayFetch('/runway/v1/pro/video2video', payload);
        mlog('runwayVideo2Video result', result);

        // Runway 网关返回格式: { code: 200, data: { task_id: "..." } }
        const taskId = result.data?.task_id || result.id;

        if (taskId) {
            mlog('🎬 Starting feed for video2video task:', taskId);
            runwayFeed(taskId);
        }

        return result;
    } catch (error) {
        mlog('runwayVideo2Video error', error);
        throw error;
    }
}
