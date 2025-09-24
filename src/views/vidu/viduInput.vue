<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NInput, NButton, useMessage, NSelect, NSwitch, NImage } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { viduGenerate, viduFeed, mlog, upImg } from '@/api';
import { homeStore, gptServerStore } from '@/store';

// 表单数据 - NewAPI网关版本
const formData = ref({
  model: 'viduq1', // 固定模型
  images: [] as string[],
  prompt: '',
  mode: 'auto' as 'auto' | 'img2video' | 'firstTail' | 'reference', // 新增模式选择
  duration: 4,
  aspect_ratio: '16:9' as '16:9' | '9:16' | '1:1'
});

// 状态管理
const st = ref({ isDo: false });
const ms = useMessage();
const fileInputRefs = ref<(HTMLInputElement | null)[]>([]);

// 比例选项
const aspectRatioOptions = [
  { label: '横屏 16:9', value: '16:9' },
  { label: '竖屏 9:16', value: '9:16' },
  { label: '方形 1:1', value: '1:1' }
];

// 生成模式选项
const modeOptions = [
  { label: '🤖 自动识别 (根据图片数量)', value: 'auto' },
  { label: '🖼️ 图生视频 (单张图片优化)', value: 'img2video' },
  { label: '📚 参考生视频 (1-7张图片)', value: 'reference' },
  { label: '🎞️ 首尾生视频 (两张图片专用)', value: 'firstTail' }
];

// 时长选项
const durationOptions = [
  { label: '4秒', value: 4 },
  { label: '8秒', value: 8 }
];

onMounted(() => {
  homeStore.setMyData({ ms: ms });
});

// 根据选择的模式自动调整图片要求提示
const imageRequirementText = computed(() => {
  const mode = formData.value.mode;
  switch (mode) {
    case 'img2video': return '上传 1 张图片，使用单图生视频优化算法';
    case 'firstTail': return '上传 2 张图片，分别作为开始帧和结束帧';
    case 'reference': return '上传 1-7 张图片，支持灵活的图片数量';
    case 'auto':
    default: return '自动模式：1张选择图生视频，2张选择首尾生视频，3+张选择参考生视频';
  }
});

// 核心密钥检查 - 临时禁用进行调试
const hasApiKey = computed(() => {
  return true; // 临时总是返回true
  // return gptServerStore.myData.OPENAI_API_KEY &&
  //        gptServerStore.myData.OPENAI_API_KEY.trim() !== '';
});

// 验证表单
const canPost = computed(() => {
  return hasApiKey.value &&
         formData.value.prompt.trim() !== '' && 
         formData.value.images.length >= 1 && 
         formData.value.images.length <= 7 && 
         !st.value.isDo;
});

// 按钮文本
const buttonText = computed(() => {
  if (!hasApiKey.value) {
    return '未配置密钥';
  }
  if (st.value.isDo) {
    return '生成中...';
  }
  return '生成视频';
});

// 图片上传处理
const uploadImage = (index: number, file: File) => {
  if (formData.value.images.length >= 7) {
    ms.error('最多只能上传7张图片');
    return;
  }

  upImg(file).then(url => {
    if (index < formData.value.images.length) {
      // 替换现有图片
      formData.value.images[index] = url;
    } else {
      // 添加新图片
      formData.value.images.push(url);
    }
  }).catch(e => ms.error('图片上传失败: ' + e.message));
};

// 处理多文件上传
const handleMultipleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files) return;

  const remainingSlots = 7 - formData.value.images.length;
  if (files.length > remainingSlots) {
    ms.warning(`最多只能再上传${remainingSlots}张图片`);
    return;
  }

  Array.from(files).forEach((file) => {
    if (formData.value.images.length >= 7) return;
    
    upImg(file)
      .then(url => {
        formData.value.images.push(url);
      })
      .catch(e => ms.error(`图片上传失败: ${e.message}`));
  });

  // 重置文件输入
  target.value = '';
};

// 删除图片
const removeImage = (index: number) => {
  formData.value.images.splice(index, 1);
};

// 生成视频
const generate = async () => {
  if (!canPost.value) {
    ms.error('请检查输入参数');
    return;
  }

  st.value.isDo = true;

  try {
    mlog('vidu generate', formData.value);
    
    // 确定最终生成模式
    let finalMode: 'img2video' | 'reference' | 'firstTail' | undefined;
    const imageCount = formData.value.images.length;

    if (formData.value.mode === 'auto') {
      // 自动模式：根据图片数量判断
      if (imageCount === 1) {
        finalMode = 'img2video';
      } else if (imageCount === 2) {
        finalMode = 'firstTail';
      } else if (imageCount >= 3 && imageCount <= 7) {
        finalMode = 'reference';
      }
    } else {
      // 手动指定模式：参考生视频支持 1-7 张图片
      finalMode = formData.value.mode;
    }

    const task = await viduGenerate({
      model: formData.value.model,
      images: formData.value.images,
      prompt: formData.value.prompt,
      duration: formData.value.duration,
      aspect_ratio: formData.value.aspect_ratio,
      mode: finalMode
    });

    ms.success('视频生成请求已提交！');
    
    // 通知UI更新任务列表 - 使用homeStore统一状态管理
    homeStore.setMyData({ act: 'ViduFeed' });
    
    // 启动长轮询跟踪任务状态
    if (task && task.task_id) {
      viduFeed(task.task_id);
    }
    
    // 清空表单（保留模式选择）
    formData.value.prompt = '';
    formData.value.images = [];

  } catch (error) {
    mlog('vidu generate error', error);
    ms.error('生成失败: ' + ((error as Error).message || '未知错误'));
  } finally {
    st.value.isDo = false;
  }
};

// NewAPI网关版本：简化配置，移除了复杂的种子和高级参数"
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 生成模式选择 -->
    <div>
      <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        <SvgIcon icon="material-symbols:auto-awesome" size="sm" class="inline mr-1" />
        生成模式
      </label>
      <NSelect
        v-model:value="formData.mode"
        :options="modeOptions"
        :disabled="st.isDo"
      />
      <div class="mt-1 text-xs text-gray-500">
        {{ imageRequirementText }}
      </div>
    </div>

    <!-- 提示词输入 -->
    <div>
      <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        <SvgIcon icon="material-symbols:edit-note" size="sm" class="inline mr-1" />
        视频描述 *
      </label>
      <NInput
        v-model:value="formData.prompt"
        type="textarea"
        placeholder="描述你想生成的视频内容，例如：Santa Claus and the bear hug by the lakeside."
        :rows="3"
        :disabled="st.isDo"
        maxlength="1500"
        show-count
      />
    </div>

    <!-- 图片上传 -->
    <div>
      <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        <SvgIcon icon="material-symbols:image" size="sm" class="inline mr-1" />
        参考图片 * (1-7张)
      </label>
      
      <!-- 图片预览网格 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
        <div 
          v-for="(image, index) in formData.images" 
          :key="index"
          class="relative group"
        >
          <NImage
            :src="image"
            class="w-full h-20 object-cover rounded border"
            preview
          />
          <button
            @click="removeImage(index)"
            class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            :disabled="st.isDo"
          >
            ×
          </button>
        </div>
        
        <!-- 添加图片按钮 -->
        <div 
          v-if="formData.images.length < 7"
          class="w-full h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
          @click="() => fileInputRefs[formData.images.length]?.click()"
        >
          <SvgIcon icon="material-symbols:add" size="2xl" class="text-gray-400" />
          <input
            :ref="el => fileInputRefs[formData.images.length] = el as HTMLInputElement"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            class="hidden"
            @change="handleMultipleFileUpload"
            :disabled="st.isDo"
          />
        </div>
      </div>
      
      <div class="text-xs text-gray-500">
        支持 PNG、JPEG、JPG、WebP 格式，尺寸不小于128×128，比例不超过4:1或1:4，大小不超过50MB<br>
        可一次选择多张图片进行批量上传
      </div>
    </div>

    <!-- 基础参数 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- 比例选择 -->
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          画面比例
        </label>
        <NSelect
          v-model:value="formData.aspect_ratio"
          :options="aspectRatioOptions"
          :disabled="st.isDo"
        />
      </div>

      <!-- 时长选择 -->
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          视频时长
        </label>
        <NSelect
          v-model:value="formData.duration"
          :options="durationOptions"
          :disabled="st.isDo"
        />
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="pt-4">
      <NButton 
        :type="hasApiKey ? 'primary' : 'default'"
        size="large"
        block
        :disabled="!canPost"
        :loading="st.isDo"
        @click="generate"
        :class="{ 'opacity-50': !hasApiKey }"
      >
        <template #icon>
          <SvgIcon :icon="hasApiKey ? 'material-symbols:engineering' : 'material-symbols:key-off'" size="md" />
        </template>
        {{ buttonText }}
      </NButton>
    </div>


    <!-- 提示信息 -->
    <div class="text-xs text-gray-500 space-y-1">
      <div>• 请确保图片内容符合平台规范，避免违规内容</div>
      <div>• 生成时间根据队列情况而定，请耐心等待</div>
      <div>• 错峰模式下任务将在48小时内完成，消耗积分更少</div>
    </div>
  </div>
</template>