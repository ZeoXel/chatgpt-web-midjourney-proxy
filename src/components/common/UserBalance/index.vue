<template>
  <div class="user-balance">
    <div class="balance-display" @click="handleClick">
      <SvgIcon icon="ri:wallet-3-line" class="balance-icon" />
      <span class="balance-text">
        <template v-if="!isLoading">
          <AnimatedNumber :value="displayBalance" />
          <span class="unit">{{ t('user.unit') }}</span>
        </template>
        <template v-else>
          <NSpin size="small" />
        </template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NSpin } from 'naive-ui'
import { SvgIcon, AnimatedNumber } from '@/components/common'
import { useBalanceStore } from '@/store'
import { t } from '@/locales'

const balanceStore = useBalanceStore()

const displayBalance = computed(() => balanceStore.displayBalance)
const isLoading = computed(() => balanceStore.isLoading)

const emit = defineEmits(['click'])

function handleClick() {
  emit('click')
}

onMounted(() => {
  // 组件挂载时获取余额
  balanceStore.fetchBalance()
})
</script>

<style scoped>
.user-balance {
  padding: 0.5rem;
}

.balance-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
  background-color: rgba(0, 0, 0, 0.05);
}

.balance-display:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.dark .balance-display {
  background-color: rgba(255, 255, 255, 0.05);
}

.dark .balance-display:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.balance-icon {
  font-size: 1.2rem;
  color: var(--primary-color);
}

.balance-text {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.unit {
  font-size: 0.75rem;
  opacity: 0.8;
}
</style>