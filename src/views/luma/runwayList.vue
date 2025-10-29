<script setup lang="ts">
import { RunwayTask, runwayStore } from '@/api/runwayStore';
import { ref, watch } from 'vue';
import { NEmpty, NButton, NButtonGroup, useMessage, NPopconfirm } from "naive-ui"
import { runwayFeed } from "@/api/runway"
import { mlog } from '@/api';
import { homeStore } from '@/store';
import { SvgIcon } from '@/components/common'
import { t } from '@/locales';

const ms = useMessage();
const mapRef = ref(new Map<string, number>());

const st = ref({ pIndex: -1 });
const list = ref<RunwayTask[]>([]);
const csuno = new runwayStore()

const initLoad = () => {
    let arr = csuno.getObjs();
    list.value = arr.reverse()
}

const extend = (item: RunwayTask) => {
    mlog("extend ", item)
    homeStore.setMyData({ act: "runway.extend", actData: item })
}

watch(() => homeStore.myData.act, (n) => {
    if (n == 'RunwayFeed') initLoad()
});

const videoError = (item: RunwayTask, index: number) => {
    mlog("videoError", index, item)
    mapRef.value.set(item.id, index + 1)
};

const reRunwayFeed = async (id: string) => {
    await runwayFeed(id)
    mapRef.value.delete(id)
}

const deleteGo = (item: RunwayTask) => {
    mlog('deleteGo', item)
    if (csuno.delete(item)) {
        ms.success(t('common.deleteSuccess'))
        initLoad()
    }
}

initLoad();

</script>
<template>
  <div v-if="list.length > 0" class="p-4">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(item, index) in list"
        :key="index"
        class="relative"
        @mousemove="st.pIndex = index"
        @mouseout="st.pIndex = -1"
      >
        <div class="relative flex items-center justify-center bg-white bg-opacity-10 rounded-[16px] overflow-hidden aspect-[16/8.85]">
          <!-- 成功状态：显示视频 -->
          <template v-if="item.artifacts && item.artifacts.length > 0 && item.artifacts[0].url">
            <div v-if="mapRef.has(item.id)">
              <NButton size="small" type="primary" @click="reRunwayFeed(item.id)">
                {{ $t('video.repeat2') }}
              </NButton>
            </div>
            <video
              v-else
              loop
              playsinline
              :controls="st.pIndex === index"
              referrerpolicy="no-referrer"
              :poster="item.artifacts[0].previewUrls[0]"
              controlsList="nodownload"
              class="w-full h-full object-cover"
              @error="videoError(item, index)"
            >
              <source
                :src="item.artifacts[0].url"
                referrerpolicy="no-referrer"
                type="video/mp4"
                v-if="st.pIndex === index"
              >
            </video>
          </template>

          <!-- 失败状态 -->
          <div v-else-if="item.status === 'FAILED'" class="w-full h-[200px] justify-center items-center flex text-center">
            {{ $t('video.failed') }}<br>
            <div class="line-clamp-3">{{ item.progressText }}</div>
          </div>

          <!-- 超时或需要重新查询 -->
          <template v-else-if="!item.last_feed || ((new Date().getTime()) - item.last_feed) > 20 * 1000">
            <div class="w-full h-[200px] justify-center items-center flex">
              <NButton size="small" type="primary" @click="runwayFeed(item.id)">
                {{ $t('video.repeat') }}
              </NButton>
            </div>
          </template>

          <!-- 处理中状态 -->
          <div v-else class="pt-2">
            <div>
              {{ $t('video.process') }}{{ new Date(item.last_feed).toLocaleString() }}
            </div>
            <div v-if="item.progressRatio">{{ (parseFloat(item.progressRatio) * 100).toFixed(0) }}%</div>
            <div v-else-if="item.estimatedTimeToStartSeconds && item.estimatedTimeToStartSeconds > 0">
              {{ item.estimatedTimeToStartSeconds.toFixed(1) }}秒后开始执行
            </div>
          </div>
        </div>

        <!-- 视频信息和操作按钮 -->
        <div class="flex justify-between items-center">
          <section>
            <div class="line-clamp-1">
              <template v-if="item.options.text_prompt">{{ item.options.text_prompt }}</template>
              <template v-else>{{ item.options.gen2Options?.text_prompt ? item.options.gen2Options.text_prompt : item.name }}</template>
            </div>
          </section>
          <section class="flex justify-end items-center pt-1" v-if="item.artifacts && item.artifacts.length > 0 && item.artifacts[0].url">
            <n-button-group size="tiny">
              <n-button size="tiny" round ghost>
                <a :href="item.artifacts[0].url" download target="_blank" class="flex justify-center items-center">
                  <SvgIcon icon="mdi:download" size="sm" /> {{ $t('video.download') }}
                </a>
              </n-button>
              <n-button size="tiny" round ghost>
                <n-popconfirm @positive-click="() => deleteGo(item)" placement="bottom">
                  <template #trigger> <SvgIcon icon="mdi:delete" /></template>
                  {{ $t('mj.confirmDelete') }}
                </n-popconfirm>
              </n-button>
              <n-button size="tiny" round ghost @click="extend(item)">
                <SvgIcon icon="ri:video-add-line" size="xs" /> {{ $t('video.extend') }}
              </n-button>
            </n-button-group>
          </section>
        </div>
      </div>
    </div>
  </div>

  <!-- 空状态 -->
  <div class="w-full h-full flex justify-center items-center" v-else>
    <NEmpty :description="$t('video.nodata')"></NEmpty>
  </div>
</template>