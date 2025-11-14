<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import { UnifiedVideoTask, UnifiedVideoStore } from '@/api/videoStore';
import { NButton, NButtonGroup, NPopconfirm, useMessage, NTooltip } from 'naive-ui';
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
const videoRef = ref<HTMLVideoElement | null>(null);
const DEFAULT_EXPIRE_TEXT = '链接已过期';
const expireState = ref(props.task.expired === true);
const expireReason = ref(props.task.expire_reason || (expireState.value ? DEFAULT_EXPIRE_TEXT : ''));
const checking = ref(false);
const hasChecked = ref(false); // ✅ 标记是否已经检查过可用性
const store = new UnifiedVideoStore();
const message = useMessage();

// 服务信息映射
const serviceInfo: Record<string, { name: string; color: string }> = {
  vidu: { name: 'Vidu', color: '#445ff6' },
  runway: { name: 'Runway', color: '#7f0df9' },
  pika: { name: 'Pika', color: '#ff6b6b' },
  kling: { name: 'Kling', color: '#4ecdc4' },
  runwayml: { name: 'RunwayML', color: '#7f0df9' },
  sora2: { name: 'Sora 2', color: '#52c41a' },
  minimax: { name: 'MiniMax', color: '#2f54eb' }
};

const currentService = serviceInfo[props.task.service] || { name: props.task.service, color: '#666' };
const hasPreview = computed(() => props.task.status === 'success' && !!props.task.url && !expireState.value);

const formatTimestamp = (value: number | string) => {
  if (!value)
    return '';
  const dateValue = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(dateValue))
    return '';
  return new Date(dateValue).toLocaleString();
};

const showProgress = computed(() => props.task.model !== 'runway-aleph' && props.task.progress !== undefined);

const processingHint = computed(() => {
  if (props.task.model === 'runway-aleph') {
    const createdAt = typeof props.task.created_at === 'number' ? props.task.created_at : Date.parse(props.task.created_at);
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));

    if (elapsedMinutes < 1)
      return '排队中，预计 10-15 分钟完成';
    if (elapsedMinutes < 10)
      return `已等待 ${elapsedMinutes} 分钟，预计 10-15 分钟完成`;
    if (elapsedMinutes < 15)
      return `进入处理阶段，预计还需 ${15 - elapsedMinutes} 分钟`;

    return '已超过 15 分钟，如仍未完成可稍后再查看';
  }

  return formatTimestamp(props.task.updated_at);
});

const markExpired = (reason?: string) => {
  if (expireState.value)
    return;

  expireState.value = true;
  expireReason.value = reason ? `${DEFAULT_EXPIRE_TEXT} (${reason})` : DEFAULT_EXPIRE_TEXT;
  store.markExpired(props.task.id, expireReason.value);
};

const handleVideoError = () => {
  markExpired('load error');
};

const copyPrompt = async () => {
  const text = props.task?.prompt || '';
  if (!text) {
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    message.success('提示词已复制');
  } catch (e) {
    message.error('复制失败');
  }
};

const checkAvailability = async () => {
  // ✅ 防止重复检查: 已检查过、正在检查、已过期、无URL
  if (hasChecked.value || checking.value || expireState.value || !props.task.url)
    return;

  checking.value = true;
  hasChecked.value = true; // ✅ 标记为已检查,防止重复

  try {
    let headResponse: Response | null = null;
    try {
      headResponse = await fetch(props.task.url, { method: 'HEAD' });
    }
    catch (error) {
      console.warn('[UnifiedVideoCard] HEAD availability check failed:', error);
    }

    if (headResponse) {
      if (headResponse.ok)
        return;

      if (headResponse.status >= 400 && headResponse.status !== 405 && headResponse.status !== 501) {
        markExpired(`HTTP ${headResponse.status}`);
        return;
      }
    }

    try {
      const response = await fetch(props.task.url, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-1'
        }
      });
      if (!response.ok && response.status >= 400)
        markExpired(`HTTP ${response.status}`);
    }
    catch (error) {
      console.warn('[UnifiedVideoCard] Range availability check failed:', error);
    }
  }
  catch (error) {
    console.warn('[UnifiedVideoCard] Availability check failed:', error);
  }
  finally {
    checking.value = false;
  }
};

const tryLoadVideo = async () => {
  if (!hasPreview.value)
    return;
  await nextTick();
  videoRef.value?.load();
  checkAvailability();
};

onMounted(() => {
  if (expireState.value)
    return;
  tryLoadVideo();
});

// ✅ 优化watch: 只监听真正会影响视频可用性的关键属性,忽略updated_at避免轮询时重复触发
watch(() => [props.task.url, props.task.status, props.task.expired, props.task.expire_reason], ([newUrl, newStatus, newExpired, newExpireReason], [oldUrl, oldStatus, oldExpired, oldExpireReason]) => {
  // 更新过期状态
  expireState.value = props.task.expired === true;
  expireReason.value = props.task.expire_reason || (expireState.value ? DEFAULT_EXPIRE_TEXT : '');

  if (expireState.value)
    return;

  // ✅ 只在URL变化或状态变为成功时才重新检查
  const urlChanged = newUrl !== oldUrl;
  const statusChangedToSuccess = newStatus === 'success' && oldStatus !== 'success';

  if (urlChanged || statusChangedToSuccess) {
    // URL变化时重置检查标记,允许重新检查
    if (urlChanged) {
      hasChecked.value = false;
    }
    tryLoadVideo();
  }
});
</script>

<template>
  <div
    @mouseenter="isHover = true"
    @mouseleave="isHover = false"
  >
    <!-- 视频容器 - 固定16:9比例 -->
    <div class="relative flex items-center justify-center bg-white bg-opacity-10 rounded-[16px] overflow-hidden aspect-[16/8.85]">

      <!-- 成功状态 - 显示视频 -->
      <template v-if="hasPreview">
        <video
          ref="videoRef"
          loop
          playsinline
          muted
          :controls="isHover"
          :poster="task.poster"
          preload="metadata"
          @error="handleVideoError"
          controlsList="nodownload"
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
        >
          <source
            :src="task.url"
            type="video/mp4"
            referrerpolicy="no-referrer"
          >
        </video>
      </template>

      <!-- 过期状态 -->
      <div
        v-else-if="expireState"
        class="w-full h-[200px] flex flex-col justify-center items-center text-center p-4 bg-black/10 dark:bg-white/5"
      >
        <SvgIcon icon="mdi:link-variant-off" size="lg" class="text-red-400 mb-2" />
        <div class="text-red-400 font-medium">
          {{ expireReason || DEFAULT_EXPIRE_TEXT }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          更新时间: {{ new Date(task.updated_at).toLocaleString() }}
        </div>
      </div>

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
        <div v-if="showProgress" class="text-lg font-bold text-blue-500">
          {{ task.progress }}%
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ processingHint }}
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
          <!-- 复制提示词（仅图标，悬停提示） -->
          <n-tooltip v-if="task.prompt" trigger="hover" placement="bottom">
            <template #trigger>
              <n-button size="tiny" round ghost @click="copyPrompt">
                <SvgIcon icon="mdi:content-copy" size="xs" />
              </n-button>
            </template>
            <span>{{ t('vidu.actions.copy') }}</span>
          </n-tooltip>
          <!-- 下载按钮 -->
          <n-tooltip
            v-if="task.status === 'success' && task.url && !expireState"
            trigger="hover"
            placement="bottom"
          >
            <template #trigger>
              <n-button size="tiny" round ghost>
                <a
                  :href="task.url"
                  download
                  target="_blank"
                  class="flex justify-center items-center gap-1"
                >
                  <SvgIcon icon="mdi:download" size="sm" />
                </a>
              </n-button>
            </template>
            <span>{{ t('video.download') }}</span>
          </n-tooltip>

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
