<script setup lang='ts'>
import { ref, computed, onMounted, h } from 'vue'
import { 
  NCard, 
  NGrid, 
  NGridItem, 
  NStatistic, 
  NProgress,
  NTable, 
  NButton, 
  NDatePicker, 
  NSpace,
  NSpin,
  NEmpty,
  NTag,
  NAlert,
  NModal,
  NForm,
  NFormItem,
  NInputNumber,
  NSelect,
  useMessage
} from 'naive-ui'
import { useBillingStore } from '@/store/billing'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'

const billingStore = useBillingStore()
const ms = useMessage()

const loading = ref(false)
const showRechargeModal = ref(false)
const dateRange = ref<[number, number] | null>(null)

// 充值表单
const rechargeForm = ref({
  amount: 0,
  paymentMethod: 'alipay',
})

// 充值套餐
const rechargePackages = [
  { id: 'pkg_10', name: '基础套餐', amount: 10, bonus: 0, description: '适合轻度使用' },
  { id: 'pkg_50', name: '标准套餐', amount: 50, bonus: 5, description: '送5元，适合日常使用' },
  { id: 'pkg_100', name: '高级套餐', amount: 100, bonus: 15, description: '送15元，适合重度使用' },
  { id: 'pkg_200', name: '专业套餐', amount: 200, bonus: 40, description: '送40元，适合商业使用' },
]

// 支付方式选项
const paymentOptions = [
  { label: '支付宝', value: 'alipay', icon: 'ri:alipay-line' },
  { label: '微信支付', value: 'wechat', icon: 'ri:wechat-pay-line' },
  { label: '银行卡', value: 'bank', icon: 'ri:bank-card-line' },
]

// 计算账户信息
const accountInfo = computed(() => billingStore.accountInfo)
const transactions = computed(() => billingStore.transactions)

// 余额警告
const balanceWarning = computed(() => {
  const balance = accountInfo.value?.balance || 0
  if (balance < 1) return { type: 'error', message: '余额不足1元，请及时充值' }
  if (balance < 5) return { type: 'warning', message: '余额较低，建议充值' }
  return null
})

// 表格列定义
const columns = [
  {
    title: '时间',
    key: 'createdAt',
    render: (row: any) => new Date(row.createdAt).toLocaleString(),
  },
  {
    title: '类型',
    key: 'type',
    render: (row: any) => {
      const type = row.type === 'recharge' ? 'success' : 'info'
      const text = row.type === 'recharge' ? '充值' : '消费'
      return h(NTag, { type }, { default: () => text })
    },
  },
  {
    title: '金额',
    key: 'amount',
    render: (row: any) => {
      const isPositive = row.type === 'recharge'
      const className = isPositive ? 'text-green-500' : 'text-red-500'
      const text = `${isPositive ? '+' : '-'}¥${Math.abs(row.amount).toFixed(4)}`
      return h('span', { class: className }, text)
    },
  },
  {
    title: '余额',
    key: 'balanceAfter',
    render: (row: any) => `¥${row.balanceAfter?.toFixed(4) || '0.0000'}`,
  },
  {
    title: '描述',
    key: 'description',
  },
  {
    title: '状态',
    key: 'status',
    render: (row: any) => {
      const statusMap: Record<string, { type: string; text: string }> = {
        'completed': { type: 'success', text: '已完成' },
        'pending': { type: 'warning', text: '处理中' },
        'failed': { type: 'error', text: '失败' },
      }
      const status = statusMap[row.status] || { type: 'default', text: row.status }
      return h(NTag, { type: status.type }, { default: () => status.text })
    },
  },
]

// 获取账户信息
async function fetchAccountInfo() {
  loading.value = true
  try {
    await billingStore.refreshData()
  } catch (error) {
    console.error('Fetch account info error:', error)
    ms.error('获取账户信息失败')
  } finally {
    loading.value = false
  }
}

// 获取交易记录
async function fetchTransactions() {
  loading.value = true
  try {
    const params: any = {}
    
    if (dateRange.value) {
      params.startDate = new Date(dateRange.value[0]).toISOString()
      params.endDate = new Date(dateRange.value[1]).toISOString()
    }
    
    await billingStore.fetchTransactions(params)
  } catch (error) {
    console.error('Fetch transactions error:', error)
    // Don't show error for mock data
    console.log('Using mock data for transactions')
  } finally {
    loading.value = false
  }
}

// 选择充值套餐
function selectPackage(pkg: typeof rechargePackages[0]) {
  rechargeForm.value.amount = pkg.amount + pkg.bonus
  showRechargeModal.value = true
}

// 提交充值申请
async function handleRecharge() {
  if (rechargeForm.value.amount <= 0) {
    ms.error('充值金额必须大于0')
    return
  }

  loading.value = true
  try {
    const result = await billingStore.createRechargeOrder({
      amount: rechargeForm.value.amount,
      paymentMethod: rechargeForm.value.paymentMethod,
    })
    
    if (result.success) {
      ms.success('充值申请已提交')
      showRechargeModal.value = false
      
      // 如果有支付链接，打开新窗口
      if (result.paymentUrl) {
        window.open(result.paymentUrl, '_blank')
      }
      
      // 刷新账户信息
      await fetchAccountInfo()
    } else {
      ms.error(result.message || '充值申请失败')
    }
  } catch (error) {
    console.error('Recharge error:', error)
    ms.error('充值申请失败，请重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAccountInfo()
  fetchTransactions()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- 余额警告 -->
    <NAlert 
      v-if="balanceWarning" 
      :type="balanceWarning.type" 
      :title="balanceWarning.message"
      class="mb-6"
      closable
    />

    <!-- 账户信息卡片 -->
    <NGrid :cols="4" :x-gap="16" :y-gap="16" class="mb-6">
      <NGridItem>
        <NCard>
          <NStatistic
            label="账户余额"
            :value="accountInfo?.balance || 0"
            :precision="4"
            :prefix="'¥'"
          >
            <template #prefix>
              <SvgIcon icon="ri:wallet-line" class="text-green-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="总充值"
            :value="accountInfo?.totalRecharge || 0"
            :precision="4"
            :prefix="'¥'"
          >
            <template #prefix>
              <SvgIcon icon="ri:money-dollar-circle-line" class="text-blue-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="总消费"
            :value="accountInfo?.totalSpent || 0"
            :precision="4"
            :prefix="'¥'"
          >
            <template #prefix>
              <SvgIcon icon="ri:shopping-cart-line" class="text-orange-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="信用等级"
            :value="accountInfo?.creditLevel || 'A'"
          >
            <template #prefix>
              <SvgIcon icon="ri:star-line" class="text-yellow-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 充值套餐 -->
    <NCard title="充值套餐" class="mb-6">
      <template #header-extra>
        <NButton type="primary" @click="showRechargeModal = true">
          <template #icon>
            <SvgIcon icon="ri:add-line" />
          </template>
          自定义充值
        </NButton>
      </template>
      
      <NGrid :cols="4" :x-gap="16" :y-gap="16">
        <NGridItem v-for="pkg in rechargePackages" :key="pkg.id">
          <div class="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 transition-colors cursor-pointer"
               @click="selectPackage(pkg)">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-500 mb-1">
                ¥{{ pkg.amount }}
              </div>
              <div v-if="pkg.bonus > 0" class="text-sm text-green-500 mb-2">
                赠送 ¥{{ pkg.bonus }}
              </div>
              <div class="font-medium mb-2">{{ pkg.name }}</div>
              <div class="text-sm text-gray-500">{{ pkg.description }}</div>
              <NButton class="mt-3" size="small" secondary>
                立即充值
              </NButton>
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- 交易记录 -->
    <NCard title="交易记录">
      <template #header-extra>
        <NSpace>
          <NDatePicker
            v-model:value="dateRange"
            type="daterange"
            placeholder="选择日期范围"
            clearable
          />
          
          <NButton @click="fetchTransactions" :loading="loading">
            <template #icon>
              <SvgIcon icon="ri:search-line" />
            </template>
            查询
          </NButton>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <NTable
          :columns="columns"
          :data="transactions"
          :pagination="{ pageSize: 20 }"
          :bordered="false"
        >
          <template #empty>
            <NEmpty description="暂无交易记录" />
          </template>
        </NTable>
      </NSpin>
    </NCard>

    <!-- 充值模态框 -->
    <NModal v-model:show="showRechargeModal" preset="dialog" title="充值">
      <NForm :model="rechargeForm" label-placement="left" label-width="120px">
        <NFormItem label="充值金额">
          <NInputNumber
            v-model:value="rechargeForm.amount"
            :min="1"
            :max="10000"
            :step="1"
            :precision="2"
            placeholder="请输入充值金额"
          >
            <template #prefix>¥</template>
          </NInputNumber>
        </NFormItem>

        <NFormItem label="支付方式">
          <NSelect
            v-model:value="rechargeForm.paymentMethod"
            :options="paymentOptions"
            placeholder="选择支付方式"
          >
            <template #option="{ node, option }">
              <div class="flex items-center space-x-2">
                <SvgIcon :icon="option.icon" />
                <span>{{ option.label }}</span>
              </div>
            </template>
          </NSelect>
        </NFormItem>
      </NForm>

      <template #action>
        <NSpace>
          <NButton @click="showRechargeModal = false">
            取消
          </NButton>
          <NButton 
            type="primary" 
            :loading="loading"
            @click="handleRecharge"
            :disabled="rechargeForm.amount <= 0"
          >
            确认充值
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>