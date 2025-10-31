/**
 * 安全的图片下载工具函数
 * 解决现代浏览器对 data URL 下载的限制问题
 */

/**
 * 下载图片文件
 * @param src 图片源地址（支持 data URL、blob URL、http URL）
 * @param filename 下载文件名（可选）
 */
export function downloadImage(src: string, filename?: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 如果是 data URL，转换为 Blob
      if (src.startsWith('data:')) {
        downloadDataURL(src, filename).then(resolve).catch(() => resolve(false));
        return;
      }
      
      // 如果是 http/https URL，使用 fetch 下载
      if (src.startsWith('http')) {
        downloadHttpURL(src, filename).then(resolve).catch(() => resolve(false));
        return;
      }
      
      // 如果是 blob URL，直接下载
      if (src.startsWith('blob:')) {
        downloadBlobURL(src, filename).then(resolve).catch(() => resolve(false));
        return;
      }
      
      resolve(false);
    } catch (error) {
      console.error('下载失败:', error);
      resolve(false);
    }
  });
}

/**
 * 下载 data URL 图片
 */
async function downloadDataURL(dataURL: string, filename?: string): Promise<boolean> {
  try {
    // 解析 data URL
    const [header, data] = dataURL.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    // 转换为 Blob
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // 生成文件名
    const extension = mimeType.split('/')[1] || 'jpg';
    const finalFilename = filename || `image_${Date.now()}.${extension}`;
    
    return downloadBlob(blob, finalFilename);
  } catch (error) {
    console.error('Data URL 下载失败:', error);
    return false;
  }
}

/**
 * 下载 HTTP URL 图片
 */
async function downloadHttpURL(url: string, filename?: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('网络请求失败');
    
    const blob = await response.blob();
    
    // 从 URL 或响应头获取文件名
    const finalFilename = filename || 
                         getFilenameFromURL(url) || 
                         getFilenameFromResponse(response) ||
                         `image_${Date.now()}.jpg`;
    
    return downloadBlob(blob, finalFilename);
  } catch (error) {
    console.error('HTTP URL 下载失败:', error);
    return false;
  }
}

/**
 * 下载 Blob URL 图片
 */
async function downloadBlobURL(blobURL: string, filename?: string): Promise<boolean> {
  try {
    const response = await fetch(blobURL);
    if (!response.ok) throw new Error('Blob URL 获取失败');
    
    const blob = await response.blob();
    const finalFilename = filename || `image_${Date.now()}.jpg`;
    
    return downloadBlob(blob, finalFilename);
  } catch (error) {
    console.error('Blob URL 下载失败:', error);
    return false;
  }
}

/**
 * 通用 Blob 下载函数
 */
function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    // 创建临时 URL
    const url = URL.createObjectURL(blob);
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // 添加到 DOM，点击，然后移除
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理临时 URL
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Blob 下载失败:', error);
    return false;
  }
}

/**
 * 从 URL 提取文件名
 */
function getFilenameFromURL(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop();
    return filename && filename.includes('.') ? filename : null;
  } catch {
    return null;
  }
}

/**
 * 从响应头提取文件名
 */
function getFilenameFromResponse(response: Response): string | null {
  const contentDisposition = response.headers.get('content-disposition');
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '');
    }
  }
  return null;
}

/**
 * 下载视频文件
 * @param src 视频源地址（支持 http URL、blob URL）
 * @param filename 下载文件名（可选）
 */
export function downloadVideo(src: string, filename?: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 如果是 http/https URL，使用 fetch 下载
      if (src.startsWith('http')) {
        downloadHttpURL(src, filename || `video_${Date.now()}.mp4`).then(resolve).catch(() => resolve(false));
        return;
      }

      // 如果是 blob URL，直接下载
      if (src.startsWith('blob:')) {
        downloadBlobURL(src, filename || `video_${Date.now()}.mp4`).then(resolve).catch(() => resolve(false));
        return;
      }

      resolve(false);
    } catch (error) {
      console.error('视频下载失败:', error);
      resolve(false);
    }
  });
}

/**
 * 检查浏览器是否支持下载功能
 */
export function isBrowserDownloadSupported(): boolean {
  return !!(document.createElement('a').download !== undefined &&
           window.URL && window.URL.createObjectURL);
}