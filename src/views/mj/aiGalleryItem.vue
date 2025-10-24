<script setup lang="ts">
import { LazyImg, Waterfall } from 'vue-waterfall-plugin-next'
import 'vue-waterfall-plugin-next/dist/style.css'
//import { ajax } from '@/api' 
import {ref,nextTick} from "vue"
import {NSpin ,NEmpty,NImage, NTag } from 'naive-ui' 
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

const emit = defineEmits(['close']);
//import {hom}

const st =ref({show:true ,showImg:'' ,isLoad:false });

const showImg= ref<typeof NImage>();
 

const list = ref<any[]>([])

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
    // 快速统计图片数量
    let imageCount = 0;
    for (const conversation of chatStore.$state.chat) {
        for (const message of conversation.data) {
            if (message.mjID || (message.opt && message.opt.imageUrl)) {
                imageCount++;
                if (imageCount > 0) break;
            }
        }
        if (imageCount > 0) break;
    }

    // 如果没有找到图片，显示空状态
    if (imageCount === 0) {
        list.value = [];
        return;
    }

    // 使用新的智能画廊系统
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

        // 检查画廊中的图片是否过期，清理失效数据
        if (galleryImages.length > 0) {
            const validImages = [];

            for (const img of galleryImages) {
                // 简单的启发式检查
                const isLikelyValid = (
                    (Date.now() - img.timestamp) < 7 * 24 * 60 * 60 * 1000 ||
                    img.url.includes('cdn.discordapp.com') ||
                    img.type === 'dalle'
                );

                if (isLikelyValid) {
                    validImages.push(img);
                }
            }

            if (validImages.length !== galleryImages.length) {
                await localSave('MJ:gallery:images', validImages);
                galleryImages = validImages;
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

      <div class="absolute w-full bottom-0 backdrop-blur-sm text-white/70 invisible group-hover/item:visible">
        <div class="p-3">
            <div class="line-clamp-2 text-[13px]">
                <template v-if="item.prompt">{{ item.prompt }}</template>
                <NTag v-else-if="item.action=='SWAP_FACE'" type="success" size="small" round v-html="$t('mjchat.face')"></NTag>
                <NTag v-else-if="item.action=='BLEND'" type="success" size="small" round  v-html="$t('mjchat.blend')" ></NTag>
                <NTag v-else type="success" size="small" round >{{ item.action }}</NTag>
            </div>
            <div class="line-clamp-1 text-[12px] text-right">{{ new Date( item.time).toLocaleString() }}</div>
            <div class="space-x-2"></div>
        </div>
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