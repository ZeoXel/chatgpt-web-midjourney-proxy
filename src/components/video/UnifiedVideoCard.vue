<script setup lang="ts">
import { ref } from 'vue';
import { UnifiedVideoTask } from '@/api/videoStore';
import { NButton, NButtonGroup, NPopconfirm } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { t } from '@/locales';

const props = defineProps<{
  task: UnifiedVideoTask;
  showExtend?: boolean; // Runway扩展功能
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'extend'): void;
  (e: 'retry'): void;
}>();

const isHover = ref(false);

// 服务信息映射
const serviceInfo: Record<string, { name: string; color: string }> = {
  vidu: { name: 'Vidu', color: '#445ff6' },
  runway: { name: 'Runway', color: '#7f0df9' },
  pika: { name: 'Pika', color: '#ff6b6b' },
  kling: { name: 'Kling', color: '#4ecdc4' },
  runwayml: { name: 'RunwayML', color: '#7f0df9' },
  sora2: { name: 'Sora 2', color: '#52c41a' }
};

const currentService = serviceInfo[props.task.service] || { name: props.task.service, color: '#666' };
</script>

<template>
  <div
    @mouseenter="isHover = true"
    @mouseleave="isHover = false"
  >
    <!-- 视频容器 - 固定16:9比例 -->
    <div class="relative flex items-center justify-center bg-white bg-opacity-10 rounded-[16px] overflow-hidden aspect-[16/8.85]">

      <!-- 成功状态 - 显示视频 -->
      <template v-if="task.status === 'success' && task.url">
        <video
          loop
          playsinline
          :controls="isHover"
          :poster="task.poster"
          controlsList="nodownload"
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
        >
          <!-- 性能优化:悬停时才加载视频源 -->
          <source
            v-if="isHover"
            :src="task.url"
            type="video/mp4"
            referrerpolicy="no-referrer"
          >
        </video>
      </template>

      <!-- 失败状态 -->
      <div
        v-else-if="task.status === 'failed'"
        class="w-full h-[200px] flex flex-col justify-center items-center text-center p-4"
      >
        <div class="text-red-500 mb-2 font-medium">{{ t('video.failed') }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 line-clamp-3">
          {{ task.error || 'Unknown error' }}
        </div>
        <!-- 重试按钮(如果有) -->
        <!-- <NButton
          size="small"
          type="primary"
          class="mt-3"
          @click="emit('retry')"
        >
          {{ t('video.repeat') }}
        </NButton> -->
      </div>

      <!-- 处理中状态 -->
      <div
        v-else-if="task.status === 'processing'"
        class="flex flex-col items-center justify-center p-4"
      >
        <div class="mb-2">{{ t('video.process') }}</div>
        <div v-if="task.progress !== undefined" class="text-lg font-bold text-blue-500">
          {{ task.progress }}%
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ new Date(task.updated_at).toLocaleString() }}
        </div>
      </div>

      <!-- 待处理状态 -->
      <div
        v-else-if="task.status === 'pending'"
        class="flex flex-col items-center justify-center p-4"
      >
        <div class="text-gray-600 dark:text-gray-400">{{ t('video.pending') }}</div>
        <div class="text-xs text-gray-400 mt-2">
          {{ new Date(task.created_at).toLocaleString() }}
        </div>
      </div>

      <!-- 其他/未知状态 -->
      <div v-else class="flex items-center justify-center text-gray-500">
        <div class="animate-pulse">Loading...</div>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="flex justify-between items-center mt-2">
      <!-- 左侧: 服务标识 + 模型 -->
      <section class="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
        <span
          class="text-xs px-2 py-0.5 rounded"
          :style="{ backgroundColor: currentService.color + '20', color: currentService.color }"
        >
          {{ currentService.name }}
        </span>
        <span class="text-xs text-gray-400 truncate">{{ task.model }}</span>
      </section>

      <!-- 右侧: 操作按钮 -->
      <section class="flex justify-end items-center flex-shrink-0">
        <n-button-group size="tiny">
          <!-- 下载按钮 -->
          <n-button
            v-if="task.status === 'success' && task.url"
            size="tiny"
            round
            ghost
          >
            <a
              :href="task.url"
              download
              target="_blank"
              class="flex justify-center items-center gap-1"
            >
              <SvgIcon icon="mdi:download" size="sm" />
              {{ t('video.download') }}
            </a>
          </n-button>

          <!-- 扩展按钮 (仅Runway) -->
          <n-button
            v-if="showExtend && task.status === 'success'"
            size="tiny"
            round
            ghost
            @click="emit('extend')"
          >
            <SvgIcon icon="ri:video-add-line" size="xs" />
            {{ t('video.extend') }}
          </n-button>

          <!-- 删除按钮 -->
          <n-button size="tiny" round ghost>
            <n-popconfirm @positive-click="emit('delete')" placement="bottom">
              <template #trigger>
                <SvgIcon icon="mdi:delete" />
              </template>
              {{ t('mj.confirmDelete') }}
            </n-popconfirm>
          </n-button>
        </n-button-group>
      </section>
    </div>

    <!-- 提示词 -->
    <div class="line-clamp-2 text-sm mt-1 text-gray-600 dark:text-gray-400">
      {{ task.prompt }}
    </div>

    <!-- 额外信息(可选显示) -->
    <div v-if="task.duration || task.aspect_ratio" class="flex gap-3 text-xs text-gray-400 mt-1">
      <span v-if="task.duration">{{ task.duration }}s</span>
      <span v-if="task.aspect_ratio">{{ task.aspect_ratio }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 视频控制器样式优化 */
video::-webkit-media-controls {
  opacity: 0;
  transition: opacity 0.3s;
}

video:hover::-webkit-media-controls {
  opacity: 1;
}
</style>
