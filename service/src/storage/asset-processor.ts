/**
 * 资产处理器 - 下载外部资产并上传到COS
 *
 * 功能:
 * - 从外部URL下载图片/视频/音频
 * - 上传到COS用户目录
 * - 替换ChatState中的外部URL为COS URL
 * - 支持去重和批量处理
 */

import { TencentCOSClient } from './cos-client';
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';

interface AssetInfo {
  originalUrl: string;
  cosUrl?: string;
  hash?: string;
  type: 'image' | 'video' | 'audio' | 'model' | 'other';
  size?: number;
  error?: string;
}

interface ProcessResult {
  success: boolean;
  processed: number;
  failed: number;
  assets: AssetInfo[];
}

export class AssetProcessor {
  private cosClient: TencentCOSClient;
  private downloadTimeout: number = 30000; // 30秒超时
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB
  private urlCache: Map<string, string> = new Map(); // URL缓存: 原始URL -> COS URL

  constructor() {
    this.cosClient = new TencentCOSClient();
  }

  /**
   * 判断是否为外部URL（需要下载的URL）
   */
  private isExternalUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    // 跳过已经是COS的URL
    if (url.includes('cos.') && url.includes('.myqcloud.com')) return false;
    if (url.includes('cos.lsaigc.com')) return false;

    // 只处理http/https的URL
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * 根据URL判断资产类型
   */
  private getAssetType(url: string): AssetInfo['type'] {
    const lowerUrl = url.toLowerCase();

    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(lowerUrl)) {
      return 'image';
    }
    if (/\.(mp4|mov|avi|webm|mkv)(\?|$)/.test(lowerUrl)) {
      return 'video';
    }
    if (/\.(mp3|wav|ogg|m4a|flac)(\?|$)/.test(lowerUrl)) {
      return 'audio';
    }
    if (/\.(glb|gltf|obj|fbx|stl|usdz|3mf|ply|dae|3ds)(\?|$)/.test(lowerUrl)) {
      return 'model';
    }

    return 'other';
  }

  /**
   * 计算URL的哈希值（用于去重）
   */
  private hashUrl(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(url: string, contentType?: string): string {
    // 首先尝试从URL获取
    const urlMatch = url.match(/\.([a-z0-9]+)(\?|$)/i);
    if (urlMatch) {
      return urlMatch[1].toLowerCase();
    }

    // 从Content-Type推断
    if (contentType) {
      const typeMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
      };
      return typeMap[contentType] || 'bin';
    }

    return 'bin';
  }

  /**
   * 下载外部资产
   */
  private async downloadAsset(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      console.log(`[Asset Download] 下载资产: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.downloadTimeout,
        maxContentLength: this.maxFileSize,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';

      console.log(`[Asset Download] 下载成功: ${url}, 大小=${buffer.length} bytes, 类型=${contentType}`);

      return { buffer, contentType };
    } catch (error: any) {
      console.error(`[Asset Download] 下载失败: ${url}`, error.message);
      throw new Error(`下载失败: ${error.message}`);
    }
  }

  /**
   * 上传资产到COS
   */
  private async uploadAssetToCOS(
    uuid: string,
    url: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    if (!this.cosClient.isServiceEnabled()) {
      throw new Error('COS服务未启用');
    }

    try {
      // 生成COS路径
      const hash = this.hashUrl(url);
      const ext = this.getFileExtension(url, contentType);
      const type = this.getAssetType(url);

      // 路径格式: {uuid}/assets/{type}/{hash}.{ext}
      const key = `${uuid}/assets/${type}/${hash}.${ext}`;

      console.log(`[Asset Upload] 上传到COS: ${key}`);

      // 上传到COS
      const cosUrl = await this.cosClient.uploadFile(buffer, key, contentType);

      console.log(`[Asset Upload] 上传成功: ${cosUrl}`);

      return cosUrl;
    } catch (error: any) {
      console.error(`[Asset Upload] 上传失败:`, error.message);
      throw new Error(`上传失败: ${error.message}`);
    }
  }

  /**
   * 处理单个资产URL
   */
  async processAssetUrl(uuid: string, url: string): Promise<AssetInfo> {
    const asset: AssetInfo = {
      originalUrl: url,
      type: this.getAssetType(url),
    };

    try {
      // 检查是否为外部URL
      if (!this.isExternalUrl(url)) {
        console.log(`[Asset Process] 跳过非外部URL: ${url}`);
        asset.cosUrl = url; // 保持原样
        return asset;
      }

      // 检查缓存
      if (this.urlCache.has(url)) {
        console.log(`[Asset Process] 使用缓存: ${url}`);
        asset.cosUrl = this.urlCache.get(url);
        return asset;
      }

      // 下载资产
      const { buffer, contentType } = await this.downloadAsset(url);
      asset.size = buffer.length;
      asset.hash = this.hashUrl(url);

      // 上传到COS
      const cosUrl = await this.uploadAssetToCOS(uuid, url, buffer, contentType);
      asset.cosUrl = cosUrl;

      // 缓存结果
      this.urlCache.set(url, cosUrl);

      console.log(`[Asset Process] ✅ 处理成功: ${url} -> ${cosUrl}`);

      return asset;
    } catch (error: any) {
      console.error(`[Asset Process] ❌ 处理失败: ${url}`, error.message);
      asset.error = error.message;
      asset.cosUrl = url; // 失败时保持原URL
      return asset;
    }
  }

  /**
   * 批量处理资产URL
   */
  async processAssetUrls(uuid: string, urls: string[]): Promise<ProcessResult> {
    console.log(`[Asset Process] 开始批量处理: ${urls.length} 个资产`);

    const uniqueUrls = [...new Set(urls.filter(url => url && typeof url === 'string'))];

    const results = await Promise.all(
      uniqueUrls.map(url => this.processAssetUrl(uuid, url))
    );

    const success = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    console.log(`[Asset Process] 批量处理完成: 成功=${success}, 失败=${failed}`);

    return {
      success: success > 0,
      processed: success,
      failed,
      assets: results,
    };
  }

  /**
   * 从ChatMessage中提取所有资产URL
   */
  private extractUrlsFromMessage(message: any): string[] {
    const urls: string[] = [];

    // logo字段
    if (message.logo) {
      urls.push(message.logo);
    }

    // opt字段
    if (message.opt) {
      // imageUrl
      if (message.opt.imageUrl) {
        urls.push(message.opt.imageUrl);
      }

      // images数组
      if (Array.isArray(message.opt.images)) {
        urls.push(...message.opt.images);
      }

      // videoUrls数组
      if (Array.isArray(message.opt.videoUrls)) {
        urls.push(...message.opt.videoUrls.map((v: any) => v.url).filter(Boolean));
      }

      // imageUrls数组
      if (Array.isArray(message.opt.imageUrls)) {
        urls.push(...message.opt.imageUrls.map((v: any) => v.url).filter(Boolean));
      }
    }

    return urls.filter(url => url && typeof url === 'string');
  }

  /**
   * 替换ChatMessage中的URL
   */
  private replaceUrlsInMessage(message: any, urlMap: Map<string, string>): void {
    // logo字段
    if (message.logo && urlMap.has(message.logo)) {
      message.logo = urlMap.get(message.logo);
    }

    // opt字段
    if (message.opt) {
      // imageUrl
      if (message.opt.imageUrl && urlMap.has(message.opt.imageUrl)) {
        message.opt.imageUrl = urlMap.get(message.opt.imageUrl);
      }

      // images数组
      if (Array.isArray(message.opt.images)) {
        message.opt.images = message.opt.images.map((url: string) =>
          urlMap.get(url) || url
        );
      }

      // videoUrls数组
      if (Array.isArray(message.opt.videoUrls)) {
        message.opt.videoUrls = message.opt.videoUrls.map((v: any) => ({
          ...v,
          url: urlMap.get(v.url) || v.url
        }));
      }

      // imageUrls数组
      if (Array.isArray(message.opt.imageUrls)) {
        message.opt.imageUrls = message.opt.imageUrls.map((v: any) => ({
          ...v,
          url: urlMap.get(v.url) || v.url
        }));
      }
    }
  }

  /**
   * 处理整个ChatState,下载并替换所有外部资产URL
   */
  async processChatState(uuid: string, chatState: any): Promise<ProcessResult> {
    console.log(`[Asset Process] 开始处理ChatState, UUID=${uuid}`);

    if (!this.cosClient.isServiceEnabled()) {
      console.log('[Asset Process] COS服务未启用，跳过资产处理');
      return {
        success: true,
        processed: 0,
        failed: 0,
        assets: [],
      };
    }

    try {
      // 1. 提取所有URL
      const allUrls: string[] = [];

      if (chatState.chat && Array.isArray(chatState.chat)) {
        for (const conversation of chatState.chat) {
          if (conversation.data && Array.isArray(conversation.data)) {
            for (const message of conversation.data) {
              const urls = this.extractUrlsFromMessage(message);
              allUrls.push(...urls);
            }
          }
        }
      }

      if (allUrls.length === 0) {
        console.log('[Asset Process] 没有找到需要处理的资产URL');
        return {
          success: true,
          processed: 0,
          failed: 0,
          assets: [],
        };
      }

      console.log(`[Asset Process] 找到 ${allUrls.length} 个资产URL (包含重复)`);

      // 2. 批量处理URL
      const result = await this.processAssetUrls(uuid, allUrls);

      // 3. 构建URL映射表
      const urlMap = new Map<string, string>();
      for (const asset of result.assets) {
        if (asset.cosUrl) {
          urlMap.set(asset.originalUrl, asset.cosUrl);
        }
      }

      // 4. 替换ChatState中的所有URL
      if (chatState.chat && Array.isArray(chatState.chat)) {
        for (const conversation of chatState.chat) {
          if (conversation.data && Array.isArray(conversation.data)) {
            for (const message of conversation.data) {
              this.replaceUrlsInMessage(message, urlMap);
            }
          }
        }
      }

      console.log(`[Asset Process] ✅ ChatState处理完成: 成功=${result.processed}, 失败=${result.failed}`);

      return result;
    } catch (error: any) {
      console.error('[Asset Process] ❌ ChatState处理失败:', error);
      return {
        success: false,
        processed: 0,
        failed: 1,
        assets: [],
      };
    }
  }

  /**
   * 清除URL缓存
   */
  clearCache(): void {
    this.urlCache.clear();
    console.log('[Asset Process] 缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.urlCache.size,
      entries: Array.from(this.urlCache.entries()).slice(0, 10), // 返回前10条
    };
  }
}
