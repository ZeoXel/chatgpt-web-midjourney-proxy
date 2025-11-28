/**
 * COS对话历史存储服务
 *
 * 功能:
 * - 将用户对话历史存储到腾讯云COS
 * - 存储路径: {uuid}/chat/conversations.json
 * - 支持压缩和版本控制
 */

import { TencentCOSClient } from './cos-client';
import { AssetProcessor } from './asset-processor';
import { z } from 'zod';
import pako from 'pako';

interface ChatMessage {
  dateTime: string;
  text: string;
  inversion?: boolean;
  error?: boolean;
  loading?: boolean;
  model?: string;
  mjID?: string;
  opt?: {
    progress?: string;
    seed?: number;
    imageUrl?: string;
    status?: string;
    images?: string[];
    promptEn?: string;
    buttons?: any[];
    action?: string;
    duration?: number;
    lkey?: string;
    videoUrls?: Array<{ url: string }>;
    imageUrls?: Array<{ url: string }>;
  };
  originalConfig?: any;
  uuid?: number;
  index?: number;
  myid?: string;
  logo?: string;
}

interface ChatHistory {
  title: string;
  isEdit: boolean;
  uuid: number;
}

interface ChatState {
  active: number | null;
  usingContext: boolean;
  history: ChatHistory[];
  chat: Array<{ uuid: number; data: ChatMessage[] }>;
}

export class ChatStorageService {
  private cosClient: TencentCOSClient;
  private assetProcessor: AssetProcessor;
  private enableCompression: boolean;
  private enableAssetProcessing: boolean;

  constructor() {
    this.cosClient = new TencentCOSClient();
    this.assetProcessor = new AssetProcessor();
    this.enableCompression = true; // 默认启用压缩
    this.enableAssetProcessing = process.env.ENABLE_ASSET_PROCESSING !== 'false'; // 默认启用资产处理
  }

  /**
   * 保存对话历史到COS
   * @param uuid 用户UUID
   * @param state 对话状态
   * @returns 成功返回COS URL
   */
  async saveConversations(uuid: string, state: ChatState): Promise<string> {
    if (!this.cosClient.isServiceEnabled()) {
      throw new Error('COS服务未启用');
    }

    try {
      console.log(`[Chat Storage] 保存用户对话: ${uuid}`);

      // 0. 处理资产（下载外部URL并上传到COS）
      if (this.enableAssetProcessing) {
        console.log(`[Chat Storage] 开始处理资产...`);
        const assetResult = await this.assetProcessor.processChatState(uuid, state);
        console.log(`[Chat Storage] 资产处理完成: 成功=${assetResult.processed}, 失败=${assetResult.failed}`);

        // 0.1. 更新images.json中的cos_url（仅针对图片资产）
        if (assetResult.assets && assetResult.assets.length > 0) {
          const imageAssets = assetResult.assets.filter(asset =>
            asset.type === 'image' && asset.originalUrl && asset.cosUrl
          );

          if (imageAssets.length > 0) {
            console.log(`[Chat Storage] 🔄 更新 ${imageAssets.length} 个图片记录的COS URLs...`);
            try {
              const urlMappings = imageAssets.map(asset => ({
                originalUrl: asset.originalUrl,
                cosUrl: asset.cosUrl!
              }));

              const response = await fetch('http://localhost:3002/api/image-storage/update-cos-urls', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userUuid: uuid, urlMappings })
              });

              if (response.ok) {
                const result = await response.json();
                console.log(`[Chat Storage] ✅ COS URLs更新完成: ${result.updatedCount}/${imageAssets.length}`);
              } else {
                const error = await response.text();
                console.warn(`[Chat Storage] ⚠️ COS URLs更新失败: ${error}`);
              }
            } catch (error) {
              console.warn(`[Chat Storage] ⚠️ COS URLs更新请求失败:`, error);
            }
          }
        }
      } else {
        console.log(`[Chat Storage] 资产处理已禁用，跳过`);
      }

      // 1. 序列化为JSON
      const jsonData = JSON.stringify(state, null, 0); // 不格式化,减少体积
      let buffer = Buffer.from(jsonData, 'utf-8');

      // 2. 压缩数据(可选)
      if (this.enableCompression && buffer.length > 1024) {
        const compressed = pako.gzip(buffer);
        buffer = Buffer.from(compressed);
        console.log(`[Chat Storage] 压缩: ${jsonData.length} → ${buffer.length} bytes`);
      }

      // 3. 构建COS路径
      const key = `${uuid}/chat/conversations.json${this.enableCompression ? '.gz' : ''}`;

      // 4. 上传到COS
      const url = await this.cosClient.uploadFile(
        buffer,
        key,
        this.enableCompression ? 'application/gzip' : 'application/json'
      );

      console.log(`[Chat Storage] 保存成功: ${url}`);
      return url;

    } catch (error: any) {
      console.error('[Chat Storage] 保存失败:', error);
      throw new Error(`对话历史保存失败: ${error.message}`);
    }
  }

  /**
   * 从COS加载对话历史
   * @param uuid 用户UUID
   * @returns 对话状态
   */
  async loadConversations(uuid: string): Promise<ChatState | null> {
    if (!this.cosClient.isServiceEnabled()) {
      throw new Error('COS服务未启用');
    }

    try {
      console.log(`[Chat Storage] 加载用户对话: ${uuid}`);

      // 1. 尝试加载压缩版本
      let key = `${uuid}/chat/conversations.json.gz`;
      let files = await this.cosClient.listFiles(key, 1);

      // 2. 如果压缩版本不存在,尝试未压缩版本
      if (files.length === 0) {
        key = `${uuid}/chat/conversations.json`;
        files = await this.cosClient.listFiles(key, 1);
      }

      if (files.length === 0) {
        console.log(`[Chat Storage] 未找到对话历史: ${uuid}`);
        return null;
      }

      // 3. 下载文件 (使用COS SDK)
      const buffer = await this.cosClient.downloadFile(key);
      console.log(`[Chat Storage] 下载数据: ${key}, 大小=${buffer.length}, 前10字节=${buffer.slice(0, 10).toString('hex')}`);

      // 4. 解压缩(如果需要)
      let jsonData: string;
      if (key.endsWith('.gz')) {
        try {
          const decompressed = pako.ungzip(buffer);
          jsonData = new TextDecoder().decode(decompressed);
        } catch (err) {
          // 如果解压失败,可能COS已自动解压,直接读取
          console.log('[Chat Storage] 解压失败,尝试直接解析:', err.message);
          jsonData = buffer.toString('utf-8');
        }
      } else {
        jsonData = buffer.toString('utf-8');
      }

      // 5. 解析JSON
      const state: ChatState = JSON.parse(jsonData);

      console.log(`[Chat Storage] 加载成功: ${state.history.length} 个对话`);
      return state;

    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('NoSuchKey') || errorMessage.includes('404')) {
        console.log(`[Chat Storage] 对话历史不存在: ${uuid}`);
        return null;
      }
      console.error('[Chat Storage] 加载失败:', error);
      throw new Error(`对话历史加载失败: ${errorMessage}`);
    }
  }

  /**
   * 删除用户对话历史
   * @param uuid 用户UUID
   */
  async deleteConversations(uuid: string): Promise<void> {
    if (!this.cosClient.isServiceEnabled()) {
      throw new Error('COS服务未启用');
    }

    try {
      console.log(`[Chat Storage] 删除用户对话: ${uuid}`);

      // 删除压缩版本
      const keyGz = `${uuid}/chat/conversations.json.gz`;
      const key = `${uuid}/chat/conversations.json`;

      await Promise.all([
        this.cosClient.deleteFile(keyGz).catch(() => {}),
        this.cosClient.deleteFile(key).catch(() => {})
      ]);

      console.log(`[Chat Storage] 删除成功: ${uuid}`);
    } catch (error: any) {
      console.error('[Chat Storage] 删除失败:', error);
      throw new Error(`对话历史删除失败: ${error.message}`);
    }
  }

  /**
   * 获取用户对话统计信息
   * @param uuid 用户UUID
   */
  async getConversationStats(uuid: string): Promise<{
    exists: boolean;
    size?: number;
    lastModified?: string;
    conversationCount?: number;
    messageCount?: number;
  }> {
    if (!this.cosClient.isServiceEnabled()) {
      throw new Error('COS服务未启用');
    }

    try {
      const key = `${uuid}/chat/conversations.json.gz`;
      const files = await this.cosClient.listFiles(key, 1);

      if (files.length === 0) {
        // 尝试未压缩版本
        const keyUncompressed = `${uuid}/chat/conversations.json`;
        const filesUncompressed = await this.cosClient.listFiles(keyUncompressed, 1);

        if (filesUncompressed.length === 0) {
          return { exists: false };
        }

        const file = filesUncompressed[0];
        return {
          exists: true,
          size: file.Size,
          lastModified: file.LastModified
        };
      }

      const file = files[0];

      // 尝试加载并统计
      const state = await this.loadConversations(uuid);

      return {
        exists: true,
        size: file.Size,
        lastModified: file.LastModified,
        conversationCount: state?.history.length || 0,
        messageCount: state?.chat.reduce((sum, c) => sum + c.data.length, 0) || 0
      };

    } catch (error: any) {
      console.error('[Chat Storage] 统计失败:', error);
      return { exists: false };
    }
  }
}
