<script setup lang="ts">
import { ref, watch } from 'vue'
import { SvgIcon } from '@/components/common';
import { riffStore, riffTask } from '@/api/riffStore';
import {NEmpty, NImage ,useMessage,NPopconfirm} from "naive-ui"
import { t } from '@/locales';
import { riffFeed } from '@/api/riff';
import { homeStore } from '@/store';
import { mlog } from '@/api';
import playui from './playui.vue';

const list= ref<riffTask[]>([]);

const csuno= new riffStore()
const st= ref({playid:''});
const sp= ref({v:10, max:0 ,status:'',idDrop:false });

const ms = useMessage();
const initLoad=()=>{
    let arr = csuno.getObjs();
    list.value= arr.reverse()
}
const getNowCls=(v:riffTask)=>{
    if(v.id==st.value.playid ){
        return ['bg-gray-200','dark:bg-black']
    }
    return [];
}

const goPlay=(v:riffTask)=>{
    if(v.status=='ERROR'){
        ms.info(t('mj.ud_fail'))
        return ;
    }
    //mlog('TK ',v.status ,  v.taskId )
    if(v.status!='success'){
         riffFeed( v.id )
         return
    }
    if(!v.riff?.audio_url ){
        ms.info(t('mj.ud_doing'))
        return ;
    }
    st.value.playid=v.id
    homeStore.setMyData({act:'goPlayRiff',actData:v})
    
}
const update = (v:any )=>{
     sp.value=v 
}
const deleteGo=(v:string)=>{
    mlog('deleteGo', v)
    if(csuno.delete(v)) {
        ms.success( t('common.deleteSuccess'))
        initLoad();
    }

}

watch(()=>homeStore.myData.act, (n)=>{
     if(n=='RiffFeed'){
         initLoad()
     }
     if(n=='playEned'){
        let  i= list.value.findIndex((v)=>v.id==st.value.playid)
        i++;
        mlog('playEned,',i, list.value.length )
        if(i<list.value.length) setTimeout(()=>goPlay(list.value[i]),1000)  
     }
});

initLoad();

</script>
<template>
<div  v-if="list.length>0">
        <div  v-for="item in list" :class="getNowCls( item )" class="flex relative  justify-between items-start p-2 hover:dark:bg-black hover:bg-gray-200 border-b-[1px] border-gray-500/10 ">
        <playui @update="update" v-if="st.playid==item.id"  class="absolute top-[-4px] left-0 w-full  z-10" ></playui>
        <div class="w-[60px] h-[60px] relative cursor-pointer" @click="goPlay(item)">
            <!-- 有图片URL：显示封面图 -->
            <template v-if="item.riff?.image_url">
                <n-image lazy width="100" :src="item.riff?.image_url" preview-disabled>
                    <template #placeholder>
                        <div class="w-full h-full justify-center items-center flex bg-gray-100 dark:bg-gray-800">
                            <SvgIcon icon="line-md:downloading-loop" size="3xl" class="text-[#445ff6]" />
                        </div>
                    </template>
                    <template #fallback>
                        <div class="w-full h-full justify-center items-center flex bg-gray-200 dark:bg-gray-800">
                            <SvgIcon icon="mdi:music" size="3xl" class="text-gray-400" />
                        </div>
                    </template>
                </n-image>
                <!-- 生成中的加载指示器 -->
                <div class="absolute top-0 right-0 w-full h-full flex justify-center items-center" v-if="item.status != 'success' && st.playid != item.id">
                    <SvgIcon icon="line-md:downloading-loop" class="text-[40px] text-[#445ff6]" />
                </div>
                <!-- 播放中的状态指示器 -->
                <div class="absolute top-0 right-0 w-full h-full flex justify-center items-center" v-if="st.playid == item.id">
                    <SvgIcon icon="mdi:pause-circle-outline" size="3xl" class="text-[#fff]" v-if="sp.status == 'pause'" />
                    <SvgIcon icon="svg-spinners:bars-scale-middle" size="3xl" class="text-[#fff]" v-else />
                </div>
            </template>

            <!-- 无图片URL：显示加载占位符 -->
            <template v-else>
                <div class="w-full h-full flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 border-dashed border-[#445ff6] dark:border-blue-700">
                    <div class="flex flex-col items-center gap-1">
                        <SvgIcon icon="svg-spinners:ring-resize" class="text-[32px] text-[#445ff6]" />
                        <span class="text-[8px] text-gray-500 dark:text-gray-400">生成中</span>
                    </div>
                </div>
            </template>
        </div> 

        <div class="flex-1  pl-2"> 
            <div class="flex justify-between line-clamp-1 w-full cursor-pointer"  @click="goPlay( item )">
                <div class="flex justify-start items-center"> 
                    <h3 >{{item.riff?.title}}</h3>
                    <!-- <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 ml-1 list-none rounded-md" v-if="item.metadata?.type=='upload'" >Uploaded</div> -->
                </div>
                <div class="opacity-80 line-clamp-1 max-w-[320px]" v-if="item.riff?.sound"  >{{  item.riff?.sound }}</div>
            </div>
            <div class="opacity-60 line-clamp-1 w-full text-[12px] cursor-pointer"  @click="goPlay( item )" v-if="item.riff?.lyrics || item.riff?.topic">
             {{item.riff?.lyrics || item.riff?.topic}}
            </div>
            <div class="opacity-60 line-clamp-1 w-full text-[12px] cursor-pointer"  @click="goPlay( item )" v-else>
             {{$t('suno.noly')}}
              </div>
            <div class="text-right text-[14px] flex justify-end items-center space-x-2" @click.stop>
                <div v-if="item.status=='ERROR'" class="text-[8px] flex items-center border-[1px] border-red-500/80 px-1 list-none rounded-md ">{{ $t('suno.fail') }}</div>
                <template v-if="item.riff?.duration_s">
                    <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md" > {{item.riff?.duration_s?.toFixed(1)}}s</div>
                </template>
                <div class="text-[8px] flex items-center border-[1px] border-gray-500/30 px-1 list-none rounded-md" v-if="item.riff?.model_display_name"> {{item.riff?.model_display_name}}</div>
                <n-popconfirm @positive-click="()=>deleteGo(item.id )" placement="bottom">
                    <template #trigger><SvgIcon icon="mdi:delete" size="sm" class="cursor-pointer hover:text-red-500" /></template>
                     {{ $t('mj.confirmDelete') }}
                </n-popconfirm>
                <SvgIcon icon="mdi:play-circle-outline" size="lg" class="cursor-pointer" @click="goPlay(item)" />
                <a :href="item.riff?.audio_url" download target="_blank"><SvgIcon icon="mdi:download" size="sm" class="cursor-pointer hover:text-blue-5 00"/></a>
            </div>
           
        </div>
    </div>
</div>
<div class="w-full h-full flex justify-center items-center" v-else>
    <NEmpty :description="$t('suno.nodata')"></NEmpty>
</div>
</template>
