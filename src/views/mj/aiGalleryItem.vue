<script setup lang="ts">
import { LazyImg, Waterfall } from 'vue-waterfall-plugin-next'
import 'vue-waterfall-plugin-next/dist/style.css'
//import { ajax } from '@/api'
import {ref,nextTick} from "vue"
import {NSpin ,NEmpty,NImage, NTag, NButton, NPopconfirm, useMessage } from 'naive-ui'
import { deleteMJImageFromCOS } from '@/api/mjStorage' 
//import {copyText3} from "@/utils/format";
//import { copyText } from 'vue3-clipboard'
//import { copyToClip } from "@/utils/copy";
//import AiMsg from "@/views/aidutu/aiMsg.vue";
import { homeStore ,useChatStore} from "@/store"
import { useBasicLayout } from '@/hooks/useBasicLayout'
//import { ViewCard } from 'vue-waterfall-plugin-next/dist/types/types/waterfall'
import { getMjAll, localGet, mlog ,loadGallery, url2base64, wsrvUrl, getGalleryImages, getGalleryImagesWithDB, addToGallery, migrateToNewGallery, smartImageUrl, localSave } from '@/api'
import localforage from 'localforage'

// 限制日志输出，仅在开发环境
const debugLog = process.env.NODE_ENV === 'development' ? mlog : () => {}
 
const chatStore = useChatStore()

const { isMobile } = useBasicLayout()

const message = useMessage()

const emit = defineEmits(['close']);
//import {hom}

const st =ref({show:true ,showImg:'' ,isLoad:false, deleting: false });

const showImg= ref<typeof NImage>();


const list = ref<any[]>([])

// 删除图片
const handleDelete = async (item: any, event: Event) => {
  event.stopPropagation(); // 防止触发图片点击事件

  if (st.value.deleting) {
    return; // 防止重复点击
  }

  try {
    st.value.deleting = true;

    console.log('[Gallery Delete] 开始删除图片:', {
      mjID: item.mjID,
      prompt: item.prompt?.substring(0, 50)
    });

    // 调用删除API（会自动删除JSON记录和COS文件）
    await deleteMJImageFromCOS(item.mjID);

    // 从列表中移除
    const index = list.value.findIndex(img => img.mjID === item.mjID);
    if (index > -1) {
      list.value.splice(index, 1);
      console.log('[Gallery Delete] ✅ 已从列表移除');
    }

    message.success('删除成功');

  } catch (error: any) {
    console.error('[Gallery Delete] ❌ 删除失败:', error);
    message.error(`删除失败: ${error.message || '未知错误'}`);
  } finally {
    st.value.deleting = false;
  }
}

const breakpoints= {
  2000: { //当屏幕宽度小于等于1200
    rowPerView: 6,
  },
  1600: { //当屏幕宽度小于等于1200
    rowPerView: 5,
  },
  1200: { //当屏幕宽度小于等于1200
    rowPerView: 4,
  },
  800: { //当屏幕宽度小于等于800
    rowPerView: 3,
  },
  500: { //当屏幕宽度小于等于500
    rowPerView: 2,
  }
}

const loadImg= ()=>{
    console.log('🚀 [Gallery] 初始化画廊加载...');

    // 快速统计本地图片数量（仅用于日志）
    let localImageCount = 0;
    for (const conversation of chatStore.$state.chat) {
        for (const message of conversation.data) {
            if (message.mjID || (message.opt && message.opt.imageUrl)) {
                localImageCount++;
                if (localImageCount > 0) break;
            }
        }
        if (localImageCount > 0) break;
    }

    console.log(`📊 [Gallery] 本地聊天记录中发现 ${localImageCount} 张图片`);

    // 始终尝试从数据库+本地加载（即使本地为空）
    // 这样可以在新设备/新浏览器中加载云端数据
    loadImagFormLocal();
}


// 清除图片缓存
const clearCache = async () => {
    try {
        // 清除localStorage中的图片缓存
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('img:')) {
                localStorage.removeItem(key);
            }
        });

        // 清除localforage中的缓存
        const forageKeys = await localforage.keys();
        await Promise.all(
            forageKeys
                .filter(key => key.startsWith('img:'))
                .map(key => localforage.removeItem(key))
        );

        // 重新加载画廊
        list.value = [];
        loadImg();
    } catch (error) {
        console.error('清除缓存失败:', error);
    }
}

// 图片加载成功 - 智能缓存机制
const onImageLoad = async (item: any) => {
    item.isLoad = 1;

    // 如果图片来自外部URL且未缓存，将其转换为base64并存储
    if (item.src && !item.src.startsWith('data:') && item.mjID) {
        const cacheKey = `img:${item.mjID}`;
        try {
            const cachedImage = await localGet(cacheKey);
            if (!cachedImage) {
                // 使用url2base64函数将图片转换为base64并存储
                const result = await url2base64(item.src, cacheKey);
                if (result && result.base64) {
                    // 更新当前显示的图片源为base64
                    item.src = result.base64;
                    item.image_url = result.base64;
                }
            }
        } catch (error) {
            // 缓存失败不影响显示
            debugLog('图片缓存失败:', item.mjID, error);
        }
    }
}

// 图片加载失败 - 轻量级重试机制
const onImageError = (item: any) => {
    debugLog('图片加载失败:', item.mjID || item.id, '当前URL:', item.src);

    // 避免无限重试
    if (item.retryCount >= 2) {
        debugLog('达到最大重试次数，设置为失败状态');
        item.isLoad = -1;
        return;
    }

    item.retryCount = (item.retryCount || 0) + 1;

    // 简单的重试策略：如果当前不是wsrv URL，尝试wsrv
    if (!item.src.includes('wsrv.nl')) {
        const originalUrl = item.image_url || item.src;
        const wsrvProxyUrl = wsrvUrl(originalUrl);

        debugLog(`重试 ${item.retryCount}: 使用wsrv代理 ${wsrvProxyUrl}`);
        item.src = wsrvProxyUrl;
        return;
    }

    // 如果wsrv也失败了，设置为失败状态
    item.isLoad = -1;
}

const loadApiGallery= async ()=>{
    st.value.isLoad = true;

    try {
        const d = await loadGallery();
        if (!d || d.length === 0) {
            return;
        }

        // 去重处理
        const imageMap = new Map();
        const rz = d
            .filter(v => v.id && v.imageUrl)
            .forEach(v => {
                if (!imageMap.has(v.id)) {
                    imageMap.set(v.id, {
                        mjID: v.id,
                        src: v.imageUrl,
                        isLoad: 0,
                        prompt: v.prompt,
                        image_url: v.imageUrl,
                        action: v.action,
                        time: v.startTime || Date.now()
                    });
                }
            });

        const uniqueImages = Array.from(imageMap.values());

        // 批量处理缓存
        const processedImages = await Promise.all(
            uniqueImages.map(async (item) => {
                const key = `img:${item.mjID}`;
                try {
                    const base64 = await localGet(key);
                    if (base64) {
                        item.image_url = item.src = base64;
                    } else {
                        // 使用wsrv服务处理图片URL
                        item.image_url = item.src = wsrvUrl(item.image_url);
                    }
                } catch (error) {
                    item.image_url = item.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZlYmVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2RjMjYyNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWKoOi9veWksei0pTwvdGV4dD48L3N2Zz4=';
                }
                return item;
            })
        );

        // 按时间倒序排序
        list.value = processedImages.sort((a:any, b:any) => (b.time - a.time));

    } catch (error) {
        console.error('加载API画廊失败:', error);
    } finally {
        st.value.isLoad = false;
    }
}

// 新的画廊加载函数 - 使用优化的存储逻辑
const loadImagFormLocal = async () => {
    st.value.isLoad = true;

    try {
        // 迁移旧数据到新画廊格式
        await migrateToNewGallery(chatStore.$state);

        // 从新画廊系统获取图片（DB + localStorage合并）
        let galleryImages = await getGalleryImagesWithDB();

        // 过滤过期资源（包括数据库和本地）
        if (galleryImages.length > 0) {
            const now = Date.now();
            const sevenDaysAgo = 7 * 24 * 60 * 60 * 1000;

            // 信任的域名列表（长期稳定的CDN）
            const trustedDomains = [
                'cdn.discordapp.com',
                'oaidalleapiprodscus.blob.core.windows.net',
                'images.unsplash.com'
            ];

            // 已知会失效的临时域名黑名单
            const blockedDomains = [
                'webstatic.aiproxy.vip',
                'files.closeai.fans',
                'mj-oss.oss-cn-shanghai.aliyuncs.com',
                'tos-cn-beijing.volces.com'  // 字节火山引擎临时签名URL（24小时过期）
            ];

            const beforeCount = galleryImages.length;
            const removedReasons: Record<string, number> = {};

            // 过滤掉过期图片
            galleryImages = galleryImages.filter(img => {
                const age = now - img.timestamp;
                const isTrusted = trustedDomains.some(domain => img.url?.includes(domain));
                const isBlocked = blockedDomains.some(domain => img.url?.includes(domain));

                // 黑名单域名直接过滤
                if (isBlocked) {
                    const reason = '临时域名已失效';
                    removedReasons[reason] = (removedReasons[reason] || 0) + 1;
                    return false;
                }

                // 保留条件
                if (img.type === 'dalle' ||
                    isTrusted ||
                    age < sevenDaysAgo ||
                    img.url?.startsWith('data:image')) {
                    return true;
                }

                // 过滤原因统计
                const reason = `过期资源(${Math.floor(age / (24 * 60 * 60 * 1000))}天)`;
                removedReasons[reason] = (removedReasons[reason] || 0) + 1;
                return false;
            });

            const removedCount = beforeCount - galleryImages.length;
            if (removedCount > 0) {
                console.log(`🧹 [自动过滤] 已过滤 ${removedCount} 张失效图片，剩余 ${galleryImages.length} 张`);
                console.log('📊 [过滤统计]:', removedReasons);
            }
        }

        if (!galleryImages || galleryImages.length === 0) {
            // 只迁移最近7天的成功图片
            const oldChatData = await getMjAll(chatStore.$state);
            const recentChats = oldChatData.filter(chat => {
                const isRecent = (Date.now() - (chat.opt?.startTime || 0)) < 7 * 24 * 60 * 60 * 1000;
                const isValid = chat.opt?.status === 'SUCCESS' &&
                               (chat.opt?.action === 'UPSCALE' || chat.model?.includes('dall-e')) &&
                               chat.opt?.imageUrl;
                return isRecent && isValid;
            });

            // 迁移最近的有效图片
            for (const chat of recentChats) {
                await addToGallery(chat);
            }

            // 重新获取画廊数据（DB + localStorage合并）
            galleryImages = await getGalleryImagesWithDB();

            if (galleryImages.length === 0) {
                list.value = [];
                return;
            }
        }

        debugLog(`从画廊加载到 ${galleryImages.length} 张图片`);

        // 并行处理图片缓存
        const processedImages = await Promise.all(
            galleryImages.map(async (galleryImg) => {
                const item = {
                    mjID: galleryImg.id,
                    src: galleryImg.url,
                    isLoad: 0,
                    prompt: galleryImg.prompt,
                    image_url: galleryImg.url,
                    action: galleryImg.action,
                    time: galleryImg.timestamp,
                    type: galleryImg.type,
                    model: galleryImg.model
                };

                // 智能缓存加载策略
                const cacheKey = galleryImg.mjID ? `img:${galleryImg.mjID}` : `img:${galleryImg.id}`;

                try {
                    // 优先从本地缓存加载
                    const cachedImage = await localGet(cacheKey);
                    if (cachedImage && cachedImage.startsWith('data:')) {
                        item.image_url = item.src = cachedImage;
                        return item;
                    }

                    // 尝试智能URL处理
                    try {
                        const smartUrl = await smartImageUrl(galleryImg.url);
                        item.image_url = item.src = smartUrl;
                    } catch (e) {
                        // 最后回退到wsrv
                        item.image_url = item.src = wsrvUrl(galleryImg.url);
                    }

                } catch (e) {
                    // 设置占位符图片
                    item.image_url = item.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWKoOi9veWksei0pS4uLjwvdGV4dD48L3N2Zz4=';
                }

                return item;
            })
        );

        // 图片已经按时间排序，直接使用
        list.value = processedImages;

        debugLog(`画廊加载完成: ${list.value.length} 张图片`);

    } catch (error) {
        console.error('加载画廊失败:', error);
        list.value = [];
    } finally {
        st.value.isLoad = false;
    }
}
const goShow=( item:any)=>{
    //console.log('goShow', isMobile );
    if( isMobile.value)   return ; 
    st.value.show= true;
    st.value.showImg= item.image_url;
    //console.log('goShow', item);
    nextTick(() => showImg.value?.click());
}
// function copy( item:any){ 
//   //console.log('copy', item.prompt );
// 	//copyText3(  item.prompt ).then(()=>msgRef.value.showMsg('复制成功！'));
//   homeStore.setMyData({act:'copy',actData: {text: item.prompt } });
// 	//copyToClip(  item.prompt ).then(()=>msgRef.value.showMsg('复制成功！'));
// }
 

//画同款
const same=( item:any,act:string)=>{
  //console.log('same',item);
  homeStore.setMyData({act,actData: JSON.parse(JSON.stringify(item) ) }); //:'same'
  emit('close');
}
loadImg();

</script>
<template>

<Waterfall v-if="list.length" :list="list" :breakpoints="breakpoints" class="!bg-transparent">
  <template #item="{ item, url, index }">
    <div class="bg-white dark:bg-[#24272e] rounded-md overflow-hidden cursor-pointer group/item relative">
      <LazyImg :url="item.image_url" @success="onImageLoad(item)" @error="onImageError(item)" @click="goShow(item)" />

      <div class="absolute top-0 left-0 right-0 bottom-0 bg-gray-50 dark:bg-gray-800" v-if="item.isLoad==0">
        <div class="flex justify-center items-center w-full h-full">
            <n-spin size="large" />
        </div>
      </div>

      <div class="absolute top-0 left-0 right-0 bottom-0 bg-red-50 dark:bg-red-900/20" v-else-if="item.isLoad==-1">
        <div class="flex flex-col justify-center items-center w-full h-full text-red-500 text-sm">
            <div class="mb-2">⚠️</div>
            <div>加载失败</div>
        </div>
      </div>

      <!-- 悬停信息栏 -->
      <div class="absolute w-full bottom-0 backdrop-blur-sm text-white/70 invisible group-hover/item:visible">
        <div class="p-3">
            <div class="line-clamp-2 text-[13px]">
                <template v-if="item.prompt">{{ item.prompt }}</template>
                <NTag v-else-if="item.action=='SWAP_FACE'" type="success" size="small" round v-html="$t('mjchat.face')"></NTag>
                <NTag v-else-if="item.action=='BLEND'" type="success" size="small" round  v-html="$t('mjchat.blend')" ></NTag>
                <NTag v-else type="success" size="small" round >{{ item.action }}</NTag>
            </div>
            <div class="line-clamp-1 text-[12px] text-right">{{ new Date( item.time).toLocaleString() }}</div>
        </div>
      </div>

      <!-- 删除按钮 -->
      <div class="absolute top-2 right-2 invisible group-hover/item:visible">
        <NPopconfirm
          @positive-click="(e) => handleDelete(item, e)"
          positive-text="确认"
          negative-text="取消"
        >
          <template #trigger>
            <NButton
              size="small"
              type="error"
              circle
              :loading="st.deleting"
              @click.stop
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd" />
                </svg>
              </template>
            </NButton>
          </template>
          <span>确定要删除这张图片吗？</span>
        </NPopconfirm>
      </div>
    </div>
  </template>
</Waterfall>

<div v-else-if="st.isLoad" class="w-full h-full flex justify-center items-center">
    <n-spin size="large" />
    <div>Loading....</div>
</div>
<div v-else class="w-full h-full flex flex-col justify-center items-center">
    <n-empty :description="$t('mjchat.noproduct')" />
    <div class="mt-4 space-x-2">
        <button @click="loadImg()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            刷新画廊
        </button>
        <button @click="clearCache()" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
            清除缓存
        </button>
    </div>
</div>


<NImage   :src="st.showImg"  ref="showImg" v-if="st.showImg" :width="1" />
 <!-- <NButton type="primary" size="small" @click="copy2('abdd' )" >复制</NButton> -->

<!-- <div @click="copy2('abdd' )">复制测试</div> -->
</template>

<style>
.lazy__img[lazy=loading] {
  padding: 5em 0;
  width: 48px;
}

.lazy__img[lazy=loaded] {
  width: 100%;
}

.lazy__img[lazy=error] {
  padding: 5em 0;
  width: 48px;
}
</style>