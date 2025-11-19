<template>
  <!-- 余额不足常亮提示框 -->
  <Teleport to="body">
    <div
      v-if="!homeStore.myData.hasBalance && !homeStore.myData.balanceWarningDismissed"
      class="balance-warning-overlay"
    >
      <div class="balance-warning-dialog">
        <div class="flex items-start">
          <SvgIcon
            icon="material-symbols:warning-outline"
            class="text-[#445ff6] mr-3 mt-0.5 flex-shrink-0"
            size="xl"
          />
          <div class="flex-1">
            <p class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {{ warningTitle }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {{ warningDescription }}
            </p>
          </div>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2 flex-shrink-0"
          >
            <SvgIcon icon="material-symbols:close" size="md" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { homeStore } from '@/store'
import { SvgIcon } from '@/components/common'

const handleClose = () => {
  homeStore.setMyData({ balanceWarningDismissed: true })
}

const warningTitle = computed(() => homeStore.myData.balanceNeedsLogin ? '请先登录账号' : '账户余额不足')
const warningDescription = computed(() => homeStore.myData.balanceNeedsLogin
  ? '检测到当前页面缺少登录信息，请先登录后再继续使用所有 AI 功能。'
  : '当前账户余额不足，所有AI功能已被禁用。您仍可以查看历史记录和已生成的内容。')

// 仅显示一次，不重复显示
</script>

<style scoped>
.balance-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-out;
}

.balance-warning-dialog {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  margin: 20px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease-out;
}

.dark .balance-warning-dialog {
  background: #1f2937;
  border: 1px solid #374151;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 640px) {
  .balance-warning-dialog {
    margin: 16px;
    padding: 20px;
  }
}
</style>
