<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { NCard, NImage, NButton, NButtonGroup, NTag, NSpin, NProgress, NTooltip, NEmpty, NTime, NPopconfirm } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { viduGetTask, viduCancelTask, viduFeed, mlog, pollPendingTasks, getViduErrorMessage } from '@/api';
import { ViduTask, viduStore } from '@/api/viduStore';
import { useMessage } from 'naive-ui';
import { homeStore } from '@/store';

const ms = useMessage();
const tasks = ref<ViduTask[]>([]);
const loading = ref(false);
const st = ref({ pIndex: -1 }); // 鼠标悬停状态管理，类似其他模块
let pollTimer: NodeJS.Timeout | null = null;

// 加载任务列表
const loadTasks = () => {
  tasks.value = viduStore.getObjs().sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

// 检查单个任务状态
const checkTaskStatus = async (task: ViduTask) => {
  if (task.state === 'success' || task.state === 'failed') return;
  
  try {
    const updatedTask = await viduGetTask(task.task_id);
    if (updatedTask) {
      loadTasks(); // 重新加载列表
    }
  } catch (error) {
    mlog("checkTaskStatus error", error);
  }
};

// 轮询待处理任务
const pollTasks = async () => {
  const pendingTasks = tasks.value.filter(t => 
    t.state === 'created' || t.state === 'queueing' || t.state === 'processing'
  );
  
  if (pendingTasks.length > 0) {
    try {
      await pollPendingTasks();
      loadTasks();
    } catch (error) {
      mlog("pollTasks error", error);
    }
  }
};

// 取消任务
const cancelTask = async (task: ViduTask) => {
  try {
    const success = await viduCancelTask(task.task_id);
    if (success) {
      ms.success('任务已取消');
      loadTasks();
    } else {
      ms.error('取消失败，任务可能已开始处理');
    }
  } catch (error) {
    ms.error('取消失败: ' + (error as Error).message);
  }
};

// 删除任务
const deleteTask = (task: ViduTask) => {
  viduStore.remove(task.task_id);
  loadTasks();
  ms.success('任务已删除');
};

// 手动刷新单个任务状态 - 类似其他模块的实现
const refreshTask = async (task: ViduTask) => {
  mlog('refreshTask', task.task_id);
  viduFeed(task.task_id);
};

// 下载视频
const downloadVideo = (video: any) => {
  if (video.url) {
    const link = document.createElement('a');
    link.href = video.url;
    link.download = `vidu_${video.id}.mp4`;
    link.target = '_blank';
    link.click();
  }
};

// 获取状态颜色
const getStatusColor = (state: string) => {
  switch (state) {
    case 'success': return 'success';
    case 'failed': return 'error';
    case 'processing': return 'warning';
    case 'queueing': return 'info';
    default: return 'default';
  }
};

// 获取状态文本
const getStatusText = (state: string) => {
  switch (state) {
    case 'created': return '已创建';
    case 'queueing': return '排队中';
    case 'processing': return '处理中';
    case 'success': return '已完成';
    case 'failed': return '失败';
    default: return state;
  }
};

// 获取模型显示名称
const getModelName = (model: string) => {
  switch (model) {
    case 'viduq1': return 'Vidu Q1';
    case 'vidu2.0': return 'Vidu 2.0';
    case 'vidu1.5': return 'Vidu 1.5';
    default: return model;
  }
};

// 复制提示词
const copyPrompt = (prompt: string) => {
  navigator.clipboard.writeText(prompt).then(() => {
    ms.success('提示词已复制');
  }).catch(() => {
    ms.error('复制失败');
  });
};

// 清理存储空间
const cleanupStorage = () => {
  try {
    viduStore.cleanup();
    loadTasks();
    ms.success('存储空间已清理');
  } catch (error) {
    ms.error('清理失败: ' + (error as Error).message);
  }
};

// 获取存储信息
const storageInfo = computed(() => {
  return viduStore.getStorageInfo();
});

// 获取视频样式，固定尺寸不再适应窗口大小
const getVideoStyle = (aspectRatio: string) => {
  const ratioMap = {
    '16:9': { width: '480px', height: '270px' },  // 固定16:9尺寸
    '9:16': { width: '270px', height: '480px' },  // 固定9:16尺寸  
    '1:1': { width: '360px', height: '360px' }    // 固定1:1尺寸
  };
  
  const style = ratioMap[aspectRatio as keyof typeof ratioMap] || ratioMap['16:9'];
  
  return {
    width: style.width,
    height: style.height,
    objectFit: 'cover' as const,
    margin: '0 auto'
  };
};


// 监听homeStore状态变化 - 统一的状态管理方式
watch(() => homeStore.myData.act, (action) => {
  if (action === 'ViduFeed') {
    loadTasks();
  }
});

onMounted(() => {
  loadTasks();
  // 每5秒检查一次待处理任务
  pollTimer = setInterval(pollTasks, 5000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});

// 计算统计数据
const stats = computed(() => {
  const total = tasks.value.length;
  const completed = tasks.value.filter(t => t.state === 'success').length;
  const processing = tasks.value.filter(t => 
    t.state === 'created' || t.state === 'queueing' || t.state === 'processing'
  ).length;
  const failed = tasks.value.filter(t => t.state === 'failed').length;
  
  return { total, completed, processing, failed };
});
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 统计信息 -->
    <div v-if="tasks.length > 0" class="bg-white dark:bg-gray-800 rounded-lg p-4 border">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">任务统计</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">
            存储: {{ storageInfo.taskCount }}/{{ storageInfo.maxTasks }} 任务
          </span>
          <NPopconfirm
            @positive-click="cleanupStorage"
            placement="bottom"
          >
            <template #trigger>
              <NButton size="small" type="warning" quaternary>
                <SvgIcon icon="material-symbols:cleaning-services" size="md" />
                清理
              </NButton>
            </template>
            清理旧的任务数据以释放存储空间？
          </NPopconfirm>
        </div>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-blue-600">{{ stats.total }}</div>
          <div class="text-sm text-gray-500">总任务</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-green-600">{{ stats.completed }}</div>
          <div class="text-sm text-gray-500">已完成</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-orange-600">{{ stats.processing }}</div>
          <div class="text-sm text-gray-500">处理中</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-red-600">{{ stats.failed }}</div>
          <div class="text-sm text-gray-500">失败</div>
        </div>
      </div>
    </div>

    <!-- 任务列表 -->
    <div v-if="loading" class="flex justify-center py-8">
      <NSpin size="large" />
    </div>
    
    <div v-else-if="tasks.length === 0" class="py-12">
      <NEmpty description="还没有生成的视频">
        <template #icon>
          <SvgIcon icon="material-symbols:video-library-outline" size="6xl" class="text-gray-400" />
        </template>
      </NEmpty>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      <NCard 
        v-for="(task, index) in tasks" 
        :key="task.task_id"
        class="relative"
        :class="{'opacity-60': task.state === 'failed'}"
        @mousemove="st.pIndex = index"
        @mouseout="st.pIndex = -1"
      >
        <template #header>
          <div class="space-y-2">
            <!-- 状态和操作按钮行 -->
            <div class="flex justify-between items-center">
              <NTag :type="getStatusColor(task.state)" size="small">
                {{ getStatusText(task.state) }}
              </NTag>
              <NButtonGroup size="tiny">
              <!-- 复制提示词 -->
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton quaternary @click="copyPrompt(task.prompt)">
                    <SvgIcon icon="material-symbols:content-copy" size="sm" />
                  </NButton>
                </template>
                复制提示词
              </NTooltip>
              
              <!-- 删除任务 -->
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton quaternary type="error" @click="deleteTask(task)">
                    <SvgIcon icon="material-symbols:delete" size="sm" />
                  </NButton>
                </template>
                删除任务
              </NTooltip>
            </NButtonGroup>
            </div>
            
            <!-- 模型信息行 -->
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span>{{ getModelName(task.model) }}</span>
              <span>•</span>
              <span>{{ task.duration }}s</span>
              <span>•</span>
              <span>{{ task.resolution }}</span>
            </div>
            
            <!-- 提示词 -->
            <div class="text-sm font-medium line-clamp-2" :title="task.prompt">
              {{ task.prompt }}
            </div>
          </div>
        </template>
        
        <div class="space-y-3">
          <!-- 生成的视频 -->
          <div v-if="task.creations && task.creations.length > 0" class="space-y-3">
            <div 
              v-for="creation in task.creations" 
              :key="creation.id"
              class="relative"
            >
              <video
                :src="creation.url"
                :poster="creation.cover_url"
                :controls="st.pIndex === index"
                loop
                playsinline
                preload="metadata"
                controlsList="nodownload"
                class="rounded-lg bg-black"
                :style="getVideoStyle(task.aspect_ratio)"
              />
              
              <div 
                class="absolute top-2 right-2 space-x-1 transition-opacity duration-200"
                :class="{ 'opacity-0 group-hover:opacity-100': st.pIndex !== index, 'opacity-100': st.pIndex === index }"
              >
                <NTooltip trigger="hover">
                  <template #trigger>
                    <NButton 
                      size="small" 
                      type="primary"
                      @click="downloadVideo(creation)"
                    >
                      <SvgIcon icon="material-symbols:download" size="sm" />
                    </NButton>
                  </template>
                  下载视频
                </NTooltip>
              </div>
            </div>
          </div>
          
          <!-- 处理中状态 -->
          <div v-else-if="task.state === 'processing'" class="text-center py-8">
            <NSpin size="medium" />
            <p class="mt-2 text-gray-500">视频生成中...</p>
            <NProgress type="line" :show-indicator="false" processing class="mt-2" />
            <div class="mt-2">
              <!-- 基于last_feed时间差显示刷新按钮，类似其他模块 -->
              <NButtonGroup 
                v-if="!task.last_feed || ((new Date().getTime()) - task.last_feed) > 20 * 1000" 
                size="small"
              >
                <NButton type="primary" @click="refreshTask(task)">
                  <SvgIcon icon="material-symbols:refresh" size="md" />
                  重新获取
                </NButton>
                <NButton type="error" @click="cancelTask(task)">
                  取消任务
                </NButton>
              </NButtonGroup>
              <div v-else class="text-xs text-gray-400">
                处理中 {{ new Date(task.last_feed).toLocaleTimeString() }}
              </div>
            </div>
          </div>
          
          <!-- 排队状态 -->
          <div v-else-if="task.state === 'queueing'" class="text-center py-8">
            <div class="animate-pulse">
              <div class="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2"></div>
              <p class="text-gray-500">排队等待中...</p>
            </div>
            <div class="mt-2">
              <NButtonGroup 
                v-if="!task.last_feed || ((new Date().getTime()) - task.last_feed) > 20 * 1000"
                size="small"
              >
                <NButton type="primary" @click="refreshTask(task)">
                  <SvgIcon icon="material-symbols:refresh" size="md" />
                  重新获取
                </NButton>
                <NButton type="error" @click="cancelTask(task)">
                  取消任务
                </NButton>
              </NButtonGroup>
              <div v-else class="text-xs text-gray-400">
                排队中 {{ new Date(task.last_feed).toLocaleTimeString() }}
              </div>
            </div>
          </div>

          <!-- 创建状态 -->
          <div v-else-if="task.state === 'created'" class="text-center py-8">
            <div class="animate-pulse">
              <div class="w-16 h-16 bg-blue-300 rounded-full mx-auto mb-2"></div>
              <p class="text-gray-500">任务已创建...</p>
            </div>
          </div>
          
          <!-- 失败状态 -->
          <div v-else-if="task.state === 'failed'" class="text-center py-8">
            <div class="text-red-500">
              <SvgIcon icon="material-symbols:error" size="4xl" />
              <p class="mt-2">生成失败</p>
              <p class="text-sm mt-1">{{ getViduErrorMessage(task.err_code) }}</p>
            </div>
          </div>
          
          <!-- 任务信息 -->
          <div class="flex justify-between items-center text-xs text-gray-500 pt-3 border-t">
            <div class="space-x-4">
              <span>ID: {{ task.task_id.slice(0, 8) }}...</span>
              <span v-if="task.credits">积分: {{ task.credits }}</span>
              <span v-if="task.off_peak">错峰模式</span>
            </div>
            <NTime :time="new Date(task.created_at)" format="MM-dd HH:mm" />
          </div>
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
/* 自定义动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* 视频容器样式 */
.video-container {
  display: block;
  border-radius: 8px;
  background: #000;
  width: 100%;
  height: auto;
}

/* 视频固定尺寸样式 - 不再响应式适应窗口 */

/* 多行文本截断 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}
</style>