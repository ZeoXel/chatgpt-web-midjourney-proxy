<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { NInput, NButton, useMessage, NTag, NSelect } from 'naive-ui';
import { viduGenerate, viduFeed, mlog, upImg } from '@/api';
import { homeStore } from '@/store';
import { t } from '@/locales';

// 表单数据 - 简化版本，参考Luma模式
const vidu = ref({
  model: 'viduq2-turbo' as 'viduq2-turbo' | 'viduq2-pro' | 'viduq2' | 'vidu2.0' | 'vidu1.5',
  prompt: '',
  images: [] as string[],
  aspect_ratio: '16:9' as '16:9' | '9:16' | '1:1',
  duration: 4, // 默认4秒
  resolution: '1080p', // 默认1080p
  mode: 'auto' as 'auto' | 'img2video' | 'reference' | 'firstTail'
});

const st = ref({ isDo: false });
const ms = useMessage();
const fsRef = ref();

// 宽高比选项 - 优化UI，类似Sora2
const aspectRatioOptions = [
  { s: 'width: 100%; height: 100%;', label: '1:1', value: '1:1' },
  { s: 'width: 100%; height: 56.25%;', label: '16:9', value: '16:9' },
  { s: 'width: 56.25%; height: 100%;', label: '9:16', value: '9:16' }
];

// 清晰度选项
const resolutionOptions = [
  { label: '720P', value: '720p' },
  { label: '1080P', value: '1080p' }
];

// 时长选项 - 扩展到 2s-8s 七个选项
const durationOptions = [
  { label: '2秒', value: 2 },
  { label: '3秒', value: 3 },
  { label: '4秒', value: 4 },
  { label: '5秒', value: 5 },
  { label: '6秒', value: 6 },
  { label: '7秒', value: 7 },
  { label: '8秒', value: 8 }
];

// 生成模式选项
const modeOptions = [
  { label: '自动识别', value: 'auto' },
  { label: '图生视频', value: 'img2video' },
  { label: '参考生视频', value: 'reference' },
  { label: '首尾生视频', value: 'firstTail' }
];

// 模型选项 - 根据模式动态切换
const modelOptions = computed(() => {
  const imageCount = vidu.value.images.length;
  const currentMode = vidu.value.mode;

  // 自动模式下根据图片数量判断
  if (currentMode === 'auto') {
    if (imageCount === 1 || imageCount === 2) {
      // 图生/首尾生视频
      return [
        { label: 'Vidu Q2 Turbo (快速)', value: 'viduq2-turbo' },
        { label: 'Vidu Q2 Pro (专业)', value: 'viduq2-pro' }
      ];
    } else if (imageCount >= 3) {
      // 参考生视频
      return [
        { label: 'Vidu Q2 (参考生视频)', value: 'viduq2' }
      ];
    }
    // 无图片时默认显示全部
    return [
      { label: 'Vidu Q2 Turbo (快速)', value: 'viduq2-turbo' },
      { label: 'Vidu Q2 Pro (专业)', value: 'viduq2-pro' },
      { label: 'Vidu Q2 (参考生视频)', value: 'viduq2' }
    ];
  }

  // 手动模式下根据选择的模式判断
  if (currentMode === 'img2video' || currentMode === 'firstTail') {
    return [
      { label: 'Vidu Q2 Turbo (快速)', value: 'viduq2-turbo' },
      { label: 'Vidu Q2 Pro (专业)', value: 'viduq2-pro' }
    ];
  } else if (currentMode === 'reference') {
    return [
      { label: 'Vidu Q2 (参考生视频)', value: 'viduq2' }
    ];
  }

  return [
    { label: 'Vidu Q2 Turbo (快速)', value: 'viduq2-turbo' },
    { label: 'Vidu Q2 Pro (专业)', value: 'viduq2-pro' },
    { label: 'Vidu Q2 (参考生视频)', value: 'viduq2' }
  ];
});

onMounted(() => {
  homeStore.setMyData({ ms: ms });
});

// 监听图片数量和模式变化，自动调整模型
watch(() => [vidu.value.images.length, vidu.value.mode], ([imageCount, mode]) => {
  const options = modelOptions.value;
  const currentModel = vidu.value.model;

  // 检查当前选中的模型是否在可用选项中
  const isModelValid = options.some(opt => opt.value === currentModel);

  // 如果当前模型不可用，自动选择第一个可用模型
  if (!isModelValid && options.length > 0) {
    vidu.value.model = options[0].value as typeof vidu.value.model;
  }
});

const canPost = computed(() => {
  // 至少需要有提示词或图片其中之一
  const hasContent = vidu.value.prompt !== '' || vidu.value.images.length > 0;
  return hasContent && !st.value.isDo && homeStore.myData.hasBalance;
});

const generate = async () => {
  // 先验证内容，再设置loading状态
  const hasContent = vidu.value.prompt !== '' || vidu.value.images.length > 0;

  if (!hasContent) {
    ms.error('请输入提示词或上传图片');
    return;
  }

  if (st.value.isDo) {
    return; // 防止重复提交
  }

  st.value.isDo = true;

  try {
    mlog('vidu generate', vidu.value);

    // 确定最终生成模式
    let finalMode: 'img2video' | 'reference' | 'firstTail' | undefined;
    const imageCount = vidu.value.images.length;

    if (vidu.value.mode === 'auto') {
      if (imageCount === 1) finalMode = 'img2video';
      else if (imageCount === 2) finalMode = 'firstTail';
      else if (imageCount >= 3) finalMode = 'reference';
    } else {
      finalMode = vidu.value.mode;
    }

    const task = await viduGenerate({
      model: vidu.value.model,
      images: vidu.value.images,
      prompt: vidu.value.prompt,
      duration: vidu.value.duration,
      aspect_ratio: vidu.value.aspect_ratio,
      resolution: vidu.value.resolution,
      mode: finalMode
    });

    ms.success(t('video.submitSuccess'));

    console.log('🎬 [ViduInput] Task created:', task);

    // 启动轮询
    if (task && task.task_id) {
      console.log('🔄 [ViduInput] Starting viduFeed for:', task.task_id);
      viduFeed(task.task_id);
    } else {
      console.error('❌ [ViduInput] No task_id received!', task);
    }

    // 清空表单
    clearInput();

  } catch (error) {
    mlog('vidu generate error', error);
    ms.error('视频生成失败：' + (error as Error).message);
  }

  st.value.isDo = false;
};

function selectFile(input: any) {
  const files = Array.from(input.target.files) as File[];

  Promise.all(files.map(file => upImg(file)))
    .then(urls => {
      vidu.value.images = [...vidu.value.images, ...urls];
      fsRef.value = '';
    })
    .catch(e => ms.error(e));
}

const clearInput = () => {
  vidu.value.prompt = '';
  vidu.value.images = [];
};

const removeImage = (index: number) => {
  vidu.value.images.splice(index, 1);
};
</script>

<template>
  <div class="p-2">
    <!-- 宽高比选择 - 优化UI -->
    <div class="flex items-center justify-between space-x-1">
      <template v-for="item in aspectRatioOptions" :key="item.value">
        <section
          class="aspect-item flex-1 rounded border-2 dark:border-neutral-700 cursor-pointer relative"
          :class="{
            'border-primary': vidu.aspect_ratio === item.value,
            'opacity-50 cursor-not-allowed': vidu.images.length === 1 || vidu.images.length === 2
          }"
          @click="(vidu.images.length === 0 || vidu.images.length >= 3) && (vidu.aspect_ratio = item.value as typeof vidu.aspect_ratio)"
        >
          <div class="aspect-box-wrapper mx-auto my-2 flex h-5 w-5 items-center justify-center">
            <div class="aspect-box rounded border-2 dark:border-neutral-700" :style="item.s"></div>
          </div>
          <p class="mb-1 text-center text-sm">{{ item.label }}</p>
        </section>
      </template>
    </div>

    <!-- 提示词输入 -->
    <div class="pt-2">
      <n-input
        v-model:value="vidu.prompt"
        :placeholder="$t('video.descpls')"
        type="textarea"
        size="small"
        :autosize="{ minRows: 3, maxRows: 12 }"
      />
    </div>

    <!-- 模型选择 -->
    <div class="pt-2">
      <n-select
        v-model:value="vidu.model"
        :options="modelOptions"
        size="small"
        placeholder="选择模型"
      />
    </div>

    <!-- 生成模式 -->
    <div class="pt-2">
      <n-select v-model:value="vidu.mode" :options="modeOptions" size="small" />
    </div>

    <!-- 时长和清晰度 -->
    <div class="pt-2 flex items-center justify-between gap-2">
      <div class="flex-1">
        <div class="text-xs mb-1 text-gray-500">时长</div>
        <n-select v-model:value="vidu.duration" :options="durationOptions" size="small" />
      </div>
      <div class="flex-1">
        <div class="text-xs mb-1 text-gray-500">清晰度</div>
        <n-select v-model:value="vidu.resolution" :options="resolutionOptions" size="small" />
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="pt-2">
      <div v-if="vidu.images.length === 1" class="text-xs text-amber-600 dark:text-amber-400">
        ⚠️ 单图生视频：视频比例将自动跟随参考图片比例
      </div>
      <div v-else-if="vidu.images.length === 2" class="text-xs text-amber-600 dark:text-amber-400">
        ⚠️ 首尾生视频：视频比例将自动跟随参考图片比例
      </div>
      <div v-else-if="vidu.images.length >= 3" class="text-xs text-blue-600 dark:text-blue-400">
        ✅ 多图参考模式：可自定义视频比例（不受图片比例限制）
      </div>
      <div v-else class="text-xs text-gray-500">
        💡 文生视频模式：可自由选择视频比例
      </div>
    </div>

    <!-- 图片上传区域 -->
    <div class="pt-2">
      <input
        type="file"
        @change="selectFile"
        ref="fsRef"
        style="display: none"
        accept="image/jpeg, image/jpg, image/png, image/gif"
        multiple
      />

      <div class="flex justify-start items-center flex-wrap gap-2">
        <!-- 已上传的图片 -->
        <div
          v-for="(image, index) in vidu.images"
          :key="index"
          class="relative h-[80px] w-[80px] overflow-hidden rounded-sm border border-gray-400/20"
        >
          <img :src="image" class="w-full h-full object-cover" />
          <div
            class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer text-xs"
            @click="removeImage(index)"
          >
            ×
          </div>
        </div>

        <!-- 上传按钮 -->
        <div
          v-if="vidu.images.length < 7"
          class="h-[80px] w-[80px] overflow-hidden rounded-sm border border-gray-400/20 flex justify-center items-center cursor-pointer hover:border-primary transition-colors"
          @click="fsRef.click()"
        >
          <div class="text-center text-sm">{{ $t('video.selectimg') }}</div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <section class="pt-3 flex justify-end items-end">
      <div class="cursor-pointer pr-2" @click="clearInput" v-if="vidu.images.length > 0 || vidu.prompt">
        <NTag type="primary" size="small" :bordered="false" round>
          <span class="cursor-pointer">{{ $t('video.clear') }}</span>
        </NTag>
      </div>

      <div class="text-right">
        <NButton
          :loading="st.isDo"
          type="primary"
          :disabled="!canPost"
          @click="!homeStore.myData.hasBalance ? ms.info('账户余额不足，无法使用视频生成功能') : generate()"
          style="background-color: #445ff6;"
        >
          {{ $t('video.generate') }}
        </NButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.aspect-item {
  transition: all 0.2s;
}

.aspect-item:hover:not(.opacity-50) {
  transform: translateY(-2px);
}

.border-primary {
  border-color: #445ff6 !important;
}
</style>
