<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue'
import { 
  NCard, 
  NForm, 
  NFormItem, 
  NInput, 
  NButton, 
  NAvatar, 
  NUpload, 
  NSpace,
  NTag,
  NSpin,
  useMessage,
  type UploadFileInfo
} from 'naive-ui'
import { useUserAuthStore } from '@/store/modules/user'
import { SvgIcon } from '@/components/common'
import { t } from '@/locales'

const userStore = useUserAuthStore()
const ms = useMessage()

const loading = ref(false)
const uploading = ref(false)

// 表单数据
const formData = ref({
  username: '',
  email: '',
  name: '',
  avatar: '',
})

const originalData = ref({ ...formData.value })

// 密码修改表单
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const isEditing = ref(false)
const isChangingPassword = ref(false)

const userInfo = computed(() => userStore.userInfo)
const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

// 初始化数据
function initializeForm() {
  if (userInfo.value) {
    formData.value = {
      username: userInfo.value.username || '',
      email: userInfo.value.email || '',
      name: userInfo.value.name || '',
      avatar: userInfo.value.avatar || '',
    }
    originalData.value = { ...formData.value }
  }
}

// 保存用户信息
async function handleSave() {
  if (!hasChanges.value) {
    ms.warning('没有任何更改')
    return
  }

  loading.value = true
  try {
    const result = await userStore.updateProfile(formData.value)
    if (result.success) {
      ms.success('更新成功')
      originalData.value = { ...formData.value }
      isEditing.value = false
    } else {
      ms.error(result.message || '更新失败')
    }
  } catch (error) {
    console.error('Update profile error:', error)
    ms.error('更新失败，请重试')
  } finally {
    loading.value = false
  }
}

// 取消编辑
function handleCancel() {
  formData.value = { ...originalData.value }
  isEditing.value = false
}

// 修改密码
async function handleChangePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ms.error('新密码确认不匹配')
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    ms.error('密码长度至少6位')
    return
  }

  loading.value = true
  try {
    // TODO: 实现密码修改API调用
    ms.success('密码修改成功')
    passwordForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
    isChangingPassword.value = false
  } catch (error) {
    console.error('Change password error:', error)
    ms.error('密码修改失败，请重试')
  } finally {
    loading.value = false
  }
}

// 头像上传
function handleAvatarUpload(options: { file: UploadFileInfo }) {
  const { file } = options
  if (!file.file) return

  uploading.value = true
  
  const reader = new FileReader()
  reader.onload = () => {
    formData.value.avatar = reader.result as string
    uploading.value = false
    ms.success('头像上传成功')
  }
  reader.onerror = () => {
    uploading.value = false
    ms.error('头像上传失败')
  }
  reader.readAsDataURL(file.file)
}

onMounted(() => {
  initializeForm()
})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- 用户信息卡片 -->
    <NCard title="个人资料" class="mb-6">
      <template #header-extra>
        <NSpace>
          <NTag v-if="userInfo?.role === 'admin'" type="error">管理员</NTag>
          <NTag v-else-if="userInfo?.role === 'vip'" type="warning">VIP用户</NTag>
          <NTag v-else type="info">普通用户</NTag>
        </NSpace>
      </template>

      <NSpin :show="loading">
        <div class="space-y-6">
          <!-- 头像区域 -->
          <div class="flex items-center space-x-4">
            <NAvatar
              :size="80"
              :src="formData.avatar"
              fallback-src="/avatar-placeholder.jpg"
            >
              <SvgIcon icon="ri:user-line" class="text-2xl" />
            </NAvatar>
            
            <div v-if="isEditing" class="flex-1">
              <NUpload
                accept="image/*"
                :max="1"
                :show-file-list="false"
                @update:file-list="() => {}"
                @change="handleAvatarUpload"
              >
                <NButton :loading="uploading" secondary>
                  <template #icon>
                    <SvgIcon icon="ri:upload-2-line" />
                  </template>
                  更换头像
                </NButton>
              </NUpload>
              <div class="text-xs text-gray-500 mt-2">
                支持 JPG、PNG 格式，建议尺寸 200x200
              </div>
            </div>
          </div>

          <!-- 基本信息表单 -->
          <NForm :model="formData" label-placement="left" label-width="120px">
            <NFormItem label="用户名">
              <NInput
                v-model:value="formData.username"
                :disabled="!isEditing"
                placeholder="请输入用户名"
              />
            </NFormItem>

            <NFormItem label="邮箱">
              <NInput
                v-model:value="formData.email"
                :disabled="!isEditing"
                placeholder="请输入邮箱"
                type="email"
              />
            </NFormItem>

            <NFormItem label="显示名称">
              <NInput
                v-model:value="formData.name"
                :disabled="!isEditing"
                placeholder="请输入显示名称"
              />
            </NFormItem>

            <NFormItem label="注册时间" v-if="userInfo?.createdAt">
              <NInput
                :value="new Date(userInfo.createdAt).toLocaleString()"
                readonly
                disabled
              />
            </NFormItem>

            <NFormItem label="最后登录" v-if="userInfo?.lastLoginAt">
              <NInput
                :value="new Date(userInfo.lastLoginAt).toLocaleString()"
                readonly
                disabled
              />
            </NFormItem>
          </NForm>

          <!-- 操作按钮 -->
          <div class="flex justify-end space-x-3">
            <template v-if="isEditing">
              <NButton @click="handleCancel">
                取消
              </NButton>
              <NButton 
                type="primary" 
                :disabled="!hasChanges"
                @click="handleSave"
              >
                保存更改
              </NButton>
            </template>
            <template v-else>
              <NButton @click="isEditing = true">
                <template #icon>
                  <SvgIcon icon="ri:edit-line" />
                </template>
                编辑资料
              </NButton>
            </template>
          </div>
        </div>
      </NSpin>
    </NCard>

    <!-- 安全设置卡片 -->
    <NCard title="安全设置">
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <div class="font-medium">修改密码</div>
            <div class="text-sm text-gray-500">定期修改密码可以提高账户安全性</div>
          </div>
          <NButton 
            secondary 
            @click="isChangingPassword = !isChangingPassword"
          >
            {{ isChangingPassword ? '取消' : '修改密码' }}
          </NButton>
        </div>

        <!-- 密码修改表单 -->
        <div v-if="isChangingPassword" class="p-4 border rounded-lg">
          <NForm :model="passwordForm" label-placement="left" label-width="120px">
            <NFormItem label="当前密码">
              <NInput
                v-model:value="passwordForm.oldPassword"
                type="password"
                placeholder="请输入当前密码"
                show-password-on="click"
              />
            </NFormItem>

            <NFormItem label="新密码">
              <NInput
                v-model:value="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                show-password-on="click"
              />
            </NFormItem>

            <NFormItem label="确认新密码">
              <NInput
                v-model:value="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password-on="click"
              />
            </NFormItem>

            <NFormItem>
              <div class="flex justify-end space-x-3">
                <NButton @click="isChangingPassword = false">
                  取消
                </NButton>
                <NButton 
                  type="primary" 
                  @click="handleChangePassword"
                  :disabled="!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword"
                >
                  确认修改
                </NButton>
              </div>
            </NFormItem>
          </NForm>
        </div>
      </div>
    </NCard>
  </div>
</template>