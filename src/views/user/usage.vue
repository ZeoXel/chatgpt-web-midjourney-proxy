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
  NSelect, 
  NSpace,
  NSpin,
  NEmpty,
  NTag,
  useMessage
} from 'naive-ui'
import { useUsageStore } from '@/store/usage'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'

const usageStore = useUsageStore()
const ms = useMessage()

const loading = ref(false)
const dateRange = ref<[number, number] | null>(null)
const selectedService = ref('all')

// 服务选项
const serviceOptions = [
  { label: '全部服务', value: 'all' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Midjourney', value: 'midjourney' },
  { label: 'Suno', value: 'suno' },
  { label: 'Luma', value: 'luma' },
  { label: 'Claude', value: 'claude' },
  { label: 'Gemini', value: 'gemini' },
]

// 计算统计数据
const totalUsage = computed(() => usageStore.totalUsage)
const monthlyUsage = computed(() => usageStore.monthlyUsage)
const dailyUsage = computed(() => usageStore.dailyUsage)
const serviceStats = computed(() => usageStore.serviceStats)

// 表格列定义
const columns = [
  {
    title: '时间',
    key: 'timestamp',
    render: (row: any) => new Date(row.timestamp).toLocaleString(),
  },
  {
    title: '服务',
    key: 'service',
    render: (row: any) => {
      return h(NTag, { type: getServiceTagType(row.service) }, 
        { default: () => getServiceName(row.service) }
      )
    },
  },
  {
    title: '模型',
    key: 'model',
  },
  {
    title: '用量',
    key: 'usage',
    render: (row: any) => `${row.inputTokens || 0} / ${row.outputTokens || 0}`,
  },
  {
    title: '费用',
    key: 'cost',
    render: (row: any) => `¥${row.cost?.toFixed(4) || '0.0000'}`,
  },
  {
    title: '状态',
    key: 'status',
    render: (row: any) => {
      const type = row.status === 'success' ? 'success' : 'error'
      const text = row.status === 'success' ? '成功' : '失败'
      return h(NTag, { type }, { default: () => text })
    },
  },
]

function getServiceTagType(service: string) {
  const types: Record<string, string> = {
    'openai': 'success',
    'midjourney': 'warning',
    'suno': 'info',
    'luma': 'primary',
    'claude': 'error',
    'gemini': 'default',
  }
  return types[service] || 'default'
}

function getServiceName(service: string) {
  const names: Record<string, string> = {
    'openai': 'OpenAI',
    'midjourney': 'Midjourney',
    'suno': 'Suno',
    'luma': 'Luma',
    'claude': 'Claude',
    'gemini': 'Gemini',
  }
  return names[service] || service
}

// 获取使用记录
async function fetchUsageRecords() {
  loading.value = true
  try {
    const params: any = {}
    
    if (dateRange.value) {
      params.startDate = new Date(dateRange.value[0]).toISOString()
      params.endDate = new Date(dateRange.value[1]).toISOString()
    }
    
    if (selectedService.value !== 'all') {
      params.service = selectedService.value
    }
    
    await usageStore.fetchUsageRecords(params)
  } catch (error) {
    console.error('Fetch usage records error:', error)
    ms.error('获取使用记录失败')
  } finally {
    loading.value = false
  }
}

// 导出使用记录
async function exportUsageData() {
  try {
    const params: any = {}
    
    if (dateRange.value) {
      params.startDate = new Date(dateRange.value[0]).toISOString()
      params.endDate = new Date(dateRange.value[1]).toISOString()
    }
    
    if (selectedService.value !== 'all') {
      params.service = selectedService.value
    }
    
    await usageStore.exportUsageData(params)
    ms.success('导出成功')
  } catch (error) {
    console.error('Export usage data error:', error)
    ms.error('导出失败')
  }
}

onMounted(async () => {
  try {
    // 初始化用量数据
    await usageStore.refreshData()
  } catch (error) {
    console.error('Failed to load usage data:', error)
  }
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- 统计卡片 -->
    <NGrid :cols="4" :x-gap="16" :y-gap="16" class="mb-6">
      <NGridItem>
        <NCard>
          <NStatistic
            label="总调用次数"
            :value="totalUsage.totalRequests"
            :precision="0"
          >
            <template #prefix>
              <SvgIcon icon="ri:bar-chart-line" class="text-blue-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="总花费"
            :value="totalUsage.totalCost"
            :precision="4"
            prefix="¥"
          >
            <template #prefix>
              <SvgIcon icon="ri:money-dollar-circle-line" class="text-green-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="本月调用"
            :value="monthlyUsage.requests"
            :precision="0"
          >
            <template #prefix>
              <SvgIcon icon="ri:calendar-line" class="text-orange-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      
      <NGridItem>
        <NCard>
          <NStatistic
            label="本月花费"
            :value="monthlyUsage.cost"
            :precision="4"
            prefix="¥"
          >
            <template #prefix>
              <SvgIcon icon="ri:wallet-line" class="text-purple-500" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 服务使用统计 -->
    <NCard title="服务使用统计" class="mb-6">
      <NGrid :cols="3" :x-gap="16" :y-gap="16">
        <NGridItem v-for="service in serviceStats" :key="service.name">
          <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-2">
                <SvgIcon icon="ri:service-line" class="text-blue-500" />
                <span class="font-medium">{{ getServiceName(service.name) }}</span>
              </div>
              <NTag :type="getServiceTagType(service.name)">
                {{ service.requests }} 次
              </NTag>
            </div>
            
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span>费用占比</span>
                <span>¥{{ service.cost.toFixed(4) }} ({{ service.percentage.toFixed(1) }}%)</span>
              </div>
              <NProgress :percentage="service.percentage" :show-indicator="false" />
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- 查询筛选 -->
    <NCard title="使用记录" class="mb-6">
      <template #header-extra>
        <NSpace>
          <NDatePicker
            v-model:value="dateRange"
            type="daterange"
            placeholder="选择日期范围"
            clearable
          />
          
          <NSelect
            v-model:value="selectedService"
            :options="serviceOptions"
            placeholder="选择服务"
            style="width: 150px"
          />
          
          <NButton @click="fetchUsageRecords" :loading="loading">
            <template #icon>
              <SvgIcon icon="ri:search-line" />
            </template>
            查询
          </NButton>
          
          <NButton @click="exportUsageData" secondary>
            <template #icon>
              <SvgIcon icon="ri:download-line" />
            </template>
            导出
          </NButton>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <NTable
          :columns="columns"
          :data="usageStore.usageRecords"
          :pagination="{ pageSize: 20 }"
          :bordered="false"
        >
          <template #empty>
            <NEmpty description="暂无使用记录" />
          </template>
        </NTable>
      </NSpin>
    </NCard>

    <!-- 今日使用统计 -->
    <NCard title="今日使用概览">
      <NGrid :cols="2" :x-gap="16">
        <NGridItem>
          <div class="text-center p-4">
            <div class="text-3xl font-bold text-blue-500 mb-2">
              {{ dailyUsage.requests }}
            </div>
            <div class="text-gray-500">今日调用次数</div>
          </div>
        </NGridItem>
        
        <NGridItem>
          <div class="text-center p-4">
            <div class="text-3xl font-bold text-green-500 mb-2">
              ¥{{ dailyUsage.cost.toFixed(4) }}
            </div>
            <div class="text-gray-500">今日花费</div>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>
  </div>
</template>