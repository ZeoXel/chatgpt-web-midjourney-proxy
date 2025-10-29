/**
 * 图片压缩工具
 * 用于减小图片体积，避免请求体过大导致上传失败
 */

export interface CompressOptions {
  maxWidth?: number;      // 最大宽度，默认 1920
  maxHeight?: number;     // 最大高度，默认 1920
  quality?: number;       // 压缩质量 0-1，默认 0.8
  mimeType?: string;      // 输出格式，默认 'image/jpeg'
  maxSizeMB?: number;     // 最大文件大小（MB），默认 2
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns Promise<Blob> 压缩后的图片 Blob
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    mimeType = 'image/jpeg',
    maxSizeMB = 2,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const img = new Image();

      img.onload = () => {
        // 计算缩放比例
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        // 创建 Canvas 进行压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取 Canvas 上下文'));
          return;
        }

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为 Blob
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }

            // 检查压缩后大小
            const sizeMB = blob.size / (1024 * 1024);

            // 如果仍然过大，递归降低质量
            if (sizeMB > maxSizeMB && quality > 0.1) {
              try {
                const newBlob = await compressImage(file, {
                  ...options,
                  quality: quality - 0.1,
                });
                resolve(newBlob);
              } catch (error) {
                reject(error);
              }
              return;
            }

            resolve(blob);
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 将 Blob 转换为 Base64
 * @param blob Blob 对象
 * @returns Promise<string> Base64 字符串
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 获取压缩后的 Base64 图片
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns Promise<string> Base64 字符串
 */
export async function getCompressedBase64(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const compressedBlob = await compressImage(file, options);
  return blobToBase64(compressedBlob);
}
