<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NInput, NButton, useMessage, NSelect, NSwitch, NImage } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { viduGenerate, viduFeed, mlog, upImg } from '@/api';
import { homeStore, gptServerStore } from '@/store';
import { MODEL_CONFIGS } from '@/api/viduStore';

// 表单数据
const formData = ref({
  model: 'viduq1' as 'viduq1' | 'vidu2.0' | 'vidu1.5',
  images: [] as string[],
  prompt: '',
  duration: 5,
  aspect_ratio: '16:9' as '16:9' | '9:16' | '1:1',
  resolution: '1080p',
  movement_amplitude: 'auto' as 'auto' | 'small' | 'medium' | 'large',
  off_peak: false,
  seed: '0' as string
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

// 运动幅度选项
const movementOptions = [
  { label: '自动', value: 'auto' },
  { label: '小幅', value: 'small' },
  { label: '中幅', value: 'medium' },
  { label: '大幅', value: 'large' }
];

// 模型选项
const modelOptions = [
  { label: 'Vidu Q1 - 高质量 (5秒)', value: 'viduq1' },
  { label: 'Vidu 2.0 - 快速生成 (4秒)', value: 'vidu2.0' },
  { label: 'Vidu 1.5 - 动态增强 (4/8秒)', value: 'vidu1.5' }
];

onMounted(() => {
  homeStore.setMyData({ ms: ms });
  updateModelDefaults();
});

// 监听模型变化，更新默认参数
watch(() => formData.value.model, updateModelDefaults);

function updateModelDefaults() {
  const config = MODEL_CONFIGS[formData.value.model];
  if (config) {
    if (formData.value.model === 'vidu1.5') {
      formData.value.duration = (config as any).durations[0]; // 默认4秒
      formData.value.resolution = config.resolutions[0]; // 默认360p
    } else {
      formData.value.duration = (config as any).duration;
      formData.value.resolution = config.resolutions[0];
    }
  }
}

// 获取可用时长选项
const durationOptions = computed(() => {
  const config = MODEL_CONFIGS[formData.value.model];
  if (formData.value.model === 'vidu1.5') {
    return (config as any).durations.map((d: number) => ({ label: `${d}秒`, value: d }));
  }
  return [{ label: `${(config as any).duration}秒`, value: (config as any).duration }];
});

// 获取可用分辨率选项
const resolutionOptions = computed(() => {
  const config = MODEL_CONFIGS[formData.value.model];
  return config.resolutions.map(r => ({ label: r, value: r }));
});

// 核心密钥检查
const hasApiKey = computed(() => {
  return gptServerStore.myData.OPENAI_API_KEY && 
         gptServerStore.myData.OPENAI_API_KEY.trim() !== '';
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
    
    const task = await viduGenerate({
      model: formData.value.model,
      images: formData.value.images,
      prompt: formData.value.prompt,
      duration: formData.value.duration,
      aspect_ratio: formData.value.aspect_ratio,
      resolution: formData.value.resolution,
      movement_amplitude: formData.value.movement_amplitude,
      off_peak: formData.value.off_peak,
      seed: parseInt(formData.value.seed) || undefined
    });

    ms.success('视频生成请求已提交！');
    
    // 通知UI更新任务列表 - 使用homeStore统一状态管理
    homeStore.setMyData({ act: 'ViduFeed' });
    
    // 启动长轮询跟踪任务状态
    if (task && task.task_id) {
      viduFeed(task.task_id);
    }
    
    // 清空表单（保留模型选择）
    formData.value.prompt = '';
    formData.value.images = [];
    formData.value.seed = '0';

  } catch (error) {
    mlog('vidu generate error', error);
    ms.error('生成失败: ' + ((error as Error).message || '未知错误'));
  } finally {
    st.value.isDo = false;
  }
};

// 随机种子
const randomSeed = () => {
  formData.value.seed = Math.floor(Math.random() * 999999999).toString();
};
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 模型选择 -->
    <div>
      <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        <SvgIcon icon="material-symbols:psychology" class="inline mr-1" />
        模型选择
      </label>
      <NSelect
        v-model:value="formData.model"
        :options="modelOptions"
        :disabled="st.isDo"
      />
      <div class="mt-1 text-xs text-gray-500">
        {{ MODEL_CONFIGS[formData.model].description }}
      </div>
    </div>

    <!-- 提示词输入 -->
    <div>
      <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        <SvgIcon icon="material-symbols:edit-note" class="inline mr-1" />
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
        <SvgIcon icon="material-symbols:image" class="inline mr-1" />
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
          <span class="text-gray-400 text-sm">点击上传</span>
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

    <!-- 高级参数 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- 分辨率 -->
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          分辨率
        </label>
        <NSelect
          v-model:value="formData.resolution"
          :options="resolutionOptions"
          :disabled="st.isDo"
        />
      </div>

      <!-- 运动幅度 -->
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          运动幅度
        </label>
        <NSelect
          v-model:value="formData.movement_amplitude"
          :options="movementOptions"
          :disabled="st.isDo"
        />
      </div>
    </div>

    <!-- 其他选项 -->
    <div class="space-y-3">
      <!-- 错峰模式 -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          错峰模式 (节省积分)
        </label>
        <NSwitch v-model:value="formData.off_peak" :disabled="st.isDo" />
      </div>

      <!-- 随机种子 -->
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          随机种子 (0为随机)
        </label>
        <div class="flex gap-2">
          <NInput
            v-model:value="formData.seed"
            :min="0"
            :max="999999999"
            :disabled="st.isDo"
            class="flex-1"
          />
          <NButton @click="randomSeed" :disabled="st.isDo">
            <SvgIcon icon="material-symbols:shuffle" />
          </NButton>
        </div>
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
          <SvgIcon :icon="hasApiKey ? 'material-symbols:video-camera-back' : 'material-symbols:key-off'" />
        </template>
        {{ buttonText }}
      </NButton>
    </div>

    <!-- 密钥配置提示 -->
    <div v-if="!hasApiKey" class="text-xs text-orange-500 bg-orange-50 p-3 rounded border border-orange-200 space-y-1">
      <div class="flex items-center">
        <SvgIcon icon="material-symbols:warning" class="mr-1" />
        <span class="font-medium">需要配置API密钥</span>
      </div>
      <div>请先在"设置 - 服务端"中填写API密钥后再使用Vidu视频生成功能</div>
    </div>

    <!-- 提示信息 -->
    <div class="text-xs text-gray-500 space-y-1">
      <div>• 请确保图片内容符合平台规范，避免违规内容</div>
      <div>• 生成时间根据队列情况而定，请耐心等待</div>
      <div>• 错峰模式下任务将在48小时内完成，消耗积分更少</div>
    </div>
  </div>
</template>