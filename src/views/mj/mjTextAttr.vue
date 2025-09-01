<script lang="ts" setup>
import { localGet, mlog } from "@/api";
import { ref } from "vue";
import { NButton, useMessage, NIcon, NModal, NCard } from "naive-ui";
import { SvgIcon } from "@/components/common";
import { downloadImage } from "@/utils/download";

const pp = defineProps<{ image: string }>();
const images = ref<{ fileName: string; fileBase64: string }[]>([]);
const files = ref<{ fileName: string; fileBase64: string }[]>([]);
const message = useMessage();

// 自定义预览控制
const showImagePreview = ref(false);
const currentPreviewImage = ref<{ src: string; fileName: string }>({ src: '', fileName: '' });

// 打开图片预览
const openImagePreview = (imgSrc: string, fileName: string) => {
  console.log('🎯 自定义预览系统被调用 - 不再使用NaiveUI');
  currentPreviewImage.value = { src: imgSrc, fileName };
  showImagePreview.value = true;
};

// 关闭图片预览
const closeImagePreview = () => {
  showImagePreview.value = false;
  currentPreviewImage.value = { src: '', fileName: '' };
};

// 自定义下载函数
const handleImageDownload = async (imgSrc: string, fileName?: string) => {
  try {
    const success = await downloadImage(imgSrc, fileName);
    if (success) {
      message.success('图片下载成功');
    } else {
      message.error('图片下载失败，请右键保存图片');
    }
  } catch (error) {
    console.error('下载出错:', error);
    message.error('下载出错，请右键保存图片');
  }
};

const isImage = (url:string) => {
  const extensions = [".jpeg", ".jpg", ".png", ".gif", ".webp"];
  url = url.toLowerCase();
  return extensions.some((ext) => url.endsWith(ext));
};

const loadImages = async () => {
  //mlog("loadImages", pp.image);
  try {
    const response = await localGet(pp.image);
    if (response) {
      const parsedData = JSON.parse(response);
      if (
        Array.isArray(parsedData.fileName) &&
        Array.isArray(parsedData.fileBase64)
      ) {
        const combinedData = parsedData.fileName.map(
          (name: string, index: number) => ({
            fileName: name,
            fileBase64: parsedData.fileBase64[index],
          })
        );

        images.value = combinedData.filter((file) => isImage(file.fileName));
        files.value = combinedData.filter((file) => !isImage(file.fileName));
      }
    }
  } catch (error) {
    console.error("Failed to load images:", error);
  }
};

loadImages();
</script>

<template>
  <!-- 自定义图片显示系统 - 已移除 NaiveUI NImage 组件 -->
  <div v-if="images.length" class="flex flex-wrap justify-start items-baseline p-1">
    <!-- 更新确认标识 -->
    <div class="w-full text-xs text-green-600 bg-green-100 p-2 rounded mb-2 border border-green-300">
      🎉 自定义图片预览系统已激活 - 更新时间: {{ new Date().toLocaleTimeString() }}
      <br>✅ 已完全移除 NaiveUI NImage 组件，使用自定义预览和下载
    </div>
    <div v-for="(img, k) of images" :key="k" class="relative group">
      <!-- 完全自定义的图片显示，不依赖 NImage -->
      <div 
        @click="openImagePreview(img.fileBase64, img.fileName)"
        class="cursor-pointer overflow-hidden rounded"
        :class="[images.length <= 1 ? 'w-[250px] h-[250px]' : 'w-[130px] h-[130px]']"
      >
        <img 
          :src="img.fileBase64" 
          :alt="img.fileName"
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      
      <!-- 自定义下载按钮覆盖层 -->
      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <NButton
          circle
          size="small"
          quaternary
          @click.stop="handleImageDownload(img.fileBase64, img.fileName)"
          class="bg-black/70 hover:bg-black/90 text-white border-0 shadow-lg"
        >
          <template #icon>
            <NIcon size="14">
              <SvgIcon icon="mdi:download" />
            </NIcon>
          </template>
        </NButton>
      </div>
    </div>
  </div>
  
  <!-- 非图片文件显示 -->
  <div v-if="files.length" class="block justify-start items-baseline p-1">
    <div v-for="(file, k) of files" :key="k" :class="[
      'w-full h-full block items-center text-xs text-neutral-500',
      { 'mb-1': k !== files.length - 1 },
    ]">
      <div 
        @click="handleImageDownload(file.fileBase64, file.fileName)"
        class="flex items-center cursor-pointer hover:text-blue-500 transition-colors p-2 rounded hover:bg-gray-100"
      >
        <SvgIcon icon="mdi:download" class="mr-2" />
        <n-ellipsis style="max-width: 280px">
          {{ file.fileName }}
        </n-ellipsis>
      </div>
    </div>
  </div>

  <!-- 自定义图片预览模态框 -->
  <NModal
    v-model:show="showImagePreview"
    preset="card"
    :style="{ width: '90vw', maxWidth: '800px' }"
    :title="currentPreviewImage.fileName"
    :closable="true"
    :mask-closable="true"
    @close="closeImagePreview"
  >
    <div class="relative">
      <img 
        :src="currentPreviewImage.src" 
        :alt="currentPreviewImage.fileName"
        class="w-full h-auto max-h-[70vh] object-contain"
      />
      
      <!-- 预览模式下的下载按钮 -->
      <div class="absolute top-4 right-4">
        <NButton
          type="primary"
          size="large"
          circle
          @click="handleImageDownload(currentPreviewImage.src, currentPreviewImage.fileName)"
          class="shadow-lg"
        >
          <template #icon>
            <NIcon size="20">
              <SvgIcon icon="mdi:download" />
            </NIcon>
          </template>
        </NButton>
      </div>
    </div>
    
    <template #action>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm text-gray-500">{{ currentPreviewImage.fileName }}</span>
        <NButton
          type="primary"
          @click="handleImageDownload(currentPreviewImage.src, currentPreviewImage.fileName)"
        >
          <template #icon>
            <NIcon>
              <SvgIcon icon="mdi:download" />
            </NIcon>
          </template>
          下载图片
        </NButton>
      </div>
    </template>
  </NModal>
</template>