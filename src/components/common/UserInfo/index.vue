<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="t('user.title')"
    :bordered="false"
    style="width: 400px; max-width: 90vw"
    :mask-closable="true"
  >
    <div class="user-info-content">
      <!-- 余额卡片 -->
      <div class="balance-card">
        <div class="balance-header">
          <div class="balance-label">
            <SvgIcon icon="ri:wallet-3-line" />
            <span>{{ t('user.balance') }}</span>
          </div>
          <NButton 
            size="small" 
            :loading="isLoading"
            @click="handleRefresh"
          >
            <template #icon>
              <SvgIcon icon="ri:refresh-line" />
            </template>
            {{ t('user.refresh') }}
          </NButton>
        </div>
        
        <div class="balance-amount">
          <template v-if="!isLoading">
            <span class="amount-number">{{ formattedBalance }}</span>
            <span class="amount-unit">{{ t('user.unit') }}</span>
          </template>
          <NSpin v-else />
        </div>
        
        <div class="balance-footer">
          <span class="update-time">
            {{ t('user.lastUpdate') }}: {{ formatUpdateTime }}
          </span>
        </div>
        
        <div v-if="error" class="error-message">
          <NAlert type="error" :title="error" closable />
        </div>
      </div>
      
      <!-- 余额详情 -->
      <div class="balance-details">
        <div class="detail-item">
          <span class="detail-label">{{ t('user.rechargeAmount') }}</span>
          <span class="detail-value">{{ formattedRechargeAmount }} {{ t('user.unit') }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('user.usedAmount') }}</span>
          <span class="detail-value used">-{{ formattedUsedAmount }} {{ t('user.unit') }}</span>
        </div>
        <div class="detail-item total">
          <span class="detail-label">{{ t('user.remainingBalance') }}</span>
          <span class="detail-value">{{ formattedBalance }} {{ t('user.unit') }}</span>
        </div>
      </div>
      
      <!-- 充值入口 -->
      <div class="recharge-section">
        <div class="recharge-header">
          <SvgIcon icon="ri:money-cny-circle-line" />
          <span>{{ t('user.recharge') }}</span>
        </div>
        <div class="recharge-options">
          <NButton 
            v-for="option in rechargeOptions" 
            :key="option.value"
            type="primary" 
            :ghost="option.value !== 100"
            size="small"
            @click="handleRecharge(option.value)"
          >
            {{ option.label }}
          </NButton>
        </div>
      </div>
      
      <!-- 更新说明 -->
      <div class="stats-section">
        <div class="update-info">
          <span class="info-text">{{ t('user.updateInfo') }}</span>
        </div>
      </div>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import { NModal, NButton, NSpin, NAlert, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBalanceStore } from '@/store'
import { t } from '@/locales'

interface Props {
  modelValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false
})

const emit = defineEmits(['update:modelValue'])

const balanceStore = useBalanceStore()
const message = useMessage()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formattedBalance = computed(() => balanceStore.formattedBalance)
const formattedRechargeAmount = computed(() => balanceStore.formattedRechargeAmount)
const formattedUsedAmount = computed(() => balanceStore.formattedUsedAmount)
const isLoading = computed(() => balanceStore.isLoading)
const error = computed(() => balanceStore.error)

// 充值选项
const rechargeOptions = ref([
  { value: 10, label: '10元' },
  { value: 50, label: '50元' },
  { value: 100, label: '100元' },
  { value: 500, label: '500元' },
])

const formatUpdateTime = computed(() => {
  const time = new Date(balanceStore.lastUpdateTime)
  return time.toLocaleString('zh-CN')
})

function handleRefresh() {
  balanceStore.fetchBalance()
}

function handleRecharge(amount: number) {
  balanceStore.addRecharge(amount)
  message.success(`${t('user.rechargeSuccess')} ${amount}元，余额已更新`)
}

// 监听弹窗打开
watch(visible, (newVal) => {
  if (newVal) {
    // 打开时立即获取余额
    balanceStore.fetchBalance()
  }
})

onMounted(() => {
  // 初始化时获取一次余额
  if (visible.value) {
    balanceStore.fetchBalance()
  }
})
</script>

<style scoped>
.user-info-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1.5rem;
  border-radius: 1rem;
  color: white;
}

.dark .balance-card {
  background: linear-gradient(135deg, #4c5fd5 0%, #c93d8f 100%);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.balance-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.9;
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

.amount-number {
  font-size: 2.5rem;
  font-weight: bold;
  letter-spacing: -1px;
}

.amount-unit {
  font-size: 1.25rem;
  opacity: 0.9;
}

.balance-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.update-time {
  font-size: 0.75rem;
  opacity: 0.8;
}

.error-message {
  margin-top: 1rem;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--n-color-modal);
  border-radius: 0.5rem;
  border: 1px solid var(--n-border-color);
}

.update-info {
  text-align: center;
}

.info-text {
  font-size: 0.875rem;
  color: var(--n-text-color-2);
  line-height: 1.5;
}

.balance-details {
  background: var(--n-color-modal);
  border-radius: 0.75rem;
  padding: 1.5rem;
  border: 1px solid var(--n-border-color);
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
}

.detail-item:not(:last-child) {
  border-bottom: 1px solid var(--n-divider-color);
}

.detail-item.total {
  font-weight: bold;
  font-size: 1.1rem;
}

.detail-label {
  color: var(--n-text-color-2);
  font-size: 0.875rem;
}

.detail-value {
  font-weight: 500;
  color: var(--n-text-color-1);
}

.detail-value.used {
  color: var(--n-error-color);
}

.detail-item.total .detail-value {
  color: var(--n-primary-color);
}

.recharge-section {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%);
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--n-border-color);
}

.dark .recharge-section {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
}

.recharge-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--n-primary-color);
}

.recharge-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.recharge-options .n-button {
  min-height: 2.5rem;
}
</style>