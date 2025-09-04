<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NAlert, NProgress, NSpace, NButton, useMessage } from 'naive-ui'
import { useUsageStore } from '@/store/usage'
import { useBillingStore } from '@/store/billing'
import { SvgIcon } from '@/components/common'
import { useRouter } from 'vue-router'
import { t } from '@/locales'

const usageStore = useUsageStore()
const billingStore = useBillingStore()
const router = useRouter()
const ms = useMessage()

const showAlert = ref(false)
const alertType = ref<'warning' | 'error'>('warning')
const alertMessage = ref('')

// 使用限制配置
const USAGE_LIMITS = {
  // 余额警告阈值
  BALANCE_WARNING: 5.0,    // 余额低于5元警告
  BALANCE_CRITICAL: 1.0,   // 余额低于1元严重警告
  
  // 日用量警告阈值
  DAILY_COST_WARNING: 20.0,   // 日消费超过20元警告
  DAILY_COST_LIMIT: 50.0,     // 日消费超过50元限制
  
  // 月用量警告阈值
  MONTHLY_COST_WARNING: 100.0, // 月消费超过100元警告
  MONTHLY_COST_LIMIT: 500.0,   // 月消费超过500元限制
}

// 计算警告状态
const warningStatus = computed(() => {
  const balance = billingStore.accountInfo?.balance || 0
  const dailyCost = usageStore.dailyUsage?.cost || 0
  const monthlyCost = usageStore.monthlyUsage?.cost || 0
  
  // 余额警告
  if (balance <= USAGE_LIMITS.BALANCE_CRITICAL) {
    return {
      type: 'error',
      title: '余额严重不足',
      message: `当前余额仅剩 ¥${balance.toFixed(4)}，请立即充值以避免服务中断`,
      action: 'recharge',
      priority: 3
    }
  }
  
  if (balance <= USAGE_LIMITS.BALANCE_WARNING) {
    return {
      type: 'warning',
      title: '余额不足',
      message: `当前余额 ¥${balance.toFixed(4)}，建议及时充值`,
      action: 'recharge',
      priority: 2
    }
  }
  
  // 日消费警告
  if (dailyCost >= USAGE_LIMITS.DAILY_COST_LIMIT) {
    return {
      type: 'error',
      title: '日消费已达上限',
      message: `今日消费 ¥${dailyCost.toFixed(4)}，已超过日限额 ¥${USAGE_LIMITS.DAILY_COST_LIMIT}`,
      action: 'usage',
      priority: 3
    }
  }
  
  if (dailyCost >= USAGE_LIMITS.DAILY_COST_WARNING) {
    return {
      type: 'warning',
      title: '日消费较高',
      message: `今日消费 ¥${dailyCost.toFixed(4)}，请注意控制使用量`,
      action: 'usage',
      priority: 1
    }
  }
  
  // 月消费警告
  if (monthlyCost >= USAGE_LIMITS.MONTHLY_COST_LIMIT) {
    return {
      type: 'error',
      title: '月消费已达上限',
      message: `本月消费 ¥${monthlyCost.toFixed(4)}，已超过月限额 ¥${USAGE_LIMITS.MONTHLY_COST_LIMIT}`,
      action: 'usage',
      priority: 3
    }
  }
  
  if (monthlyCost >= USAGE_LIMITS.MONTHLY_COST_WARNING) {
    return {
      type: 'warning',
      title: '月消费较高',
      message: `本月消费 ¥${monthlyCost.toFixed(4)}，请注意控制使用量`,
      action: 'usage',
      priority: 1
    }
  }
  
  return null
})

// 监听警告状态变化
const updateAlert = () => {
  const warning = warningStatus.value
  if (warning) {
    showAlert.value = true
    alertType.value = warning.type as 'warning' | 'error'
    alertMessage.value = warning.message
  } else {
    showAlert.value = false
  }
}

// 处理操作按钮点击
const handleAction = (action: string) => {
  switch (action) {
    case 'recharge':
      router.push('/user/billing')
      ms.info('跳转到充值页面')
      break
    case 'usage':
      router.push('/user/usage')
      ms.info('跳转到用量监控页面')
      break
    default:
      break
  }
}

// 获取进度条状态
const progressStatus = computed(() => {
  const warning = warningStatus.value
  if (!warning) return null
  
  const balance = billingStore.accountInfo?.balance || 0
  const dailyCost = usageStore.dailyUsage?.cost || 0
  const monthlyCost = usageStore.monthlyUsage?.cost || 0
  
  if (warning.action === 'recharge') {
    const percentage = Math.min((balance / USAGE_LIMITS.BALANCE_WARNING) * 100, 100)
    return {
      percentage,
      status: percentage < 20 ? 'error' : percentage < 50 ? 'warning' : 'success'
    }
  }
  
  if (warning.action === 'usage') {
    if (dailyCost >= USAGE_LIMITS.DAILY_COST_WARNING) {
      const percentage = Math.min((dailyCost / USAGE_LIMITS.DAILY_COST_LIMIT) * 100, 100)
      return {
        percentage,
        status: percentage >= 100 ? 'error' : percentage >= 80 ? 'warning' : 'info'
      }
    }
    
    if (monthlyCost >= USAGE_LIMITS.MONTHLY_COST_WARNING) {
      const percentage = Math.min((monthlyCost / USAGE_LIMITS.MONTHLY_COST_LIMIT) * 100, 100)
      return {
        percentage,
        status: percentage >= 100 ? 'error' : percentage >= 80 ? 'warning' : 'info'
      }
    }
  }
  
  return null
})

onMounted(() => {
  // 初始化时更新警告状态
  updateAlert()
  
  // 定期检查警告状态（每30秒）
  const interval = setInterval(() => {
    updateAlert()
  }, 30000)
  
  // 组件卸载时清理定时器
  return () => {
    clearInterval(interval)
  }
})

// 监听store变化
usageStore.$subscribe(() => {
  updateAlert()
})

billingStore.$subscribe(() => {
  updateAlert()
})
</script>

<template>
  <div v-if="showAlert" class="usage-alert mb-4">
    <NAlert 
      :type="alertType" 
      :title="warningStatus?.title"
      closable
      @close="showAlert = false"
    >
      <div class="space-y-3">
        <div>{{ alertMessage }}</div>
        
        <!-- 进度条 -->
        <div v-if="progressStatus" class="space-y-2">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            使用进度
          </div>
          <NProgress
            type="line"
            :percentage="progressStatus.percentage"
            :status="progressStatus.status"
            :show-indicator="true"
          />
        </div>
        
        <!-- 操作按钮 -->
        <NSpace>
          <NButton
            v-if="warningStatus?.action === 'recharge'"
            type="primary"
            size="small"
            @click="handleAction('recharge')"
          >
            <template #icon>
              <SvgIcon icon="ri:money-dollar-circle-line" />
            </template>
            立即充值
          </NButton>
          
          <NButton
            v-if="warningStatus?.action === 'usage'"
            type="primary"
            size="small"
            @click="handleAction('usage')"
          >
            <template #icon>
              <SvgIcon icon="ri:bar-chart-line" />
            </template>
            查看详情
          </NButton>
        </NSpace>
      </div>
    </NAlert>
  </div>
</template>

<style scoped>
.usage-alert {
  position: sticky;
  top: 0;
  z-index: 100;
}
</style>