<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue'
import { NCard, NStatistic, NButton, NPopover, NTag, NSpace, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBalanceStore } from '@/store/balance'
import { useUsageStore } from '@/store/usage'

interface Props {
  showDetails?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
  compact: false
})

const balanceStore = useBalanceStore()
const usageStore = useUsageStore()
const message = useMessage()

// 是否显示详细信息
const showPopover = ref(false)
const refreshing = ref(false)

// 格式化余额显示
const formatBalance = (balance: number): string => {
  if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1)}K`
  }
  return balance.toFixed(2)
}

// 获取余额状态颜色
const getBalanceColor = (balance: number): string => {
  if (balance <= 0) return 'error'
  if (balance < 100) return 'warning'
  return 'success'
}

// 刷新余额
const refreshBalance = async () => {
  try {
    refreshing.value = true
    await balanceStore.refreshAll()
    message.success('余额刷新成功')
  } catch (error) {
    message.error('余额刷新失败')
  } finally {
    refreshing.value = false
  }
}

// 快速充值
const quickRecharge = async (amount: number) => {
  try {
    const success = await balanceStore.recharge(amount)
    if (success) {
      message.success(`充值 ${amount} 成功`)
    } else {
      message.error('充值失败')
    }
  } catch (error) {
    message.error('充值失败')
  }
}

// 监听用量变化，自动刷新余额
watch(() => usageStore.totalUsage.totalCost, () => {
  // 延迟1秒刷新余额，等待后端处理完成
  setTimeout(() => {
    balanceStore.fetchBalance()
  }, 1000)
}, { deep: true })

// 组件初始化时获取余额
onMounted(() => {
  balanceStore.refreshAll()
})
</script>

<template>
  <div class="balance-display">
    <!-- 紧凑模式：仅显示余额 -->
    <div v-if="compact" class="flex items-center space-x-2">
      <NPopover trigger="hover" placement="bottom">
        <template #trigger>
          <NTag 
            :type="getBalanceColor(balanceStore.balance)" 
            size="medium"
            class="cursor-pointer"
          >
            <template #icon>
              <SvgIcon icon="ri:wallet-line" />
            </template>
            {{ formatBalance(balanceStore.balance) }}
          </NTag>
        </template>
        <div class="space-y-2 p-2">
          <div class="text-sm">
            <strong>当前余额：</strong>{{ balanceStore.formattedBalance }}
          </div>
          <div v-if="balanceStore.stats" class="text-xs text-gray-500 space-y-1">
            <div>总消费：{{ balanceStore.stats.totalSpent.toFixed(2) }}</div>
            <div>总充值：{{ balanceStore.stats.totalRecharged.toFixed(2) }}</div>
            <div>交易次数：{{ balanceStore.stats.transactionCount }}</div>
          </div>
          <NSpace size="small">
            <NButton size="tiny" secondary @click="quickRecharge(100)">
              充值100
            </NButton>
            <NButton 
              size="tiny" 
              tertiary 
              :loading="refreshing"
              @click="refreshBalance"
            >
              <template #icon>
                <SvgIcon icon="ri:refresh-line" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </div>
      </NPopover>
    </div>

    <!-- 详细模式：显示完整余额信息 -->
    <NCard v-else title="账户余额" size="small" embedded>
      <template #header-extra>
        <NButton 
          size="small" 
          tertiary 
          :loading="refreshing"
          @click="refreshBalance"
        >
          <template #icon>
            <SvgIcon icon="ri:refresh-line" />
          </template>
          刷新
        </NButton>
      </template>

      <div class="space-y-4">
        <!-- 当前余额 -->
        <NStatistic
          label="当前余额"
          :value="balanceStore.balance"
          :precision="2"
        >
          <template #prefix>
            <SvgIcon icon="ri:wallet-line" class="text-green-500" />
          </template>
        </NStatistic>

        <!-- 余额统计 -->
        <div v-if="balanceStore.stats" class="grid grid-cols-2 gap-4">
          <div class="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="text-xl font-bold text-red-500">
              {{ balanceStore.stats.totalSpent.toFixed(2) }}
            </div>
            <div class="text-sm text-gray-500">总消费</div>
          </div>
          
          <div class="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="text-xl font-bold text-blue-500">
              {{ balanceStore.stats.totalRecharged.toFixed(2) }}
            </div>
            <div class="text-sm text-gray-500">总充值</div>
          </div>
        </div>

        <!-- 快速操作 -->
        <NSpace justify="space-between">
          <NSpace size="small">
            <NButton size="small" type="primary" @click="quickRecharge(100)">
              <template #icon>
                <SvgIcon icon="ri:money-dollar-circle-line" />
              </template>
              充值100
            </NButton>
            <NButton size="small" secondary @click="quickRecharge(500)">
              充值500
            </NButton>
          </NSpace>
          
          <div class="text-xs text-gray-500">
            ID: {{ balanceStore.userId }}
          </div>
        </NSpace>

        <!-- 最近交易 -->
        <div v-if="balanceStore.hasTransactions" class="space-y-2">
          <div class="text-sm font-medium">最近交易</div>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            <div 
              v-for="transaction in balanceStore.recentTransactions.slice(0, 3)" 
              :key="transaction.id"
              class="flex justify-between items-center text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded"
            >
              <div>
                <span 
                  :class="{
                    'text-red-500': transaction.type === 'charge',
                    'text-green-500': transaction.type === 'credit'
                  }"
                >
                  {{ transaction.type === 'charge' ? '-' : '+' }}{{ Math.abs(transaction.amount).toFixed(2) }}
                </span>
                <span class="text-gray-500 ml-2">
                  {{ transaction.service || '系统' }}
                </span>
              </div>
              <div class="text-gray-400">
                {{ new Date(transaction.timestamp).toLocaleTimeString() }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.balance-display {
  @apply w-full;
}
</style>