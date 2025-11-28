/**
 * 腾讯云COS客户端封装
 * 提供文件上传、下载、列表、删除等基础功能
 */

import COS from 'cos-nodejs-sdk-v5';

interface COSConfig {
  SecretId: string;
  SecretKey: string;
  Bucket: string;
  Region: string;
  Domain?: string;
}

export class TencentCOSClient {
  private cos: COS;
  private bucket: string;
  private region: string;
  private domain: string;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.ENABLE_TENCENT_COS === 'true';

    if (!this.isEnabled) {
      console.log('[COS Client] 腾讯云COS未启用');
      return;
    }

    const secretId = process.env.COS_SECRET_ID;
    const secretKey = process.env.COS_SECRET_KEY;
    this.bucket = process.env.COS_BUCKET || '';
    this.region = process.env.COS_REGION || 'ap-guangzhou';
    this.domain = process.env.COS_DOMAIN || '';

    if (!secretId || !secretKey || !this.bucket) {
      throw new Error('缺少腾讯云COS配置：COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET');
    }

    this.cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });

    console.log('[COS Client] 初始化成功', {
      bucket: this.bucket,
      region: this.region,
    });
  }

  /**
   * 检查COS服务是否启用
   */
  public isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 测试连接 - 列出存储桶
   */
  public async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    if (!this.isEnabled) {
      return {
        success: false,
        message: '腾讯云COS服务未启用，请在.env中设置 ENABLE_TENCENT_COS=true',
      };
    }

    try {
      // 测试1: 获取服务列表
      const serviceResult = await new Promise<any>((resolve, reject) => {
        this.cos.getService((err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      console.log('[COS Test] 服务列表获取成功:', serviceResult.Buckets?.length || 0, '个存储桶');

      // 测试2: 检查指定存储桶是否存在
      const bucketExists = serviceResult.Buckets?.some((b: any) => b.Name === this.bucket);

      if (!bucketExists) {
        return {
          success: false,
          message: `存储桶 "${this.bucket}" 不存在`,
          data: {
            availableBuckets: serviceResult.Buckets?.map((b: any) => b.Name) || [],
          },
        };
      }

      // 测试3: 尝试列出存储桶中的对象
      const objectsResult = await new Promise<any>((resolve, reject) => {
        this.cos.getBucket(
          {
            Bucket: this.bucket,
            Region: this.region,
            MaxKeys: 10,
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });

      return {
        success: true,
        message: '腾讯云COS连接成功',
        data: {
          bucket: this.bucket,
          region: this.region,
          objectCount: objectsResult.Contents?.length || 0,
          totalBuckets: serviceResult.Buckets?.length || 0,
        },
      };
    } catch (error: any) {
      console.error('[COS Test] 连接测试失败:', error);
      return {
        success: false,
        message: `连接失败: ${error.message || error}`,
        data: {
          error: error.code || 'UNKNOWN',
          details: error.message,
        },
      };
    }
  }

  /**
   * 上传文件（Buffer）
   */
  public async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('腾讯云COS服务未启用');
    }

    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        },
        (err, data) => {
          if (err) {
            console.error('[COS Upload] 上传失败:', err);
            reject(err);
          } else {
            const url = this.domain
              ? `${this.domain}/${key}`
              : `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
            console.log('[COS Upload] 上传成功:', url);
            resolve(url);
          }
        }
      );
    });
  }

  /**
   * 获取预签名上传URL（用于前端直传）
   */
  public async getPresignedUploadUrl(
    key: string,
    expires: number = 3600
  ): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('腾讯云COS服务未启用');
    }

    return new Promise((resolve, reject) => {
      this.cos.getObjectUrl(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Method: 'PUT',
          Expires: expires,
          Sign: true,
        },
        (err, data) => {
          if (err) {
            console.error('[COS Presigned] 获取预签名URL失败:', err);
            reject(err);
          } else {
            console.log('[COS Presigned] 预签名URL生成成功');
            resolve(data.Url);
          }
        }
      );
    });
  }

  /**
   * 列出文件
   */
  public async listFiles(prefix: string = '', maxKeys: number = 100): Promise<any[]> {
    if (!this.isEnabled) {
      throw new Error('腾讯云COS服务未启用');
    }

    return new Promise((resolve, reject) => {
      this.cos.getBucket(
        {
          Bucket: this.bucket,
          Region: this.region,
          Prefix: prefix,
          MaxKeys: maxKeys,
        },
        (err, data) => {
          if (err) {
            console.error('[COS List] 列出文件失败:', err);
            reject(err);
          } else {
            resolve(data.Contents || []);
          }
        }
      );
    });
  }

  /**
   * 删除文件
   */
  public async deleteFile(key: string): Promise<void> {
    if (!this.isEnabled) {
      throw new Error('腾讯云COS服务未启用');
    }

    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err, data) => {
          if (err) {
            console.error('[COS Delete] 删除文件失败:', err);
            reject(err);
          } else {
            console.log('[COS Delete] 删除文件成功:', key);
            resolve();
          }
        }
      );
    });
  }

  /**
   * 下载文件
   */
  public async downloadFile(key: string): Promise<Buffer> {
    if (!this.isEnabled) {
      throw new Error('腾讯云COS服务未启用');
    }

    return new Promise((resolve, reject) => {
      this.cos.getObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err, data) => {
          if (err) {
            console.error('[COS Download] 下载文件失败:', err);
            reject(err);
          } else {
            console.log('[COS Download] 下载成功:', key);
            resolve(data.Body as Buffer);
          }
        }
      );
    });
  }

  /**
   * 获取文件下载URL
   */
  public getDownloadUrl(key: string): string {
    if (this.domain) {
      return `${this.domain}/${key}`;
    }
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
  }
}
