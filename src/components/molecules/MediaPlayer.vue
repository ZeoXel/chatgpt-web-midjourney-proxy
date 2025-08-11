<template>
  <div class="media-player" :class="playerClasses">
    <!-- 视频播放器 -->
    <video
      v-if="type === 'video'"
      ref="videoRef"
      :src="src"
      :poster="poster"
      :controls="showControls"
      :autoplay="autoplay"
      :loop="loop"
      :muted="muted"
      class="media-element"
      @loadstart="handleLoadStart"
      @loadedmetadata="handleLoadedMetadata"
      @canplay="handleCanPlay"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleError"
      @timeupdate="handleTimeUpdate"
    />
    
    <!-- 音频播放器 -->
    <audio
      v-else-if="type === 'audio'"
      ref="audioRef"
      :src="src"
      :controls="showControls"
      :autoplay="autoplay"
      :loop="loop"
      :muted="muted"
      class="media-element"
      @loadstart="handleLoadStart"
      @loadedmetadata="handleLoadedMetadata"
      @canplay="handleCanPlay"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleError"
      @timeupdate="handleTimeUpdate"
    />
    
    <!-- 图片查看器 -->
    <div v-else-if="type === 'image'" class="image-container">
      <img
        :src="src"
        :alt="alt"
        class="media-image"
        :class="{
          'object-cover': imageFit === 'cover',
          'object-contain': imageFit === 'contain',
          'object-fill': imageFit === 'fill'
        }"
        @load="handleImageLoad"
        @error="handleError"
        @click="openImagePreview"
      />
      <div v-if="showImageOverlay" class="image-overlay">
        <button class="btn-ghost btn-icon" @click="openImagePreview">
          <NIcon :component="ExpandIcon" :size="20" />
        </button>
      </div>
    </div>
    
    <!-- 自定义控制条 -->
    <div v-if="customControls && (type === 'video' || type === 'audio')" class="custom-controls">
      <div class="controls-row">
        <!-- 播放/暂停按钮 -->
        <button class="control-btn" @click="togglePlay">
          <NIcon :component="isPlaying ? PauseIcon : PlayIcon" :size="18" />
        </button>
        
        <!-- 时间显示 -->
        <span class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>
        
        <!-- 进度条 -->
        <div class="progress-container" @click="seekTo">
          <div class="progress-track">
            <div class="progress-filled" :style="{ width: `${progress}%` }" />
            <div class="progress-thumb" :style="{ left: `${progress}%` }" />
          </div>
        </div>
        
        <!-- 音量控制 -->
        <div class="volume-control">
          <button class="control-btn" @click="toggleMute">
            <NIcon :component="volumeIcon" :size="18" />
          </button>
          <div class="volume-slider" @click="setVolume">
            <div class="volume-track">
              <div class="volume-filled" :style="{ width: `${volume * 100}%` }" />
            </div>
          </div>
        </div>
        
        <!-- 全屏按钮 (仅视频) -->
        <button v-if="type === 'video'" class="control-btn" @click="toggleFullscreen">
          <NIcon :component="isFullscreen ? ExitFullscreenIcon : FullscreenIcon" :size="18" />
        </button>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="media-loading">
      <NSpin :size="40" />
      <div class="loading-text">{{ loadingText }}</div>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="media-error">
      <NIcon :component="ErrorIcon" :size="48" class="error-icon" />
      <div class="error-message">{{ error }}</div>
      <BaseButton variant="ghost" size="sm" @click="retry">
        重试
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import {
  PlayCircleOutlined as PlayIcon,
  PauseCircleOutlined as PauseIcon,
  SoundOutlined as VolumeUpIcon,
  SoundFilled as VolumeMutedIcon,
  ExpandOutlined as ExpandIcon,
  FullscreenOutlined as FullscreenIcon,
  FullscreenExitOutlined as ExitFullscreenIcon,
  ExclamationCircleOutlined as ErrorIcon,
} from '@vicons/antd'
import { BaseButton } from '@/components/atoms'

export interface MediaPlayerProps {
  type: 'video' | 'audio' | 'image'
  src: string
  poster?: string
  alt?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  customControls?: boolean
  imageFit?: 'cover' | 'contain' | 'fill'
  showImageOverlay?: boolean
  loadingText?: string
}

const props = withDefaults(defineProps<MediaPlayerProps>(), {
  autoplay: false,
  loop: false,
  muted: false,
  controls: true,
  customControls: false,
  imageFit: 'contain',
  showImageOverlay: true,
  loadingText: '加载中...',
})

const emit = defineEmits<{
  play: []
  pause: []
  ended: []
  error: [error: string]
  loadedMetadata: []
  timeUpdate: [time: number]
  imageLoad: []
}>()

// 引用
const videoRef = ref<HTMLVideoElement>()
const audioRef = ref<HTMLAudioElement>()

// 状态
const loading = ref(false)
const error = ref('')
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)

// 计算属性
const mediaElement = computed(() => videoRef.value || audioRef.value)
const showControls = computed(() => props.controls && !props.customControls)
const progress = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return VolumeMutedIcon
  return VolumeUpIcon
})

const playerClasses = computed(() => [
  'relative overflow-hidden',
  props.type === 'video' ? 'aspect-video' : '',
  props.type === 'image' ? 'inline-block' : 'w-full',
])

// 事件处理
const handleLoadStart = () => {
  loading.value = true
  error.value = ''
}

const handleLoadedMetadata = () => {
  if (mediaElement.value) {
    duration.value = mediaElement.value.duration
  }
  emit('loadedMetadata')
}

const handleCanPlay = () => {
  loading.value = false
}

const handlePlay = () => {
  isPlaying.value = true
  emit('play')
}

const handlePause = () => {
  isPlaying.value = false
  emit('pause')
}

const handleEnded = () => {
  isPlaying.value = false
  emit('ended')
}

const handleError = () => {
  loading.value = false
  error.value = '媒体加载失败'
  emit('error', error.value)
}

const handleTimeUpdate = () => {
  if (mediaElement.value) {
    currentTime.value = mediaElement.value.currentTime
    emit('timeUpdate', currentTime.value)
  }
}

const handleImageLoad = () => {
  loading.value = false
  emit('imageLoad')
}

// 控制方法
const togglePlay = () => {
  if (!mediaElement.value) return
  
  if (isPlaying.value) {
    mediaElement.value.pause()
  } else {
    mediaElement.value.play()
  }
}

const toggleMute = () => {
  if (!mediaElement.value) return
  
  mediaElement.value.muted = !mediaElement.value.muted
  isMuted.value = mediaElement.value.muted
}

const seekTo = (event: MouseEvent) => {
  if (!mediaElement.value) return
  
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  mediaElement.value.currentTime = percent * duration.value
}

const setVolume = (event: MouseEvent) => {
  if (!mediaElement.value) return
  
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  volume.value = Math.max(0, Math.min(1, percent))
  mediaElement.value.volume = volume.value
}

const toggleFullscreen = () => {
  if (!videoRef.value) return
  
  if (!document.fullscreenElement) {
    videoRef.value.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

const openImagePreview = () => {
  // 这里可以集成图片预览组件
  window.open(props.src, '_blank')
}

const retry = () => {
  error.value = ''
  loading.value = true
  
  if (mediaElement.value) {
    mediaElement.value.load()
  }
}

// 工具函数
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 监听全屏变化
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// 生命周期
onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  if (mediaElement.value) {
    volume.value = mediaElement.value.volume
    isMuted.value = mediaElement.value.muted
  }
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

// 监听音量变化
watch(volume, (newVolume) => {
  if (mediaElement.value) {
    mediaElement.value.volume = newVolume
  }
})
</script>

<style scoped>
.media-element {
  @apply w-full h-full object-cover;
}

.image-container {
  @apply relative inline-block;
}

.media-image {
  @apply w-full h-full cursor-pointer transition-transform hover:scale-105;
}

.image-overlay {
  @apply absolute inset-0 flex items-center justify-center;
  @apply bg-black/20 opacity-0 hover:opacity-100 transition-opacity;
}

.custom-controls {
  @apply absolute bottom-0 left-0 right-0;
  @apply bg-gradient-to-t from-black/80 to-transparent;
  @apply p-4 text-white;
}

.controls-row {
  @apply flex items-center gap-3;
}

.control-btn {
  @apply p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors;
  @apply flex items-center justify-center;
}

.time-display {
  @apply text-sm font-mono;
}

.progress-container {
  @apply flex-1 cursor-pointer py-2;
}

.progress-track {
  @apply relative h-1 bg-white/30 rounded-full;
}

.progress-filled {
  @apply h-full bg-primary-500 rounded-full transition-all;
}

.progress-thumb {
  @apply absolute top-1/2 w-3 h-3 bg-white rounded-full;
  @apply transform -translate-x-1/2 -translate-y-1/2;
  @apply shadow-md;
}

.volume-control {
  @apply flex items-center gap-2;
}

.volume-slider {
  @apply w-16 cursor-pointer py-2;
}

.volume-track {
  @apply relative h-1 bg-white/30 rounded-full;
}

.volume-filled {
  @apply h-full bg-white rounded-full transition-all;
}

.media-loading {
  @apply absolute inset-0 flex flex-col items-center justify-center;
  @apply bg-black/50 text-white;
}

.loading-text {
  @apply mt-2 text-sm;
}

.media-error {
  @apply absolute inset-0 flex flex-col items-center justify-center;
  @apply bg-gray-100 dark:bg-gray-800 text-center p-8;
}

.error-icon {
  @apply text-gray-400 mb-4;
}

.error-message {
  @apply text-gray-600 dark:text-gray-300 mb-4;
}
</style>