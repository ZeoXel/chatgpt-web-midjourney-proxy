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
 {  "label": "即梦 4.0", "value": "doubao-seedream-4-0-250828" }
 ,{  "label": "即梦 3.0", "value": "seedream-3.0" }
]
});
interface myFile{
    file:any
    base64:string
}
const st =ref({isGo:false,quality:'medium', watermark: true });
const fsRef= ref() ;
const base64Array= ref<myFile[]>([]);
const f = ref({size:'1024x1024', prompt:'',"model": "doubao-seedream-4-0-250828","n": 1});
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

    // 即梦4/即梦3 使用标准流程
    let obj= {
        action:'gpt.dall-e-3',
        data:{} //f.value
    }
    obj.data= { ...f.value}

    // 添加即梦4特有参数
    obj.data= {
        ...obj.data,
        watermark: st.value.watermark,  // 水印参数
        response_format: 'url'
    };

    mlog('🎨 [即梦绘图] 发送请求数据：', {
        model: obj.data.model,
        n: obj.data.n,
        size: obj.data.size,
        watermark: obj.data.watermark,
        hasImages: base64Array.value.length > 0
    });

    if(isCanImageEdit.value){
        obj.data= {...obj.data ,quality:st.value.quality};
    }
    if (isCanImageEdit.value && base64Array.value.length>0){
        obj.data= {...obj.data, 'base64Array':base64Array.value,quality:st.value.quality};
        mlog("data", '添加参考图片：',  base64Array.value  )
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
        watermark: st.value.watermark,
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
            f.value.model = config.model || 'doubao-seedream-4-0-250828';
            f.value.size = config.size || '1024x1024';
            f.value.prompt = config.prompt || '';
            f.value.n = config.n || 1;
            st.value.quality = config.quality || 'medium';
            st.value.watermark = config.watermark !== undefined ? config.watermark : true;

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
    // 即梦4和即梦3支持的尺寸
    if(f.value.model=='doubao-seedream-4-0-250828' || f.value.model=='seedream-3.0'){
        return [{
                "label": "2K (高质量)",
                "value": "2K"
            }, {
                "label": "1024x1024",
                "value": "1024x1024"
            }, {
                "label": "1792x1024",
                "value": "1792x1024"
            }, {
                "label": "1024x1792",
                "value": "1024x1792"
            }
        ];
    }
    // 默认尺寸
    return [{
                "label": "1024x1024",
                "value": "1024x1024"
            }, {
                "label": "1792x1024",
                "value": "1792x1024"
            }, {
                "label": "1024x1792",
                "value": "1024x1792"
            }
    ]
})
watch(()=>f.value.model,(n)=>{
    f.value.size='1024x1024';
})
const isCanImageEdit= computed(()=>{
    // 即梦4和即梦3都支持图片参考
    if(f.value.model=='doubao-seedream-4-0-250828' || f.value.model=='seedream-3.0') return true;
    return false;
})

// 组图数量选项
const batchCountOptions = computed(()=>{
    return [
        {label:'1张', value: 1},
        {label:'2张', value: 2},
        {label:'3张', value: 3},
        {label:'4张', value: 4}
    ];
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
     <div>模型版本</div>
    <n-select v-model:value="f.model" :options="config.model" filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center"  >
     <div>{{ $t('mjchat.size') }}</div>
    <n-select v-model:value="f.size" :options="dimensionsList"  filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center">
     <div>生成数量</div>
    <n-select v-model:value="f.n" :options="batchCountOptions"  filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center" v-if="isCanImageEdit" >
     <div>Quality</div>
    <n-select v-model:value="st.quality" :options="qualityOption"  filterable tag size="small"  class="!w-[70%]" :clearable="false" />
</section>
<section class="mb-4 flex justify-between items-center">
     <div>水印</div>
    <n-select v-model:value="st.watermark" :options="[{label:'开启',value:true},{label:'关闭',value:false}]" size="small"  class="!w-[70%]" :clearable="false" />
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

<div class="pt-4 text-sm text-gray-500 dark:text-gray-400">
    <p class="mb-2 font-medium">即梦绘图说明：</p>
    <ul class="list-disc list-inside space-y-1.5">
        <li>支持即梦 4.0 和即梦 3.0 模型</li>
        <li>可上传最多 3 张参考图片进行图生图</li>
        <li>支持 2K 高质量输出</li>
        <li>可选择是否添加水印</li>
        <li class="text-orange-600 dark:text-orange-400 font-medium">
            <span class="font-bold">多图生成提示：</span>如需生成多张图片，请设置生成数量，<span class="underline">并在提示词中明确说明</span>（例如："生成3张xxx"、"连环画"、"多角度"等），否则可能只返回1张图片
        </li>
    </ul>
</div>

<input type="file"  @change="selectFile"  ref="fsRef" style="display: none" accept="image/jpeg, image/jpg, image/png, image/gif"/>

</template>

<style scoped>
.myblend{
    --my-blend-img-size:75px
}
</style>
