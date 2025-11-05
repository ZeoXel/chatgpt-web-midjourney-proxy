<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NSelect, NSwitch, NTag, useMessage } from 'naive-ui';
import { minimaxFeed, minimaxGenerate } from '@/api';
import { homeStore } from '@/store';
import { smartUploadImage } from '@/api/imageUpload';

const ms = useMessage();

const fileRef = ref<HTMLInputElement | null>(null);
const tailFileRef = ref<HTMLInputElement | null>(null);
const loading = ref(false);

const form = ref({
  model: 'MiniMax-Hailuo-2.3',
  prompt: '',
  duration: 6,
  resolution: '768P' as '768P' | '1080P',
  prompt_optimizer: true,
  first_frame_image: '',
  last_frame_image: '',
  mode: 'normal' as 'normal' | 'first_tail',
});

const modelOptions = [
  { label: 'Hailuo-2.3', value: 'MiniMax-Hailuo-2.3' },
  { label: 'Hailuo-02（首尾帧）', value: 'MiniMax-Hailuo-02' },
];

const modeOptions = [
  { label: '标准模式', value: 'normal' },
  { label: '首尾帧模式', value: 'first_tail' },
];

const durationBaseOptions = [
  { label: '6秒', value: 6 },
  { label: '10秒', value: 10 },
];

const resolutionOptions = [
  { label: '768P', value: '768P' },
  { label: '1080P', value: '1080P' },
];

const durationOptions = computed(() => {
  return form.value.resolution === '1080P'
    ? durationBaseOptions.filter(opt => opt.value === 6)
    : durationBaseOptions;
});

const canSubmit = computed(() => {
  const requireTail = form.value.mode === 'first_tail';
  return !!form.value.prompt.trim()
    && !!form.value.first_frame_image
    && (!requireTail || !!form.value.last_frame_image)
    && !loading.value
    && homeStore.myData.hasBalance;
});

const previewImage = computed(() => form.value.first_frame_image);

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const maxSizeMB = 10;
  if (file.size / 1024 / 1024 > maxSizeMB) {
    ms.error(`首帧图片大小不能超过 ${maxSizeMB}MB`);
    return;
  }

  try {
    const result = await smartUploadImage(file);
    form.value.first_frame_image = result.url;
    const sizeMB = (result.size / 1024 / 1024).toFixed(2);
    if (result.type === 'url')
      ms.success(`首帧图片上传成功 (${sizeMB}MB)`);
    else
      ms.success(`首帧图片压缩成功 (${sizeMB}MB)`);
  }
  catch (error) {
    ms.error(`首帧图片处理失败: ${(error as Error).message ?? error}`);
  }
  finally {
    if (target)
      target.value = '';
  }
};

const handleTailFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const maxSizeMB = 10;
  if (file.size / 1024 / 1024 > maxSizeMB) {
    ms.error(`尾帧图片大小不能超过 ${maxSizeMB}MB`);
    return;
  }

  try {
    const result = await smartUploadImage(file);
    form.value.last_frame_image = result.url;
    const sizeMB = (result.size / 1024 / 1024).toFixed(2);
    if (result.type === 'url')
      ms.success(`尾帧图片上传成功 (${sizeMB}MB)`);
    else
      ms.success(`尾帧图片压缩成功 (${sizeMB}MB)`);
  }
  catch (error) {
    ms.error(`尾帧图片处理失败: ${(error as Error).message ?? error}`);
  }
  finally {
    if (target)
      target.value = '';
  }
};

const triggerUpload = () => {
  fileRef.value?.click();
};

const triggerUploadTail = () => {
  tailFileRef.value?.click();
};

const clearForm = () => {
  form.value.prompt = '';
  form.value.first_frame_image = '';
  form.value.last_frame_image = '';
};

const handleGenerate = async () => {
  if (!form.value.prompt.trim()) {
    ms.error('请输入视频描述');
    return;
  }
  if (!form.value.first_frame_image) {
    ms.error('请上传或填写首帧图片');
    return;
  }
  if (form.value.mode === 'first_tail' && !form.value.last_frame_image) {
    ms.error('请上传尾帧图片');
    return;
  }

  loading.value = true;
  try {
    const task = await minimaxGenerate({
      model: form.value.model,
      prompt: form.value.prompt.trim(),
      duration: form.value.duration,
      resolution: form.value.resolution,
      first_frame_image: form.value.first_frame_image,
      last_frame_image: form.value.mode === 'first_tail' ? form.value.last_frame_image : undefined,
      frame_images: form.value.mode === 'first_tail'
        ? [form.value.first_frame_image, form.value.last_frame_image]
        : undefined,
      mode: form.value.mode === 'first_tail' ? 'first_tail' : undefined,
      prompt_optimizer: form.value.prompt_optimizer,
    });
    ms.success('MiniMax 任务已创建');
    minimaxFeed(task.task_id, form.value.prompt.trim());
  }
  catch (error: any) {
    ms.error(`视频生成失败：${error?.message ?? error}`);
  }
  finally {
    loading.value = false;
  }
};

onMounted(() => {
  homeStore.setMyData({ ms });
});

watch(() => form.value.resolution, (value) => {
  if (value === '1080P' && form.value.duration !== 6)
    form.value.duration = 6;
});

watch(() => form.value.mode, (value) => {
  if (value === 'first_tail') {
    form.value.model = 'MiniMax-Hailuo-02';
  }
  else {
    form.value.model = 'MiniMax-Hailuo-2.3';
    form.value.last_frame_image = '';
  }
});
</script>

<template>
  <div class="px-4 py-3 space-y-3">
    <section class="space-y-2">
      <label class="block text-xs text-gray-500">提示词</label>
      <NInput
        v-model:value="form.prompt"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 10 }"
        maxlength="2000"
        show-count
        placeholder="描述你想要的视频内容，支持使用 [指令] 控制运镜"
      />
    </section>

    <section class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-gray-500 mb-1">模型</label>
        <NSelect v-model:value="form.model" :options="modelOptions" size="small" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">分辨率</label>
        <NSelect v-model:value="form.resolution" :options="resolutionOptions" size="small" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">时长</label>
        <NSelect v-model:value="form.duration" :options="durationOptions" size="small" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">生成模式</label>
        <NSelect v-model:value="form.mode" :options="modeOptions" size="small" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-gray-500 mb-1">自动优化提示词</div>
          <div class="text-[10px] text-gray-400">
            关闭可保留原始指令
          </div>
        </div>
        <NSwitch v-model:value="form.prompt_optimizer" size="small" />
      </div>
    </section>

    <section class="space-y-2">
      <label class="block text-xs text-gray-500">参考图片</label>
      <input
        ref="fileRef"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        class="hidden"
        @change="handleFileChange"
      >
      <input
        ref="tailFileRef"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        class="hidden"
        @change="handleTailFileChange"
      >

      <div class="flex items-center gap-2">
        <div
          class="h-[80px] w-[80px] rounded-sm border border-gray-400/40 flex justify-center items-center cursor-pointer hover:border-primary transition-colors overflow-hidden"
          @click="triggerUpload"
        >
          <template v-if="previewImage">
            <img :src="previewImage" alt="首帧" class="h-full w-full object-cover">
          </template>
          <template v-else>
            <div class="text-center text-xs text-gray-500 leading-tight">
              首帧
              <div class="text-[10px] text-gray-400">点击上传</div>
            </div>
          </template>
        </div>

        <div
          class="h-[80px] w-[80px] rounded-sm border border-gray-400/40 flex justify-center items-center transition-colors overflow-hidden"
          :class="form.mode === 'first_tail' ? 'cursor-pointer hover:border-primary' : 'opacity-50 cursor-not-allowed'"
          @click="form.mode === 'first_tail' && triggerUploadTail()"
        >
          <template v-if="form.mode === 'first_tail' && form.last_frame_image">
            <img :src="form.last_frame_image" alt="尾帧" class="h-full w-full object-cover">
          </template>
          <template v-else>
            <div class="text-center text-xs text-gray-500 leading-tight px-1">
              尾帧
              <div class="text-[10px] text-gray-400">
                {{ form.mode === 'first_tail' ? '点击上传' : '首尾帧模式可用' }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="text-[11px] text-gray-400 space-y-1">
        <div>• 支持公网URL或Base64编码的数据URL</div>
        <div>• 建议使用16:9或9:16比例，文件小于10MB</div>
        <div>• 运镜指令示例：[推进]、[左摇,上升]</div>
        <div>• 首尾帧模式会自动切换至模型 MiniMax-Hailuo-02，并需同时提供尾帧图片</div>
      </div>
    </section>

    <section class="flex justify-end items-center gap-2 pt-2">
      <NTag
        v-if="form.prompt || form.first_frame_image"
        type="primary"
        size="small"
        :bordered="false"
        class="cursor-pointer"
        @click="clearForm"
      >
        清空内容
      </NTag>

      <NButton
        type="primary"
        :loading="loading"
        :disabled="!canSubmit"
        @click="!homeStore.myData.hasBalance ? ms.info('账户余额不足，无法使用视频生成功能') : handleGenerate()"
        style="background-color: #445ff6;"
      >
        生成视频
      </NButton>
    </section>
  </div>
</template>
