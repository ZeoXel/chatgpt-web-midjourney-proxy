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
import { getMjAll, localGet, mlog ,loadGallery, url2base64, wsrvUrl } from '@/api'
 
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
    mlog('画廊加载模式',homeStore.myData.session.isApiGallery );
    mlog('聊天历史总数', chatStore.$state.chat.length);

    // 统计所有消息中有图片的数量
    let imageCount = 0;
    chatStore.$state.chat.forEach(conversation => {
        conversation.data.forEach(message => {
            if (message.mjID || (message.opt && message.opt.imageUrl)) {
                imageCount++;
                mlog('找到图片消息', message);
            }
        });
    });
    mlog('总共找到图片消息数量', imageCount);

    // 如果没有找到图片，创建一些测试数据
    if (imageCount === 0) {
        mlog('没有找到图片数据，创建测试数据');
        createTestImages();
        return;
    }

    if( homeStore.myData.session.isApiGallery )  loadApiGallery();
    else  loadImagFormLocal();
}

// 创建测试图片数据
const createTestImages = () => {
    const testImages = [
        {
            mjID: 'test1',
            src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGY5M2ZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtYvor5Xnlbflm74xPC90ZXh0Pjwvc3ZnPg==',
            image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGY5M2ZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtYvor5Xnlbflm74xPC90ZXh0Pjwvc3ZnPg==',
            prompt: '测试图片1 - SVG图片',
            action: 'IMAGINE',
            time: Date.now() - 1000000,
            isLoad: 1
        },
        {
            mjID: 'test2',
            src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjM1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtYvor5Xnlbflm74yPC90ZXh0Pjwvc3ZnPg==',
            image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjM1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtYvor5Xnlbflm74yPC90ZXh0Pjwvc3ZnPg==',
            prompt: '测试图片2 - SVG图片',
            action: 'IMAGINE',
            time: Date.now() - 2000000,
            isLoad: 1
        }
    ];

    mlog('创建测试图片数据', testImages);
    list.value = testImages;
}

// 清除图片缓存
const clearCache = () => {
    // 清除所有以'img:'开头的localStorage项
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('img:')) {
            localStorage.removeItem(key);
            mlog('清除缓存', key);
        }
    });
    mlog('缓存清除完成，重新加载画廊');
    loadImg();
}

// 图片加载成功
const onImageLoad = (item: any) => {
    mlog('图片加载成功', item.mjID, item.src);
    item.isLoad = 1;
}

// 图片加载失败
const onImageError = (item: any) => {
    mlog('图片加载失败', item.mjID, item.src);
    item.isLoad = -1;
}

const loadApiGallery= async ()=>{
    st.value.isLoad= true;
   let d= await loadGallery();
   mlog('loadApiGallery',d);
    st.value.isLoad= false;
   if( !d || d.length==0 ) return;
   let rz = d.map((v:any)=>{
       // 暂时不使用外部图片URL，等待base64转换
       let imageUrl = v.imageUrl;
       mlog('原始图片URL', imageUrl);
       return {
           mjID: v.id,
            src: imageUrl,isLoad:0, prompt: v.prompt,
            image_url: imageUrl,
            action: v.action
            ,time: v.startTime
       }
   });
   for(let i in rz ){
        let v = rz[i];
        try {
            if( v.image_url){
                let key= 'img:'+v.mjID;
                let base64 = await localGet(key );
                if(!base64) {
                    mlog('没有找到base64缓存，尝试转换', key);
                    // 使用简单的占位符
                    rz[i].image_url = rz[i].src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';
                    mlog('使用占位符图片', rz[i].image_url);
                    // 在后台尝试转换
                    url2base64( v.image_url ,key ).then((newBase64:any)=>{
                         mlog('图片转换成功>>', key );
                         // 更新列表中的图片
                         if(newBase64) {
                             const foundItem = list.value.find(item => item.mjID === v.mjID);
                             if(foundItem) {
                                 foundItem.image_url = foundItem.src = newBase64;
                             }
                         }
                    }).catch(error => {
                        mlog('图片转换失败', error);
                    });
                }else {
                     rz[i].image_url =  rz[i].src =base64;
                }
            }
        } catch (error) {
            mlog('图片处理失败',error);
        }
   }
   

   list.value= rz.sort((a:any,b:any)=> ( b.time - a.time) ) ;
}

const loadImagFormLocal= async ( )=>{
    mlog('开始加载本地画廊数据');
    mlog('chatStore状态', chatStore.$state);
    let d = await getMjAll( chatStore.$state);
    mlog('本地画廊数据', d);
    if( !d || d.length==0 ) {
        mlog('画廊：没有找到本地图片数据');
        return;
    }
    
    let rz = d.filter((v:any)=>  v.opt && v.opt.imageUrl ).map((v:any)=>{
        //mlog('vv', v.opt.imageUrl);
        // let key= 'img:'+v.mjID;
        //  let base64 = await loca(key );
        // 暂时不使用外部图片URL，等待base64转换
        let imageUrl = v.opt.imageUrl;
        mlog('原始图片URL', imageUrl);
        return {
            mjID: v.mjID,
            src: imageUrl,isLoad:0, prompt: v.opt.promptEn,
            image_url: imageUrl
            ,action: v.opt.action
            ,time: v.opt.startTime
        }
    });
    mlog('过滤后的图片数据', rz);
    list.value=[];
    for(let v of rz ){
        let key= 'img:'+v.mjID;
        try{
            let base64 = await localGet(key );
            if( base64 ) {
                mlog('找到base64缓存', key, base64.substring(0, 50) + '...');
                v.image_url = v.src = base64;
            } else {
                mlog('没有找到base64缓存，使用代理URL', key, v.image_url);
                // 使用后端代理解决CORS问题
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(v.image_url)}`;
                v.image_url = v.src = proxyUrl;
                mlog('使用代理URL', proxyUrl);
            }
        }catch(e){
            mlog('读取base64缓存失败', e);
            v.image_url = v.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWKoOi9veS4rS4uLjwvdGV4dD48L3N2Zz4=';
        }
        list.value.push(v );
    }
    mlog('最终画廊列表', list.value);

   // list.value
    
    // ajax({  url: '/chatgpt/mj/gallery' })
    //     .then((d) => {
    //         // st.value.style= d.data.style
    //         // st.value.example= d.data.example
    //         console.log(d)
    //         list.value= d.data.images.map((v:any)=>{ 
    //             v.isLoad=0
    //             return  v;
    //         })
    //     } )

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
      <LazyImg :url="item.image_url" @success="item.isLoad=1" @click="goShow(item)" />

      <div class="absolute top-0 left-0 right-0 bottom-0" v-if="item.isLoad==0">
        <div class="flex justify-center items-center w-full h-full">
            <n-spin size="large" />
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
        <button @click="loadImg()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            刷新画廊
        </button>
        <button @click="clearCache()" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
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