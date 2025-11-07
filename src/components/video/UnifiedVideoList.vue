<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { UnifiedVideoStore } from '@/api/videoStore';
import UnifiedVideoCard from './UnifiedVideoCard.vue';
import { NEmpty, useMessage } from 'naive-ui';
import { homeStore } from '@/store';
import { t } from '@/locales';
import { mlog } from '@/api';

const ms = useMessage();
const store = new UnifiedVideoStore();
const list = ref(store.getAll());

// 刷新列表 - 显示所有服务的任务
const refresh = () => {
  mlog('🔄 [UnifiedVideoList] Refreshing all tasks...');

  store.cleanup();

  // 重新获取所有数据
  const allTasks = store.getAll();
  list.value = allTasks;

  mlog('📦 [UnifiedVideoList] Total tasks:', allTasks.length);

  // 输出每个任务的简要信息和时间戳
  if (list.value.length > 0) {
    const serviceCount: Record<string, number> = {};
    list.value.forEach((task, index) => {
      serviceCount[task.service] = (serviceCount[task.service] || 0) + 1;
      const date = new Date(task.created_at);
      mlog(`  ${index+1}. [${task.service}] ${task.id.substring(0, 8)}... status=${task.status} created=${date.toLocaleString()} (${task.created_at})`);
    });

    // 输出各服务统计
    Object.entries(serviceCount).forEach(([service, count]) => {
      mlog(`  📊 ${service}: ${count} tasks`);
    });
  }
};

// 监听全局事件,自动刷新
watch(() => homeStore.myData.act, (act) => {
const feedEvents = ['ViduFeed', 'RunwayFeed', 'PikaFeed', 'KlingFeed', 'RunwayMLFeed', 'Sora2Feed', 'MiniMaxFeed'];
  if (feedEvents.includes(act)) {
    mlog('🔔 [UnifiedVideoList] Feed event received:', act);
    refresh();
  }
});

// 删除任务
const handleDelete = (id: string) => {
  if (store.delete(id)) {
    ms.success(t('common.deleteSuccess'));
    refresh();
  }
};

// 扩展任务 (Runway)
const handleExtend = (task: any) => {
  mlog('🎬 [UnifiedVideoList] Extending video:', task.id);
  // 触发Runway扩展功能,传递原始任务数据
  homeStore.setMyData({
    act: 'runway.extend',
    actData: task.extra?.originalTask || task
  });
};

// 组件挂载时加载数据
onMounted(() => {
  mlog('📦 [UnifiedVideoList] Component mounted - showing all services');
  refresh();
  homeStore.setMyData({ ms: ms });
});
</script>

<template>
  <div v-if="list.length > 0" class="p-4">
    <!-- Grid布局 - 响应式 -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      <UnifiedVideoCard
        v-for="task in list"
        :key="task.id"
        :task="task"
        :show-extend="task.service === 'runway'"
        @delete="handleDelete(task.id)"
        @extend="handleExtend(task)"
      />
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else class="w-full h-full flex justify-center items-center">
    <NEmpty :description="$t('video.nodata')"></NEmpty>
  </div>
</template>

<style scoped>
/* Grid布局动画 */
.grid > * {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
