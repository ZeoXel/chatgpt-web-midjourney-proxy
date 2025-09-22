import { gptServerStore, homeStore } from "@/store";
import localforage from "localforage"
import { mlog } from "./mjapi";

localforage.config({
    driver      : localforage.INDEXEDDB, // Force WebSQL; same as using setDriver()
    name        : 'mj',
    version     : 1.0,
    size        : 4980736, // Size of database, in bytes. WebSQL-only for now.
    storeName   : 'mjkv', // Should be alphanumeric, with underscores.
    description : 'some description'
});

export async function saveImg( key:string, value:string ){
   await localforage.setItem( key, value )
}
export async function getImg( key:string ): Promise<any>
{
   return await localforage.getItem( key )
}

//本地存储使用了 
export const localSave= async (  key:string, value:any)=>{
    await localforage.setItem( key, value )
}
//本地存储获取
export const localGet= async( key:string )=>{
    return await localforage.getItem( key )
}

export const localSaveAny = async( value:any,key?:string )=>{ 
    if(!key) key=`MJ:r:${Date.now()}:${Math.floor(Math.random() * 100)}`  ;
    await localSave(key,value);
    return key;
}


export function img2base64(img:any) {
    let canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    let ctx = canvas.getContext('2d');
    if( ! ctx) return "";
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg');
}

export function url2base64More(url:string,key?:string){
    return new Promise<{key:string,base64:string}>((resolve, reject) => {

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload=()=>{ 
            const base64 = img2base64(img) ; 
            localSaveAny(base64,key).then(d=>resolve({key:d, base64})).catch(e=>reject(e));
        }
        img.onerror=(e)=>reject(e);
        img.src =  url;
    });
    
}

export const url2base64= async (url:string,key?:string)=>{
    try{
        return await url2base64More (url,key);
    }catch(e){
        return await url2base64More( wsrvUrl(url) ,key);
    }
}

// 改进的图片URL处理，支持多种代理方案
export const wsrvUrl=(url:string)=>{
    const arr = url.split(/([a-z\-]+)ttachments/ig, 3 );
    if( arr.length==3){
        url= `https://cdn.discordapp.com/${arr[1]}ttachments`+ arr[2];
    }
    return `https://wsrv.nl/?url=`+ encodeURIComponent(url);
}

// 备用代理服务列表
const PROXY_SERVICES = [
    (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://proxy.cors.sh/${url}`,
    (url: string) => url // 最后尝试原始URL
];

// URL缓存，避免重复检测
const urlCache = new Map<string, string>();

// 智能图片URL处理，支持多层错误回退
export const smartImageUrl = async (originalUrl: string): Promise<string> => {
    // 检查缓存
    if (urlCache.has(originalUrl)) {
        return urlCache.get(originalUrl)!;
    }

    // 智能策略：根据URL类型直接选择最佳代理，减少无效请求
    let bestUrl = originalUrl;

    // Discord CDN 直接可用，优先使用
    if (originalUrl.includes('cdn.discordapp.com')) {
        bestUrl = originalUrl;
    }
    // Midjourney云存储，优先使用wsrv
    else if (originalUrl.includes('midjourneycloud.com') || originalUrl.includes('image2.midjourneycloud.com')) {
        bestUrl = wsrvUrl(originalUrl);
    }
    // 阿里云OSS，多数情况下需要代理
    else if (originalUrl.includes('mj-oss.oss-cn-shanghai.aliyuncs.com')) {
        // 这些URL通常需要代理，直接使用wsrv
        bestUrl = wsrvUrl(originalUrl);
    }
    // 其他URL，使用默认的wsrv处理
    else {
        bestUrl = wsrvUrl(originalUrl);
    }

    // 缓存结果并返回
    urlCache.set(originalUrl, bestUrl);
    return bestUrl;
}

export const mjImgUrl= (url:string)=>{
    if (gptServerStore.myData.MJ_CDN_WSRV || homeStore.myData.session.isWsrv ) return wsrvUrl(url);
    return url;
}

// 新的画廊专用数据结构
interface GalleryImage {
    id: string;                    // 唯一标识
    type: 'mj-upscale' | 'dalle' | 'other';  // 图片类型
    url: string;                   // 图片URL
    action: string;                // 操作类型 (UPSCALE, DALL-E-3等)
    model: string;                 // 模型名称
    timestamp: number;             // 统一时间戳
    mjID?: string;                 // MJ ID (仅MJ图片)
    prompt: string;                // 提示词
}

// 专用画廊存储键
const GALLERY_STORAGE_KEY = 'MJ:gallery:images';

// 获取所有画廊图片 (新逻辑：只返回最终结果)
export const getGalleryImages = async (): Promise<GalleryImage[]> => {
    try {
        console.log('🗂️ 从存储加载画廊图片...');
        const images = await localGet(GALLERY_STORAGE_KEY) as GalleryImage[] || [];
        console.log(`📊 画廊存储中有 ${images.length} 张图片`);
        // 按时间降序排序，确保最新图片在前
        return images.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        mlog('Error loading gallery images:', error);
        console.log('❌ 画廊加载错误:', error);
        return [];
    }
}

// 添加图片到画廊 (智能筛选)
export const addToGallery = async (chat: Chat.Chat): Promise<void> => {
    try {
        // 筛选规则：只保存最终结果
        if (!shouldAddToGallery(chat)) {
            return;
        }

        const galleryImage = createGalleryImage(chat);
        if (!galleryImage) return;

        const images = await getGalleryImages();

        // 检查是否已存在 (避免重复)
        const existingIndex = images.findIndex(img =>
            img.id === galleryImage.id ||
            (img.mjID && img.mjID === galleryImage.mjID)
        );

        if (existingIndex >= 0) {
            // 更新已存在的图片
            images[existingIndex] = galleryImage;
        } else {
            // 添加新图片
            images.unshift(galleryImage);
        }

        // 限制画廊大小 (最多保存1000张图)
        const limitedImages = images.slice(0, 1000);

        await localSave(GALLERY_STORAGE_KEY, limitedImages);
        mlog('Gallery updated:', galleryImage.type, galleryImage.action);

        // 预加载新图片到缓存 (异步执行，不阻塞主流程)
        if (galleryImage.url && !galleryImage.url.startsWith('data:')) {
            const cacheKey = `img:${galleryImage.id}`;

            // 检查是否已缓存
            localGet(cacheKey).then(cached => {
                if (!cached) {
                    mlog('开始预加载图片到缓存:', galleryImage.id);
                    // 异步缓存，不阻塞主流程
                    url2base64(galleryImage.url, cacheKey)
                        .then(result => {
                            if (result && result.base64) {
                                mlog('图片预加载缓存成功:', galleryImage.id);
                            }
                        })
                        .catch(error => {
                            mlog('图片预加载缓存失败:', galleryImage.id, error);
                        });
                }
            }).catch(e => {
                // 忽略缓存检查错误，继续尝试缓存
                mlog('缓存检查失败，跳过预加载:', galleryImage.id);
            });
        }
    } catch (error) {
        mlog('Error adding to gallery:', error);
    }
}

// 判断是否应该添加到画廊
function shouldAddToGallery(chat: Chat.Chat): boolean {
    // DALL-E 系列：全部保存
    if (chat.model && chat.model.includes('dall-e')) {
        return !!(chat.opt?.imageUrl);
    }

    // Midjourney：只保存 UPSCALE 结果 (单张图)
    if (chat.mjID && chat.opt?.action) {
        return chat.opt.action === 'UPSCALE' &&
               chat.opt.status === 'SUCCESS' &&
               !!(chat.opt.imageUrl || (chat.opt.imageUrls && chat.opt.imageUrls.length === 1));
    }

    // 其他AI模型的单张图片结果
    if (chat.opt?.imageUrl && !chat.mjID) {
        return true;
    }

    return false;
}

// 创建画廊图片对象
function createGalleryImage(chat: Chat.Chat): GalleryImage | null {
    try {
        let imageUrl = '';
        let type: GalleryImage['type'] = 'other';

        // 确定图片类型和URL
        if (chat.model && chat.model.includes('dall-e')) {
            type = 'dalle';
            imageUrl = chat.opt?.imageUrl || '';
        } else if (chat.mjID && chat.opt?.action === 'UPSCALE') {
            type = 'mj-upscale';
            // 优先使用单张图片URL
            imageUrl = chat.opt?.imageUrl ||
                      (chat.opt?.imageUrls && chat.opt.imageUrls.length === 1 ? chat.opt.imageUrls[0].url : '');
        } else if (chat.opt?.imageUrl) {
            imageUrl = chat.opt.imageUrl;
        }

        if (!imageUrl) return null;

        // 生成唯一ID
        const id = chat.mjID || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return {
            id,
            type,
            url: imageUrl,
            action: chat.opt?.action || 'UNKNOWN',
            model: chat.model || 'unknown',
            timestamp: chat.opt?.startTime || Date.now(),
            mjID: chat.mjID,
            prompt: chat.requestOptions?.prompt || chat.text || ''
        };
    } catch (error) {
        mlog('Error creating gallery image:', error);
        return null;
    }
}

// 从画廊移除图片
export const removeFromGallery = async (imageId: string): Promise<void> => {
    try {
        const images = await getGalleryImages();
        const filteredImages = images.filter(img => img.id !== imageId);
        await localSave(GALLERY_STORAGE_KEY, filteredImages);
    } catch (error) {
        mlog('Error removing from gallery:', error);
    }
}

// 清空画廊
export const clearGallery = async (): Promise<void> => {
    try {
        await localSave(GALLERY_STORAGE_KEY, []);
    } catch (error) {
        mlog('Error clearing gallery:', error);
    }
}

// 兼容旧版本：扫描聊天记录并迁移到新画廊
export const getMjAll = async (ChatState: Chat.ChatState) => {
    let rz: Chat.Chat[] = []
    ChatState.chat.forEach(v => {
        v.data.forEach(chat => {
            if (chat.mjID) {
                rz.push(chat);
            }
        })
    });
    return rz;
}

// 迁移函数：将旧数据迁移到新画廊格式
export const migrateToNewGallery = async (ChatState: Chat.ChatState): Promise<void> => {
    try {
        const existingImages = await getGalleryImages();
        if (existingImages.length > 0) {
            mlog('Gallery already has images, skipping migration');
            return;
        }

        mlog('Starting gallery migration...');
        let migratedCount = 0;

        for (const conversation of ChatState.chat) {
            for (const chat of conversation.data) {
                if (shouldAddToGallery(chat)) {
                    await addToGallery(chat);
                    migratedCount++;
                }
            }
        }

        mlog(`Gallery migration completed: ${migratedCount} images migrated`);
    } catch (error) {
        mlog('Error during gallery migration:', error);
    }
}