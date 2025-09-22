<script setup lang='ts'>
import { computed ,watch,ref, inject, Ref} from 'vue'
import { NInput, NPopconfirm, NScrollbar, NCheckbox } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { gptConfigStore, gptConfigType, homeStore, useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { debounce } from '@/utils/functions/debounce'
import { chatSetting, mlog } from '@/api'
import AiListText from '@/views/mj/aiListText.vue'
import { sleep } from '@/api/suno'

const { isMobile } = useBasicLayout()

const appStore = useAppStore()
const chatStore = useChatStore()

// 注入批量删除相关状态
const isBatchDeleteMode = inject<Ref<boolean>>('batchDeleteMode', ref(false))
const selectedItems = inject<Ref<Set<number>>>('selectedItems', ref(new Set()))

const dataSources = computed(() => chatStore.history)

async function handleSelect({ uuid }: Chat.History) {
  // 如果是批量删除模式，则切换选择状态
  if (isBatchDeleteMode.value) {
    if (selectedItems.value.has(uuid)) {
      selectedItems.value.delete(uuid)
    } else {
      selectedItems.value.add(uuid)
    }
    return
  }

  // 正常选择模式
  if (isActive(uuid))
    return

  if (chatStore.active)
    chatStore.updateHistory(chatStore.active, { isEdit: false })
  await chatStore.setActive(uuid)

  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

function handleEdit({ uuid }: Chat.History, isEdit: boolean, event?: MouseEvent) {
  event?.stopPropagation()
  chatStore.updateHistory(uuid, { isEdit })
}

function handleDelete(index: number, event?: MouseEvent | TouchEvent) {
  event?.stopPropagation()
  chatStore.deleteHistory(index)
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

const handleDeleteDebounce = debounce(handleDelete, 600)

function handleEnter({ uuid }: Chat.History, isEdit: boolean, event: KeyboardEvent) {
  event?.stopPropagation()
  if (event.key === 'Enter')
    chatStore.updateHistory(uuid, { isEdit })
}

function isActive(uuid: number) {
  return chatStore.active === uuid
}

const chatSet= new chatSetting( chatStore.active??1002);
const myuid= ref<gptConfigType[]>( []) //computed( ()=>chatSet.getObjs() ) ;

//找假死的原因了 修复卡死
const toMyuid=  debounce(  ()=>{
    mlog('toMyuid7' );
   // await sleep(500);
    myuid.value= chatSet.getObjs(); //用了 这个就会卡死？
   },600);

toMyuid();
const isInObjs= (uuid:number):undefined|gptConfigType =>{
  if(!myuid.value.length) return ;
  const index = myuid.value.findIndex((item:gptConfigType)=>{
    return item.uuid==uuid
  })
  if(index==-1) return ;
  mlog('index 这个地方有bug',uuid,index, myuid.value[index]  );
  return myuid.value[index] ;
}
watch(()=>homeStore.myData.act,(n:string)=>n=='saveChat' && toMyuid() , {deep:true})
watch(()=>gptConfigStore.myData , toMyuid , {deep:true})

</script>

<template>
  <NScrollbar class="px-4">
    <div class="flex flex-col gap-2 text-sm">
      <template v-if="!dataSources.length">
        <div class="flex flex-col items-center mt-4 text-center text-neutral-300">
          <SvgIcon icon="ri:inbox-line" size="2xl" class="mb-2" />
          <span>{{ $t('common.noData') }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="(item, index) of dataSources" :key="index">
          <a
            class="relative flex items-center gap-3 px-3 py-3 break-all border rounded-md cursor-pointer hover:bg-neutral-100 group dark:border-neutral-800 dark:hover:bg-[#24272e]"
            :class="[
              isActive(item.uuid) && !isBatchDeleteMode && ['border-[#445ff6]', 'bg-neutral-100', 'text-[#445ff6]', 'dark:bg-[#24272e]', 'dark:border-[#445ff6]', 'pr-14'],
              selectedItems.has(item.uuid) && isBatchDeleteMode && ['border-red-500', 'bg-red-50', 'dark:bg-red-900/20']
            ]"
            @click="handleSelect(item)"
          >
            <!-- 批量删除模式下的选择框 -->
            <div v-if="isBatchDeleteMode" class="flex items-center" @click.stop>
              <NCheckbox
                :checked="selectedItems.has(item.uuid)"
                @update:checked="(checked) => {
                  if (checked) {
                    selectedItems.add(item.uuid)
                  } else {
                    selectedItems.delete(item.uuid)
                  }
                }"
              />
            </div>

             <AiListText   :myObj="isInObjs(item.uuid)" :myItem="item">
               <NInput
                v-if="item.isEdit"
                v-model:value="item.title" size="tiny"
                @keypress="handleEnter(item, false, $event)"
              />
             </AiListText>
            <div v-if="isActive(item.uuid) && !isBatchDeleteMode" class="absolute z-10 flex visible right-1">
              <template v-if="item.isEdit">
                <button class="p-1" @click="handleEdit(item, false, $event)">
                  <SvgIcon icon="ri:save-line" size="sm" />
                </button>
              </template>
              <template v-else>
                <button class="p-1">
                  <SvgIcon icon="ri:edit-line" size="sm" @click="handleEdit(item, true, $event)" />
                </button>
                <NPopconfirm placement="bottom" @positive-click="handleDeleteDebounce(index, $event)">
                  <template #trigger>
                    <button class="p-1">
                      <SvgIcon icon="ri:delete-bin-line" size="sm" />
                    </button>
                  </template>
                  {{ $t('chat.deleteHistoryConfirm') }}
                </NPopconfirm>
              </template>
            </div>
          </a>
        </div>
      </template>
    </div>
  </NScrollbar>
</template>
