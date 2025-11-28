/**
 * 统一存储服务
 *
 * 核心设计理念:
 * 1. 简洁 - 单一COS存储,放弃Supabase等复杂方案
 * 2. 用户隔离 - 基于token的目录隔离
 * 3. 跨平台 - 可选R2备份,不强制依赖
 * 4. 高效 - 最小化中间件,直接上传
 */

import { TencentCOSClient } from './cos-client';
import { v4 as uuidv4 } from 'uuid';
import md5 from 'md5';

interface UploadOptions {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  userId?: string;
}

interface UploadResult {
  success: boolean;
  url: string;
  key: string;
  size: number;
  storage: string;
}

/**
 * 统一存储服务类
 */
export class UnifiedStorageService {
  private cosClient: TencentCOSClient;
  private enableR2Backup: boolean;

  constructor() {
    this.cosClient = new TencentCOSClient();
    this.enableR2Backup = process.env.ENABLE_R2_BACKUP === 'true';
  }

  /**
   * 上传文件到COS
   * @param options 上传选项
   * @returns 上传结果
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { buffer, originalName, mimeType, userId } = options;

    // 构建存储路径
    const key = this.buildStorageKey(originalName, mimeType, userId);

    try {
      // 上传到腾讯云COS
      const url = await this.cosClient.uploadFile(buffer, key, mimeType);

      console.log('[Unified Storage] 上传成功:', {
        key,
        size: buffer.length,
        userId: userId || 'anonymous',
      });

      // 可选: 异步备份到R2(不阻塞主流程)
      if (this.enableR2Backup) {
        this.backupToR2(buffer, key, mimeType).catch(err => {
          console.error('[R2 Backup] 备份失败:', err.message);
        });
      }

      return {
        success: true,
        url,
        key,
        size: buffer.length,
        storage: 'tencent-cos',
      };
    } catch (error: any) {
      console.error('[Unified Storage] 上传失败:', error);
      throw new Error(`上传失败: ${error.message}`);
    }
  }

  /**
   * 构建存储Key
   * 路径格式: users/{userId}/{category}/{date}/{filename}
   */
  private buildStorageKey(
    originalName: string,
    mimeType: string,
    userId?: string
  ): string {
    // 确定文件类别
    const category = this.getCategoryFromMimeType(mimeType);

    // 日期目录 (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];

    // 用户前缀
    const userPrefix = userId ? `users/${this.sanitizeUserId(userId)}` : 'users/anonymous';

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = this.getFileExtension(originalName);
    const filename = `${timestamp}-${randomStr}${ext}`;

    return `${userPrefix}/${category}/${date}/${filename}`;
  }

  /**
   * 根据MIME类型确定文件类别
   */
  private getCategoryFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('application/pdf')) return 'documents';
    return 'files';
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }

  /**
   * 清理userId,生成安全的目录名
   * 使用MD5哈希确保隐私和安全
   */
  private sanitizeUserId(userId: string): string {
    // 如果userId看起来像token(长字符串),使用MD5哈希
    if (userId.length > 32) {
      return md5(userId).substring(0, 16);
    }
    // 否则清理特殊字符
    return userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
  }

  /**
   * 备份到Cloudflare R2(可选)
   */
  private async backupToR2(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    // TODO: 实现R2备份逻辑
    // 这里预留接口,后续可选实现
    console.log('[R2 Backup] 备份任务已加入队列:', key);
  }

  /**
   * 列出用户文件
   */
  async listUserFiles(userId: string, category?: string): Promise<any[]> {
    const sanitizedUserId = this.sanitizeUserId(userId);
    const prefix = category
      ? `users/${sanitizedUserId}/${category}/`
      : `users/${sanitizedUserId}/`;

    return await this.cosClient.listFiles(prefix, 100);
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<void> {
    return await this.cosClient.deleteFile(key);
  }

  /**
   * 获取文件访问URL
   */
  getFileUrl(key: string): string {
    return this.cosClient.getDownloadUrl(key);
  }
}
