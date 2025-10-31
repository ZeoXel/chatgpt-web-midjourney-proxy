<script setup lang="ts">
import { viduFeed } from '@/api/vidu';
import { ViduTask, ViduStore } from '@/api/viduStore';
import { onMounted, ref, watch } from 'vue';
import { NEmpty, NButton, NButtonGroup, useMessage, NPopconfirm } from "naive-ui";
import { mlog } from '@/api';
import { SvgIcon } from '@/components/common';
import { t } from '@/locales';
import { homeStore } from '@/store';
import { downloadVideo } from '@/utils/download';

const st = ref({ pIndex: -1 });
const list = ref<ViduTask[]>([]);
const cvidu = new ViduStore();

const ms = useMessage();

const initLoad = () => {
  let arr = cvidu.getObjs();
  list.value = arr.reverse();
};

const deleteGo = (item: ViduTask) => {
  mlog('deleteGo', item);
  cvidu.remove(item.task_id);
  ms.success(t('common.deleteSuccess'));
  initLoad();
};

const handleDownload = async (url: string, prompt: string) => {
  try {
    const filename = `vidu_${prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;
    const success = await downloadVideo(url, filename);
    if (success) {
      ms.success(t('video.downloadSuccess') || '下载成功');
    } else {
      ms.error(t('video.downloadFailed') || '下载失败');
    }
  } catch (error) {
    mlog('download error', error);
    ms.error(t('video.downloadFailed') || '下载失败');
  }
};

// 监听Vidu任务更新
watch(() => homeStore.myData.act, (n) => {
  if (n === 'ViduFeed') initLoad();
});

onMounted(() => {
  initLoad();
  homeStore.setMyData({ ms: ms });
});
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
          <template v-if="item.state === 'success' && item.creations && item.creations.length > 0">
            <video
              loop
              playsinline
              :controls="st.pIndex === index"
              referrerpolicy="no-referrer"
              :poster="item.creations[0].cover_url"
              controlsList="nodownload"
              class="w-full h-full object-cover"
            >
              <source
                :src="item.creations[0].url"
                referrerpolicy="no-referrer"
                type="video/mp4"
                v-if="st.pIndex === index"
              >
            </video>
          </template>

          <!-- 失败状态 -->
          <div v-else-if="item.state === 'failed'" class="w-full h-[200px] justify-center items-center flex text-center">
            {{ t('video.failed') }}<br>
            ID: {{ item.task_id }}<br>
            <span class="text-red-500">{{ item.err_code }}</span>
          </div>

          <!-- 处理中状态 -->
          <div v-else-if="item.state === 'processing' || item.state === 'queueing'" class="pt-2">
            <div>
              {{ $t('video.process') }}{{ new Date(item.last_feed || Date.now()).toLocaleString() }}
            </div>
            <div v-if="item.state === 'queueing'" class="text-center">{{ t('video.pending') }}</div>
          </div>

          <!-- 超时或需要重新查询 -->
          <template v-else-if="!item.last_feed || ((new Date().getTime()) - item.last_feed) > 60 * 1000">
            <div class="w-full h-[200px] justify-center items-center flex">
              <NButton size="small" type="primary" @click="viduFeed(item.task_id)">
                {{ $t('video.repeat') }}
              </NButton>
            </div>
          </template>

          <!-- 默认状态 -->
          <div v-else class="pt-2">
            <div>
              {{ $t('video.process') }}{{ new Date(item.created_at || Date.now()).toLocaleString() }}
            </div>
            <div class="text-center">{{ item.state }}</div>
          </div>
        </div>

        <!-- 视频信息和操作按钮 -->
        <div class="flex justify-between items-center">
          <section>
            <div class="line-clamp-1">{{ item.prompt }}</div>
          </section>
          <section class="flex justify-end items-center pt-1">
            <n-button-group size="tiny">
              <n-button
                size="tiny"
                round
                ghost
                v-if="item.state === 'success' && item.creations && item.creations[0]?.url"
                @click="handleDownload(item.creations[0].url, item.prompt)"
              >
                <SvgIcon icon="mdi:download" size="sm" /> {{ $t('video.download') }}
              </n-button>
              <n-button size="tiny" round ghost>
                <n-popconfirm @positive-click="() => deleteGo(item)" placement="bottom">
                  <template #trigger> <SvgIcon icon="mdi:delete" /></template>
                  {{ $t('mj.confirmDelete') }}
                </n-popconfirm>
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