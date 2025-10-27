<script setup lang="ts">
import { ref ,computed,watch} from 'vue';
import {useMessage, NButton,NSelect,NInput, NImage, c} from 'naive-ui';
import {gptFetch, mlog, upImg, localGet, localSaveAny} from '@/api'
import { homeStore } from '@/store';
import { SvgIcon } from '@/components/common';
import { t } from '@/locales';
import { checkBalance } from '@/utils/balanceGuard';

const ms = useMessage();
const config = ref( {
model:[
{  "label": "nano-banana", "value": "nano-banana" }
 ,{  "label": "nano-banana-hd", "value": "nano-banana-hd" }
 ,{  "label": "seedream", "value": "doubao-seedream-4-0-250828" }
]
});
interface myFile{
    file:any
    base64:string
}
const st =ref({isGo:false,quality:'medium' }); 
const fsRef= ref() ; 
const base64Array= ref<myFile[]>([]);    
const f = ref({size:'1024x1024', prompt:'',"model": "nano-banana","n": 1});
const isDisabled= computed(()=>{
    if(st.value.isGo) {
        //console.log('st.value.isGo',st.value.isGo);
        return true;
    }
    if(f.value.prompt.trim()=='') {
        //console.log('prompt',"空");
        return true;
    }
    if(!homeStore.myData.hasBalance) {
        return true;
    }
    return false;
});
const create= async ()=>{
    if (!homeStore.myData.hasBalance) {
        ms.info('账户余额不足，无法使用图片生成功能');
        return;
    }

    // const d= await gptFetch('/v1/embeddings',{
    // "input":  f.value.prompt,
    // "model": "text-embedding-ada-002"
    // });
    // mlog('test',d );
    //return ;

    // 统一的处理逻辑，nano-banana 也使用标准 DALL-E 流程
    let obj= {
        action:'gpt.dall-e-3',
        data:{} //f.value
    }
    obj.data= { ...f.value}
    if(isCanImageEdit.value){
        obj.data= {...obj.data ,quality:st.value.quality};
    }
    if (isCanImageEdit.value && base64Array.value.length>0){

        obj.data= {...obj.data, 'base64Array':base64Array.value,quality:st.value.quality};
        mlog("data", '我加东西了：',  base64Array.value  )
    }

    // 保存原始配置用于重新编辑和再次生成
    // 关键修改：不再将base64Array直接存入localStorage，而是存到IndexedDB
    let base64ArrayKey = '';
    if (base64Array.value.length > 0) {
        // 将base64Array存储到IndexedDB，只保存key到localStorage
        base64ArrayKey = `dall-images:${Date.now()}`;
        await localSaveAny(JSON.stringify(base64Array.value), base64ArrayKey);
        mlog('base64Array已存储到IndexedDB, key:', base64ArrayKey);
    }

    obj.originalConfig = {
        model: f.value.model,
        size: f.value.size,
        prompt: f.value.prompt,
        n: f.value.n,
        quality: st.value.quality,
        base64ArrayKey: base64ArrayKey || undefined // 只存储key引用，不存储实际数据
    };

    homeStore.setMyData({act:'draw', actData:obj});
    st.value.isGo=true;
}
watch(()=>homeStore.myData.act,(n)=>{
    if(n=='dallReload') {
        st.value.isGo=false;
        f.value.prompt='';
    }
    if(n=='updateChat')  st.value.isGo=false;
    // 处理重新编辑：将配置重新填入界面
    if(n=='image.edit') {
        const data = homeStore.myData.actData;
        if(data && data.config) {
            const config = data.config;
            f.value.model = config.model || 'nano-banana';
            f.value.size = config.size || '1024x1024';
            f.value.prompt = config.prompt || '';
            f.value.n = config.n || 1;
            st.value.quality = config.quality || 'medium';

            // 重新填入参考图片 - 从 IndexedDB 恢复
            if (config.base64ArrayKey) {
                // 如果有 key，从 IndexedDB 加载
                localGet(config.base64ArrayKey).then((data: any) => {
                    if (data) {
                        try {
                            base64Array.value = JSON.parse(data);
                            mlog('从 IndexedDB 恢复 base64Array:', base64Array.value.length);
                        } catch(e) {
                            mlog('解析 base64Array 失败:', e);
                            base64Array.value = [];
                        }
                    } else {
                        base64Array.value = [];
                    }
                }).catch((e: any) => {
                    mlog('从 IndexedDB 加载失败:', e);
                    base64Array.value = [];
                });
            } else if (config.base64Array) {
                // 兼容旧数据：直接使用 base64Array
                base64Array.value = config.base64Array;
            } else {
                base64Array.value = [];
            }
        }
    }
})

 
const qualityOption=  computed(()=>{ 
    return [
{label:'High',value: 'high'}
,{label:'Medium',value: 'medium'}
,{label:'Low',value: 'low'}
 
]
});
const dimensionsList= computed(()=>{
    if(f.value.model=='dall-e-2'){
        return [{ 
                "label": "1024px*1024px",
                "value": "1024x1024"
            }, {
                "label": "512px*512px",
                "value": "512x512"
            }, {
                "label": "256px*256px",
                "value": "256x256"
            }
    ];
    } 
    if(f.value.model=='gpt-image-1'){
    return [{ 
                "label": "1024px*1024px",
                "value": "1024x1024"
            }, {
                "label": "1536px*1024px",
                "value": "1536x1024"
            }, {
                "label": "1024px*1536px",
                "value": "1024x1536"
            }
    ];
    }
    if(f.value.model=='nano-banana' || f.value.model=='nano-banana-hd' || f.value.model=='doubao-seedream-4-0-250828'){
    return [{
                "label": "1024px*1024px",
                "value": "1024x1024"
            }, {
                "label": "1792px*1024px",
                "value": "1792x1024"
            }, {
                "label": "1024px*1792px",
                "value": "1024x1792"
            }
    ];
    }
    return [{ 
                "label": "1024px*1024px",
                "value": "1024x1024"
            }, {
                "label": "1792px*1024px",
                "value": "1792x1024"
            }, {
                "label": "1024px*1792px",
                "value": "1024x1792"
            }
     ]
     
})
watch(()=>f.value.model,(n)=>{
    f.value.size='1024x1024';
})
const isCanImageEdit= computed(()=>{
    if(f.value.model=='dall-e-2') return true;
    if(f.value.model=='gpt-image-1') return true;
    if(f.value.model.indexOf('kontext')>-1) return true;
    if(f.value.model=='nano-banana' || f.value.model=='nano-banana-hd' || f.value.model=='doubao-seedream-4-0-250828') return true;
    return false;
})

const selectFile=(input:any)=>{
    const ff=input.target.files[0];
    upImg(input.target.files[0]).then(d=>{
        fsRef.value.value='';
        const index = base64Array.value.findIndex(item => item.base64 == d);
        if(index>-1){
            ms.error(t('mjchat.no2add') )
            return ;
        }
        base64Array.value.push({file: ff ,base64:d});
        //if(base64Array.value.length>1) st.value.isGo=true;
        //if(st)
    }).catch(e=>ms.error(e));
}

</script>
<template>
<section class="mb-4 flex justify-between items-center"  >
     <div>{{ $t('mjchat.version') }} </div>
    <n-select v-model:value="f.model" :options="config.model" filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center"  >
     <div>{{ $t('mjchat.size') }}</div>
    <n-select v-model:value="f.size" :options="dimensionsList"  filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center" v-if="isCanImageEdit" >
     <div>Quality</div>
    <n-select v-model:value="st.quality" :options="qualityOption"  filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>

<div class="mb-1">
     <n-input    type="textarea"  v-model:value="f.prompt"   :placeholder="$t('mjchat.prompt')" round clearable maxlength="500" show-count 
      :autosize="{   minRows:3, maxRows:10 }" />
</div>
<div class="mb-1" v-if="isCanImageEdit"> 
    <div class="flex justify-start items-center flex-wrap myblend">

    <div class="w-[var(--my-blend-img-size)] h-[var(--my-blend-img-size)] mr-2 mt-2 bg-[#ddd] overflow-hidden rounded-sm relative group " v-for="item in base64Array">
        <NImage :src="item.base64" object-fit="cover"></NImage>
        <SvgIcon icon="fluent:delete-12-filled"
        class="absolute top-0 right-0 text-red-600 text-[20px] cursor-pointer hidden group-hover:block "
        @click="base64Array.splice(base64Array.indexOf(item),1)"></SvgIcon>
    </div>

        <div   @click="fsRef.click()" v-if="base64Array.length<3"
         class="w-[var(--my-blend-img-size)] h-[var(--my-blend-img-size)] mt-2 bg-[#999] overflow-hidden rounded-sm flex justify-center items-center cursor-pointer">
            <SvgIcon icon="mdi:add-bold" size="3xl" class="text-[#fff]" />
        </div>
         
    </div>   
</div>

<div class="mb-4 flex justify-end items-center">
    <div class="flex ">
         <n-button type="primary" :block="true" :disabled="isDisabled" @click="create()" style="background-color: #445ff6;" >
            <SvgIcon icon="mingcute:send-plane-fill" />   
             {{ $t('mjchat.imgcreate') }} 
        </n-button>
    </div>
</div>

<ul class="pt-4" v-html="$t('mjchat.dalleInfo')">
   
</ul>

<input type="file"  @change="selectFile"  ref="fsRef" style="display: none" accept="image/jpeg, image/jpg, image/png, image/gif"/>

</template>

<style scoped>
.myblend{
    --my-blend-img-size:75px
}
</style>
