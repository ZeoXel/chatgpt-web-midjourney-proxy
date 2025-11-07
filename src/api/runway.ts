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

    // 本地代理模式下保持原始路径结构，避免错误移除 /pro 前缀
    let normalized = url.startsWith('/') ? url : `/${url}`;

    if (normalized.startsWith('/runway') || normalized.startsWith('/pro/runway')) {
        return normalized;
    }

    if (normalized.startsWith('/pro')) {
        return `/pro/runway${normalized.slice(4)}`;
    }

    return `/runway${normalized}`;
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

export interface RunwayUploadRequest {
    url: string;
    bucket?: string;
    path?: string;
    filename?: string;
    contentType?: string;
    size?: number;
    assetType?: 'video' | 'image' | 'audio';
    extra?: Record<string, any>;
}

export interface RunwayUploadResponse {
    asset_id: string;
    asset_url?: string;
    bytes?: number;
    content_type?: string;
    reuse?: boolean;
    reused?: boolean;
    [key: string]: any;
}

export const runwayUploadAsset = async (options: RunwayUploadRequest): Promise<RunwayUploadResponse> => {
    const payload: any = {
        asset_type: options.assetType ?? 'video',
        source: {
            type: 'supabase_public_url',
            url: options.url
        }
    };

    if (options.bucket) payload.source.bucket = options.bucket;
    if (options.path) payload.source.path = options.path;

    const metadata: any = {};
    if (options.filename) metadata.filename = options.filename;
    if (options.contentType) metadata.content_type = options.contentType;
    if (typeof options.size === 'number') metadata.size = options.size;
    if (Object.keys(metadata).length > 0) payload.metadata = metadata;

    if (options.extra && typeof options.extra === 'object') {
        Object.assign(payload, options.extra);
    }

    mlog('📤 [runwayUploadAsset] 上传请求:', payload);

    const result = await runwayFetch('/runway/uploads', payload);

    mlog('📥 [runwayUploadAsset] 网关响应:', result);

    if (typeof result?.code === 'number' && result.code !== 200) {
        const message = result?.msg || result?.message || result?.error?.message || 'Runway 上传失败';
        throw new Error(message);
    }
    const data = result?.data ?? result;

    // 验证返回的 asset_id
    const assetId = data?.asset_id ?? data?.id;
    if (!assetId) {
        mlog('⚠️ [runwayUploadAsset] 警告: 网关未返回 asset_id!', data);
    } else {
        mlog('✅ [runwayUploadAsset] 成功获取 asset_id:', assetId);
    }

    return data as RunwayUploadResponse;
};

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
        model: 'runway-aleph',
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
                taskType: 'aleph',
                options: { seconds: 5 },
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
 * Aleph 上下文视频模型（Alpha）
 * @param videoUrl 可公开访问的视频地址,最大 50MB
 * @param prompt 正向提示词
 * @param options 可选项: seconds(默认5)、images(最多1张)、extraOptions(透传给 options)
 */
export const runwayAlephContext = async (
    videoUrl: string,
    prompt: string,
    options?: {
        seconds?: number;
        images?: string[];
        extraOptions?: Record<string, any>;
    }
) => {
    if (!videoUrl) throw new Error('视频地址不能为空');
    if (!prompt) throw new Error('提示词不能为空');

    const seconds = Number.isFinite(options?.seconds) ? Number(options?.seconds) : 5;
    const payload: Record<string, any> = {
        video: videoUrl,
        prompt,
        options: {
            seconds,
            ...(options?.extraOptions ?? {})
        }
    };

    if (options?.images?.length) {
        payload.images = options.images.slice(0, 1);
    }

    mlog('runwayAlephContext payload:', payload);

    try {
        const result = await runwayFetch('/runway/v1/pro/aleph', payload);
        if (typeof result?.code === 'number' && result.code !== 200) {
            const message = result?.msg || result?.message || result?.error?.message || 'Runway Aleph 请求失败';
            throw new Error(message);
        }
        mlog('runwayAlephContext result', result);

        const taskId = result.data?.task_id || result.id;

        if (taskId) {
            mlog('🎬 Starting feed for Aleph task:', taskId);
            runwayFeed(taskId);
        }

        return result;
    } catch (error) {
        mlog('runwayAlephContext error', error);
        throw error;
    }
}
