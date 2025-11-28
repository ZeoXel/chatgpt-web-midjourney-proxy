/**
 * 资产镜像API - 将外部资产下载到COS并替换URL
 *
 * 使用场景:
 * - Suno音乐生成完成后,下载音频到COS
 * - MJ图片生成完成后,下载图片到COS
 * - Vidu/Luma视频生成完成后,下载视频到COS
 */

import { mlog } from './mjapi';
import { gptServerStore } from '@/store';
import { getUserUuid } from '@/utils/userUuid';

/**
 * 获取 Asset Mirror API 路径
 */
function getAssetMirrorApiPath(): string {
  // 统一使用 /api/asset-mirror 路径
  return '/api/asset-mirror';
}

/**
 * 获取用户ID - 统一使用userUuid
 *
 * 优先级:
 * 1. userUuid (从URL或前端设置)
 * 2. API Key前缀 (降级方案)
 * 3. 'anonymous'
 */
function getUserId(): string {
  // 优先使用userUuid,与对话存储保持一致
  const userUuid = getUserUuid();
  if (userUuid) {
    return userUuid;
  }

  // 降级: 使用API Key
  const apiKey = gptServerStore.myData.OPENAI_API_KEY;
  if (apiKey) {
    return apiKey.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
  }

  return 'anonymous';
}

/**
 * 镜像单个资产URL到COS
 * @param url 外部资产URL
 * @returns COS URL,如果失败返回原URL
 */
export async function mirrorAssetToCOS(url: string): Promise<string> {
  if (!url) return url;

  // 跳过已经是COS的URL
  if (url.includes('cos.lsaigc.com') || url.includes('cos.') && url.includes('.myqcloud.com')) {
    mlog('[Asset Mirror] 跳过已镜像的URL:', url);
    return url;
  }

  try {
    const apiPath = getAssetMirrorApiPath();
    const userId = getUserId();

    mlog(`[Asset Mirror] 开始镜像资产: ${url}`);

    const response = await fetch(`${apiPath}/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.cosUrl) {
      throw new Error(data.error || '镜像失败');
    }

    mlog(`[Asset Mirror] ✅ 镜像成功: ${url} → ${data.cosUrl}`);

    return data.cosUrl;

  } catch (error: any) {
    mlog(`[Asset Mirror] ❌ 镜像失败,使用原URL: ${url}`, error.message);
    // 失败时返回原URL,不影响用户体验
    return url;
  }
}

/**
 * 批量镜像资产URL到COS
 * @param urls 外部资产URL数组
 * @returns URL映射表 {原URL: COS URL}
 */
export async function mirrorAssetsToCOS(urls: string[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  if (!urls || urls.length === 0) {
    return urlMap;
  }

  // 过滤掉已经是COS的URL
  const externalUrls = urls.filter(url =>
    url &&
    !url.includes('cos.lsaigc.com') &&
    !(url.includes('cos.') && url.includes('.myqcloud.com'))
  );

  if (externalUrls.length === 0) {
    mlog('[Asset Mirror] 无需镜像,所有URL已在COS');
    // 返回原URL映射
    urls.forEach(url => urlMap.set(url, url));
    return urlMap;
  }

  try {
    const apiPath = getAssetMirrorApiPath();
    const userId = getUserId();

    mlog(`[Asset Mirror] 开始批量镜像: ${externalUrls.length} 个资产`);

    const response = await fetch(`${apiPath}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: externalUrls,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.results) {
      throw new Error(data.error || '批量镜像失败');
    }

    // 构建URL映射表
    data.results.forEach((result: any) => {
      urlMap.set(result.originalUrl, result.cosUrl || result.originalUrl);
    });

    mlog(`[Asset Mirror] ✅ 批量镜像完成: 成功=${data.processed}, 失败=${data.failed}`);

    // 添加已经是COS的URL映射
    urls.forEach(url => {
      if (!urlMap.has(url)) {
        urlMap.set(url, url);
      }
    });

    return urlMap;

  } catch (error: any) {
    mlog(`[Asset Mirror] ❌ 批量镜像失败,使用原URL`, error.message);
    // 失败时返回原URL映射
    urls.forEach(url => urlMap.set(url, url));
    return urlMap;
  }
}

/**
 * 镜像Suno音频到COS并替换URL
 */
export async function mirrorSunoAudio(sunoMedia: any): Promise<any> {
  if (!sunoMedia || !sunoMedia.audio_url) {
    return sunoMedia;
  }

  try {
    // 镜像音频URL
    const newAudioUrl = await mirrorAssetToCOS(sunoMedia.audio_url);

    // 镜像封面图URL
    const newImageUrl = sunoMedia.image_url
      ? await mirrorAssetToCOS(sunoMedia.image_url)
      : sunoMedia.image_url;

    const newImageLargeUrl = sunoMedia.image_large_url
      ? await mirrorAssetToCOS(sunoMedia.image_large_url)
      : sunoMedia.image_large_url;

    // 返回替换URL后的对象
    return {
      ...sunoMedia,
      audio_url: newAudioUrl,
      image_url: newImageUrl,
      image_large_url: newImageLargeUrl,
    };

  } catch (error) {
    mlog('[Asset Mirror] Suno镜像失败,返回原对象:', error);
    return sunoMedia;
  }
}

/**
 * 镜像MJ图片到COS并替换URL
 */
export async function mirrorMJImage(mjData: any): Promise<any> {
  if (!mjData) return mjData;

  try {
    // 如果有imageUrl字段
    if (mjData.imageUrl) {
      mjData.imageUrl = await mirrorAssetToCOS(mjData.imageUrl);
    }

    // 如果有images数组
    if (mjData.images && Array.isArray(mjData.images)) {
      const urlMap = await mirrorAssetsToCOS(mjData.images);
      mjData.images = mjData.images.map((url: string) => urlMap.get(url) || url);
    }

    return mjData;

  } catch (error) {
    mlog('[Asset Mirror] MJ镜像失败,返回原对象:', error);
    return mjData;
  }
}

/**
 * 镜像视频到COS并替换URL (适用于Vidu/Luma/Runway等)
 */
export async function mirrorVideoUrl(videoData: any): Promise<any> {
  if (!videoData) return videoData;

  try {
    // 如果有videoUrl字段
    if (videoData.videoUrl) {
      videoData.videoUrl = await mirrorAssetToCOS(videoData.videoUrl);
    }

    // 如果有video_url字段
    if (videoData.video_url) {
      videoData.video_url = await mirrorAssetToCOS(videoData.video_url);
    }

    // 如果有videoUrls数组
    if (videoData.videoUrls && Array.isArray(videoData.videoUrls)) {
      const urls = videoData.videoUrls.map((v: any) => v.url || v).filter(Boolean);
      const urlMap = await mirrorAssetsToCOS(urls);

      videoData.videoUrls = videoData.videoUrls.map((item: any) => {
        if (typeof item === 'string') {
          return urlMap.get(item) || item;
        } else if (item.url) {
          return { ...item, url: urlMap.get(item.url) || item.url };
        }
        return item;
      });
    }

    // 镜像封面图
    if (videoData.imageUrl) {
      videoData.imageUrl = await mirrorAssetToCOS(videoData.imageUrl);
    }

    return videoData;

  } catch (error) {
    mlog('[Asset Mirror] Video镜像失败,返回原对象:', error);
    return videoData;
  }
}
