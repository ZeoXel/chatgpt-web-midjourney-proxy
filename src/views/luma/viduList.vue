<script setup lang="ts">
import { viduFeed } from '@/api/vidu';
import { ViduTask, ViduStore } from '@/api/viduStore';
import { onMounted, ref, watch } from 'vue';
import { NEmpty, NButton, NPopover, NButtonGroup, useMessage, NPopconfirm } from "naive-ui";
import { mlog } from '@/api';
import { SvgIcon } from '@/components/common';
import { t } from '@/locales';
import { homeStore } from '@/store';

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

// 刷新任务状态
const refreshTask = (taskId: string) => {
  mlog('refreshTask', taskId);
  viduFeed(taskId);
  ms.info('正在刷新任务状态...');
};

// 下载视频
const downloadVideo = (url: string) => {
  mlog('downloadVideo', url);
  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `vidu_video_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    ms.error('视频链接无效');
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
    <div class="grid gap-5" :class="[
      'grid-cols-1',
      'md:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-4'
    ]">
      <div
        v-for="(item, index) in list"
        :key="index"
        class="relative"
        @mousemove="st.pIndex = index"
        @mouseout="st.pIndex = -1"
      >
        <div
          class="relative flex items-center justify-center bg-white bg-opacity-10 rounded-[16px] overflow-hidden"
          :class="{
            'aspect-[16/9]': item.aspect_ratio === '16:9',
            'aspect-[9/16]': item.aspect_ratio === '9:16',
            'aspect-square': item.aspect_ratio === '1:1',
            'aspect-[16/8.85]': !item.aspect_ratio
          }"
        >
          <!-- 成功状态：显示视频 -->
          <template v-if="item.state === 'success' && item.creations && item.creations.length > 0">
            <video
              loop
              playsinline
              :controls="st.pIndex === index"
              class="w-full h-full object-cover"
              :poster="item.creations[0].cover_url"
              controlsList="nodownload"
            >
              <source
                :src="item.creations[0].url"
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
          <div v-else-if="item.state === 'processing' || item.state === 'queueing'" class="w-full h-[200px] justify-center items-center flex flex-col">
            <div class="text-center mb-2">
              <SvgIcon icon="eos-icons:loading" size="2xl" class="animate-spin" />
            </div>
            <div>{{ item.state === 'processing' ? t('video.process') : t('video.pending') }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ new Date(item.last_feed || Date.now()).toLocaleString() }}
            </div>
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
          <div v-else class="w-full h-[200px] justify-center items-center flex">
            <div class="text-center">
              <div>状态: {{ item.state }}</div>
              <div class="text-xs mt-1">{{ new Date(item.created_at || Date.now()).toLocaleString() }}</div>
            </div>
          </div>
        </div>

        <!-- 视频信息和操作按钮 -->
        <div class="flex justify-between items-center mt-2">
          <section class="flex-1 mr-2">
            <div class="line-clamp-1 text-sm" :title="item.prompt">{{ item.prompt }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ item.duration }}秒 · {{ item.aspect_ratio }} · {{ item.model }}
            </div>
          </section>

          <section class="flex justify-end items-center">
            <n-button-group size="tiny">
              <!-- 刷新按钮 -->
              <n-button @click="refreshTask(item.task_id)" :title="'刷新状态'">
                <SvgIcon icon="material-symbols:refresh" />
              </n-button>

              <!-- 下载按钮 -->
              <n-button
                v-if="item.state === 'success' && item.creations && item.creations[0]?.url"
                @click="downloadVideo(item.creations[0].url)"
                :title="'下载视频'"
              >
                <SvgIcon icon="material-symbols:download" />
              </n-button>

              <!-- 删除按钮 -->
              <n-popconfirm @positive-click="deleteGo(item)">
                <template #trigger>
                  <n-button type="error" :title="'删除'">
                    <SvgIcon icon="material-symbols:delete" />
                  </n-button>
                </template>
                {{ t('common.deleteConfirm') }}
              </n-popconfirm>
            </n-button-group>
          </section>
        </div>
      </div>
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else class="flex justify-center items-center h-[400px]">
    <NEmpty :description="t('video.noData')" />
  </div>
</template>