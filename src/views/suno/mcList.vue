<script setup lang="ts">
import { ref, watch } from 'vue'
import { SvgIcon } from '@/components/common';
//import {   FeedTask} from '@/api/suno';
import {   sunoStore, SunoMedia} from '@/api/sunoStore';
import { deleteSunoAudioFromCOS } from '@/api/sunoStorage';

import playui from './playui.vue';
import { homeStore } from '@/store';
import { mlog } from '@/api';
import {NEmpty, NImage ,useMessage,NPopconfirm} from "naive-ui"
import { FeedTask } from '@/api/suno';
import { t } from '@/locales';

const list= ref<SunoMedia[]>([]);
const csuno= new sunoStore()
const st= ref({playid:''});

const ms = useMessage();
const initLoad= async ()=>{
    // Phase 2: 使用数据库合并方法加载数据
    let arr = await csuno.getObjsWithDB();
    list.value= arr; // getObjsWithDB 已经按时间倒序排列，无需再 reverse
}

const getNowCls=(v:any)=>{
    if(v.id==st.value.playid ){
        return ['bg-gray-200','dark:bg-black']
    }
    return [];
}
const goPlay=(v:SunoMedia)=>{
    if(v.status=='error'){
        ms.info( t('mj.ud_fail'))
        return ;
    }
    st.value.playid=v.id
    homeStore.setMyData({act:'goPlay',actData:v})
    
    if(v.status!='complete'){
        FeedTask([v.id ])
    }
}

const extend=(v:SunoMedia)=>{
    mlog("extend", extend )
    //homeStore.myData.actData
    homeStore.setMyData({act:"suno.extend", actData: v  })
}

const sp= ref({v:10, max:0 ,status:'',idDrop:false });
 
watch(()=>homeStore.myData.act, (n)=>{
     if(n=='FeedTask'){
         initLoad()
     }
     if(n=='playEned'){
        //
        let  i= list.value.findIndex((v)=>v.id==st.value.playid)
        i++;
        mlog('playEned,',i, list.value.length )
        if(i<list.value.length) setTimeout(()=>goPlay(list.value[i]),1000)  
     }
});

const getExSuno=(id:string)=>{
    id= id.replace("m_",'');
    let index= list.value.findIndex(v=>v.id==id);
     
    if (index<0){
      return null ;
    }
    return list.value[index];
}
const update = (v:any )=>{
     sp.value=v
      
}
const deleteGo = async (v: SunoMedia) => {
    mlog('deleteGo', v)

    try {
        // 删除COS资产 (JSON记录 + 实际文件)
        await deleteSunoAudioFromCOS(v.id);

        // 删除本地存储
        csuno.delete(v);

        ms.success(t('common.deleteSuccess'));
        initLoad();
    } catch (error: any) {
        console.error('[Suno Delete] ❌ 删除失败:', error);
        ms.error(`删除失败: ${error.message || '未知错误'}`);
    }
}
initLoad();
</script>
<template>
<div v-if="list.length>0">
    <div  v-for="item in list" :class="getNowCls( item )" class="flex relative  justify-between items-start p-2 hover:dark:bg-black hover:bg-gray-200 border-b-[1px] border-gray-500/10 ">
        
        <playui @update="update" v-if="st.playid==item.id"  class="absolute top-[-4px] left-0 w-full  z-10" ></playui>
        <div class="w-[60px] h-[60px] relative cursor-pointer" @click="goPlay(item)">
            <!-- 有图片URL：显示封面图 -->
            <template v-if="item.image_url">
                <n-image lazy width="100" :src="item.image_url" preview-disabled>
                    <template #placeholder>
                        <div class="w-full h-full justify-center items-center flex bg-gray-100 dark:bg-gray-800">
                            <SvgIcon icon="line-md:downloading-loop" size="3xl" class="text-green-300" />
                        </div>
                    </template>
                    <template #fallback>
                        <div class="w-full h-full justify-center items-center flex bg-gray-200 dark:bg-gray-800">
                            <SvgIcon icon="mdi:music" size="3xl" class="text-gray-400" />
                        </div>
                    </template>
                </n-image>
                <!-- 生成中的加载指示器 -->
                <div class="absolute top-0 right-0 w-full h-full flex justify-center items-center" v-if="item.status != 'complete' && st.playid != item.id">
                    <SvgIcon icon="line-md:downloading-loop" class="text-[40px] text-green-300" />
                </div>
                <!-- 播放中的状态指示器 -->
                <div class="absolute top-0 right-0 w-full h-full flex justify-center items-center" v-if="st.playid == item.id">
                    <SvgIcon icon="mdi:pause-circle-outline" size="3xl" class="text-[#fff]" v-if="sp.status == 'pause'" />
                    <SvgIcon icon="svg-spinners:bars-scale-middle" size="3xl" class="text-[#fff]" v-else />
                </div>
            </template>

            <!-- 无图片URL：显示加载占位符 -->
            <template v-else>
                <div class="w-full h-full flex justify-center items-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700">
                    <div class="flex flex-col items-center gap-1">
                        <SvgIcon icon="svg-spinners:ring-resize" class="text-[32px] text-green-500" />
                        <span class="text-[8px] text-gray-500 dark:text-gray-400">生成中</span>
                    </div>
                </div>
            </template>
        </div> 
        <div class="flex-1  pl-2"> 
            <div class="flex justify-between line-clamp-1 w-full cursor-pointer"  @click="goPlay( item )">
                <div class="flex justify-start items-center"> 
                    <h3 >{{item.title}}</h3>
                    <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 ml-1 list-none rounded-md" v-if="item.metadata?.type=='upload'" >Uploaded</div>
                </div>
                <div class="opacity-80 line-clamp-1 max-w-[320px]"   >{{item.metadata.tags}}</div>
            </div>
            <div class="opacity-60 line-clamp-1 w-full text-[12px] cursor-pointer"  @click="goPlay( item )" v-if="item.metadata && item.metadata.prompt">
             {{item.metadata.prompt}}
            </div>
            <div class="opacity-60 line-clamp-1 w-full text-[12px] cursor-pointer"  @click="goPlay( item )" v-else>
             {{$t('suno.noly')}}
              </div>
            <div class="text-right text-[14px] flex justify-end items-center space-x-2" @click.stop>
                <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md" v-if="item.metadata?.audio_prompt_id">
                    {{ $t('suno.extendFrom') }}:{{ getExSuno(item.metadata?.audio_prompt_id)?.title }}
                </div>
                <div v-if="item.status=='error'" class="text-[8px] flex items-center border-[1px] border-red-500/80 px-1 list-none rounded-md ">{{ $t('suno.fail') }}</div>
                <template v-if="item.metadata && item.metadata.duration">
                    <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md" > {{item.metadata.duration.toFixed(1)}}s</div>
                    <div @click="extend(item)" class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700">{{ $t('suno.extend') }}</div>
                </template>
                <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md" v-if="item.major_model_version"> {{item.major_model_version}}</div>
                <n-popconfirm @positive-click="()=>deleteGo(item)" placement="bottom">
                    <template #trigger><SvgIcon icon="mdi:delete" size="sm" class="cursor-pointer hover:text-red-500" /></template>
                     {{ $t('mj.confirmDelete') }}
                </n-popconfirm>
                <SvgIcon icon="mdi:play-circle-outline" size="lg" class="cursor-pointer" @click="goPlay(item)" />
                <a :href="item.audio_url" download target="_blank"><SvgIcon icon="mdi:download" size="sm" class="cursor-pointer hover:text-blue-500"/></a>
            </div>
           
        </div>
    </div>
</div>
<div class="w-full h-full flex justify-center items-center" v-else>
    <NEmpty :description="$t('suno.nodata')"></NEmpty>
</div>

</template>
