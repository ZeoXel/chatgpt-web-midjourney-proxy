<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NInput, NButton, useMessage, NTag, NSelect, NSwitch } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { viduGenerate, viduFeed, mlog, upImg } from '@/api';
import { homeStore } from '@/store';
import { t } from '@/locales';

// 表单数据 - 简化版本，参考Luma模式
const vidu = ref({
  model: 'viduq1', // 这是NewAPI网关中的模型名称
  prompt: '',
  images: [] as string[],
  aspect_ratio: '16:9',
  duration: 5, // 改为5秒，与成功测试保持一致
  mode: 'auto' as 'auto' | 'img2video' | 'reference' | 'firstTail'
});

const st = ref({ isDo: false });
const ms = useMessage();
const fsRef = ref();

// 宽高比选项 - 参考Luma样式
const vf = [
  { s: 'width: 100%; height: 100%;', label: '1:1', value: '1:1' },
  { s: 'width: 100%; height: 50%;', label: '16:9', value: '16:9' },
  { s: 'width: 50%; height: 100%;', label: '9:16', value: '9:16' }
];

// 生成模式选项
const modeOptions = [
  { label: '自动识别', value: 'auto' },
  { label: '图生视频', value: 'img2video' },
  { label: '参考生视频', value: 'reference' },
  { label: '首尾生视频', value: 'firstTail' }
];

// 时长选项 - viduq1模型仅支持5s
const durationOptions = [
  { label: '5秒', value: 5 }
];

// 模型选项 - 暂时只有viduq1
const modelOptions = [
  { label: 'Vidu Q1 (高质量/1080p)', value: 'viduq1' }
];

onMounted(() => {
  homeStore.setMyData({ ms: ms });
});

const canPost = computed(() => {
  // 至少需要有提示词或图片其中之一
  const hasContent = vidu.value.prompt !== '' || vidu.value.images.length > 0;
  return hasContent && !st.value.isDo;
});

// 根据模式自动调整图片要求提示
const imageRequirementText = computed(() => {
  const mode = vidu.value.mode;
  const imageCount = vidu.value.images.length;

  switch (mode) {
    case 'img2video': return '单图生视频：上传1张图片';
    case 'firstTail': return '首尾生视频：上传2张图片';
    case 'reference': return '参考生视频：上传1-7张图片';
    case 'auto':
    default: return `自动模式 (已上传${imageCount}张)`;
  }
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
      mode: finalMode
    });

    ms.success(t('video.submitSuccess'));

    // 启动轮询
    if (task && task.task_id) {
      viduFeed(task.task_id);
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
    <!-- 宽高比选择 - 参考Luma样式 -->
    <div class="flex items-center justify-between space-x-1 mb-3">
      <template v-for="(item, index) in vf" :key="index">
        <section
          class="aspect-item flex-1 rounded border-2 dark:border-neutral-700 cursor-pointer"
          :class="{'border-primary': vidu.aspect_ratio === item.value}"
          @click="vidu.aspect_ratio = item.value"
        >
          <div class="aspect-box-wrapper mx-auto my-2 flex h-5 w-5 items-center justify-center">
            <div class="aspect-box rounded border-2 dark:border-neutral-700" :style="item.s"></div>
          </div>
          <p class="mb-1 text-center text-sm">{{ item.label }}</p>
        </section>
      </template>
    </div>

    <!-- 模型选择 -->
    <div class="pt-2 pb-2">
      <n-select
        v-model:value="vidu.model"
        :options="modelOptions"
        size="small"
        placeholder="选择模型"
      />
    </div>

    <!-- 提示词输入 -->
    <div class="pt-1">
      <n-input
        v-model:value="vidu.prompt"
        :placeholder="$t('video.descpls')"
        type="textarea"
        size="small"
        :autosize="{ minRows: 3, maxRows: 8 }"
      />
    </div>

    <!-- 生成模式选择 -->
    <div class="pt-2">
      <div class="flex justify-between items-center mb-2">
        <div class="flex-1 mr-2">
          <n-select v-model:value="vidu.mode" :options="modeOptions" size="small" />
        </div>
        <div class="flex-1">
          <n-select v-model:value="vidu.duration" :options="durationOptions" size="small" />
        </div>
      </div>
      <div class="text-xs text-gray-500">{{ imageRequirementText }}</div>
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

      <div class="grid grid-cols-4 gap-2">
        <!-- 已上传的图片 -->
        <div
          v-for="(image, index) in vidu.images"
          :key="index"
          class="relative h-[60px] w-[60px] overflow-hidden rounded border border-gray-400/20"
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
          class="h-[60px] w-[60px] overflow-hidden rounded border border-gray-400/20 flex justify-center items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="fsRef.click()"
        >
          <SvgIcon icon="material-symbols:add" size="lg" />
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="pt-3">
      <div class="flex justify-between items-center">
        <div class="pb-1">
          <NTag
            v-if="vidu.prompt !== '' || vidu.images.length > 0"
            type="primary"
            size="small"
            round
          >
            <span class="cursor-pointer" @click="clearInput()">{{ $t('video.clear') }}</span>
          </NTag>
        </div>
        <div>
          <NButton
            :loading="st.isDo"
            type="primary"
            :disabled="!canPost"
            @click="generate()"
            style="background-color: #445ff6;"
          >
            <SvgIcon icon="ri:video-add-line" size="sm" /> {{ $t('video.generate') }}
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>