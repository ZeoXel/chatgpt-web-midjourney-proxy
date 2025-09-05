<script setup lang='ts'>
import { computed, useAttrs, resolveComponent, h } from 'vue'
import { Icon } from '@iconify/vue'
import * as HeroiconsOutline from '@heroicons/vue/24/outline'
import * as HeroiconsSolid from '@heroicons/vue/24/solid'
import * as HeroiconsMini from '@heroicons/vue/20/solid'

interface Props {
  icon?: string
}

const props = defineProps<Props>()

const attrs = useAttrs()

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: (attrs.class as string) || '',
  style: (attrs.style as string) || '',
}))

// Comprehensive Heroicons icon name mapping
const heroIconMapping: Record<string, any> = {
  // Navigation & UI
  'ri:align-justify': HeroiconsOutline.Bars3Icon,
  'ri:align-right': HeroiconsOutline.Bars3BottomRightIcon,
  'ri:apps-fill': HeroiconsSolid.PuzzlePieceIcon,
  'ri:more-2-fill': HeroiconsOutline.EllipsisHorizontalIcon,
  'icon-park-outline:right': HeroiconsOutline.ChevronRightIcon,
  'ri:arrow-up-s-line': HeroiconsOutline.ChevronUpIcon,
  'ri:close-circle-line': HeroiconsOutline.XCircleIcon,
  'mdi:close': HeroiconsOutline.XMarkIcon,
  'tdesign:close': HeroiconsOutline.XMarkIcon,
  
  // Actions & CRUD
  'ri:add-line': HeroiconsOutline.PlusIcon,
  'ri:add-fill': HeroiconsSolid.PlusIcon,
  'material-symbols:add': HeroiconsOutline.PlusIcon,
  'mdi:add-bold': HeroiconsSolid.PlusIcon,
  'ic:round-add': HeroiconsSolid.PlusCircleIcon,
  'ri:delete-bin-line': HeroiconsOutline.TrashIcon,
  'mdi:delete': HeroiconsOutline.TrashIcon,
  'material-symbols:delete': HeroiconsOutline.TrashIcon,
  'fluent:delete-12-filled': HeroiconsSolid.TrashIcon,
  'ri:edit-line': HeroiconsOutline.PencilIcon,
  'material-symbols:edit-note': HeroiconsOutline.PencilSquareIcon,
  'fluent:image-edit-16-regular': HeroiconsOutline.PhotoIcon,
  
  // Download & Upload
  'ri:download-2-line': HeroiconsOutline.ArrowDownTrayIcon,
  'ri:download-2-fill': HeroiconsSolid.ArrowDownTrayIcon,
  'ri:download-line': HeroiconsOutline.ArrowDownTrayIcon,
  'mdi:download': HeroiconsOutline.ArrowDownTrayIcon,
  'material-symbols:download': HeroiconsOutline.ArrowDownTrayIcon,
  'ri:upload-line': HeroiconsOutline.ArrowUpTrayIcon,
  'ri:upload-2-line': HeroiconsOutline.ArrowUpTrayIcon,
  'ri:upload-2-fill': HeroiconsSolid.ArrowUpTrayIcon,
  'ri:attachment-line': HeroiconsOutline.PaperClipIcon,
  'line-md:uploading-loop': HeroiconsOutline.ArrowUpTrayIcon,
  
  // Search & Filter
  'ri:search-line': HeroiconsOutline.MagnifyingGlassIcon,
  'uil:search': HeroiconsOutline.MagnifyingGlassIcon,
  
  // Media & Entertainment
  'ri:music-fill': HeroiconsSolid.MusicalNoteIcon,
  'arcticons:wynk-music': HeroiconsSolid.MusicalNoteIcon,
  'mdi:play-circle-outline': HeroiconsOutline.PlayCircleIcon,
  'bi:play-circle': HeroiconsOutline.PlayCircleIcon,
  'ri:play-fill': HeroiconsSolid.PlayIcon,
  'mdi:pause-circle-outline': HeroiconsOutline.PauseCircleIcon,
  'bi:pause-circle': HeroiconsOutline.PauseCircleIcon,
  'ri:stop-circle-line': HeroiconsOutline.StopCircleIcon,
  'ri:video-add-line': HeroiconsOutline.VideoCameraIcon, // 通用视频
  'ri:video-on-line': HeroiconsOutline.VideoCameraIcon,
  'material-symbols:video-camera-back': HeroiconsSolid.CubeTransparentIcon, // Vidu 专用图标 - 立体方块
  'material-symbols:video-library-outline': HeroiconsOutline.FilmIcon,
  'bi:mic': HeroiconsOutline.MicrophoneIcon,
  'majesticons:phone-hangup': HeroiconsOutline.PhoneXMarkIcon,
  
  // Images & Visual
  'material-symbols:image': HeroiconsOutline.PhotoIcon,
  'material-symbols:imagesmode-outline': HeroiconsOutline.PhotoIcon,
  'ic:outline-palette': HeroiconsOutline.PaintBrushIcon,
  
  // Communication & Social
  'ri:send-plane-fill': HeroiconsSolid.PaperAirplaneIcon,
  'mingcute:send-plane-fill': HeroiconsSolid.PaperAirplaneIcon,
  'ri:message-3-line': HeroiconsOutline.ChatBubbleLeftRightIcon,
  'bi:chat': HeroiconsOutline.ChatBubbleLeftIcon,
  'ri:chat-history-line': HeroiconsOutline.ClockIcon,
  'ri:wechat-line': HeroiconsOutline.ChatBubbleOvalLeftIcon, // 对话改为气泡样式
  
  // Business & Finance
  'ri:wallet-line': HeroiconsOutline.WalletIcon,
  'ri:money-dollar-circle-line': HeroiconsOutline.CurrencyDollarIcon,
  'ri:shopping-cart-line': HeroiconsOutline.ShoppingCartIcon,
  'ri:star-line': HeroiconsOutline.StarIcon,
  
  // Settings & Configuration
  'ri:settings-line': HeroiconsOutline.Cog6ToothIcon,
  'ri:settings-3-line': HeroiconsOutline.Cog6ToothIcon,
  'ri:settings-4-line': HeroiconsOutline.Cog8ToothIcon,
  'ri:user-settings-line': HeroiconsOutline.UserIcon,
  'ri:user-line': HeroiconsOutline.UserIcon,
  'ri:service-line': HeroiconsOutline.WrenchScrewdriverIcon,
  
  // Data & Analytics
  'ri:bar-chart-line': HeroiconsOutline.ChartBarIcon,
  'ri:bubble-chart-fill': HeroiconsSolid.ChartPieIcon,
  'mdi:file-chart-check-outline': HeroiconsOutline.DocumentChartBarIcon,
  'ri:equalizer-line': HeroiconsOutline.AdjustmentsHorizontalIcon,
  
  // System & Technical
  'ri:refresh-line': HeroiconsOutline.ArrowPathIcon,
  'ri:restart-line': HeroiconsOutline.ArrowPathIcon,
  'material-symbols:refresh': HeroiconsOutline.ArrowPathIcon,
  'bi:bootstrap-reboot': HeroiconsOutline.ArrowPathIcon,
  'fa:random': HeroiconsOutline.ArrowPathIcon,
  'material-symbols:shuffle': HeroiconsOutline.ArrowPathRoundedSquareIcon,
  'line-md:downloading-loop': HeroiconsOutline.ArrowPathIcon,
  'svg-spinners:bars-scale-middle': HeroiconsOutline.ArrowPathIcon,
  'svg-spinners:wifi': HeroiconsOutline.WifiIcon,
  'mdi:wifi': HeroiconsOutline.WifiIcon,
  'mingcute:server-line': HeroiconsOutline.ServerIcon,
  'iconoir:database-export': HeroiconsOutline.CircleStackIcon,
  'material-symbols:token-outline': HeroiconsOutline.KeyIcon,
  'material-symbols:key-off': HeroiconsOutline.NoSymbolIcon,
  
  // Status & Alerts
  'material-symbols:warning': HeroiconsOutline.ExclamationTriangleIcon,
  'material-symbols:error': HeroiconsOutline.XCircleIcon,
  'icon-park-outline:bad-two': HeroiconsOutline.ExclamationCircleIcon,
  'mdi:hot': HeroiconsOutline.FireIcon,
  'heroicons:sparkles': HeroiconsOutline.SparklesIcon,
  'material-symbols:cleaning-services': HeroiconsOutline.SparklesIcon,
  'game-icons:bouncing-spring': HeroiconsOutline.BoltIcon,
  'mage:electricity': HeroiconsOutline.BoltIcon,
  
  // Documents & Files
  'ri:file-user-line': HeroiconsOutline.DocumentTextIcon,
  'mdi:file-document-plus-outline': HeroiconsOutline.DocumentPlusIcon,
  'ri:save-line': HeroiconsOutline.BookmarkIcon,
  'ri:inbox-line': HeroiconsOutline.InboxIcon,
  'ri:calendar-line': HeroiconsOutline.CalendarDaysIcon,
  'material-symbols:content-copy': HeroiconsOutline.ClipboardDocumentIcon,
  
  // Functions & Features
  'ri:function-add-line': HeroiconsOutline.CommandLineIcon,
  'material-symbols:psychology': HeroiconsOutline.LightBulbIcon,
  'ri:link': HeroiconsOutline.LinkIcon,
}

// Check if icon is a Heroicon
const isHeroIcon = computed(() => {
  return props.icon && heroIconMapping[props.icon]
})

const heroIconComponent = computed(() => {
  if (props.icon && heroIconMapping[props.icon]) {
    return heroIconMapping[props.icon]
  }
  return null
})
</script>

<template>
  <!-- Use Heroicon if available, otherwise fallback to Iconify -->
  <component 
    v-if="isHeroIcon" 
    :is="heroIconComponent" 
    v-bind="bindAttrs"
  />
  <Icon 
    v-else 
    :icon="icon" 
    v-bind="bindAttrs" 
  />
</template>
