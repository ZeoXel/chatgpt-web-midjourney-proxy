import { useMessage, useDialog } from 'naive-ui'
import { homeStore } from '@/store'
import { h } from 'vue'

/**
 * 余额守卫：检查用户余额状态，如果不足则显示充值引导
 * @param action 要执行的操作描述
 * @returns Promise<boolean> 是否允许继续执行
 */
export const checkBalance = async (action?: string): Promise<boolean> => {
  if (homeStore.myData.hasBalance) {
    return true
  }

  const ms = useMessage()
  const dialog = useDialog()

  const actionText = action || 'AI服务'

  // 显示拦截提示
  ms.warning(`账户余额不足，无法使用${actionText}`, {
    duration: 3000
  })

  return new Promise((resolve) => {
    const dialogInstance = dialog.info({
      title: '账户余额不足',
      style: {
        '--n-title-text-color': '#445ff6'
      },
      content: h('div', [
        h('p', { style: 'margin-bottom: 16px; color: #374151; font-size: 15px' }, `您即将使用${actionText}，但当前账户余额不足。`),
        h('p', { style: 'margin-bottom: 16px; color: #6b7280; font-size: 14px' }, '为了保证服务质量和使用体验，建议您充值后继续使用AI功能。'),
        h('div', { style: 'padding: 14px; background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%); border-left: 3px solid #445ff6; border-radius: 8px; margin-bottom: 16px' }, [
          h('p', { style: 'margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #445ff6' }, '✓ 您仍可以：'),
          h('ul', { style: 'margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.8' }, [
            h('li', '查看所有AI生成的历史记录'),
            h('li', '浏览已保存的图片、音频和视频'),
            h('li', '管理和导出您的创作内容')
          ])
        ])
      ]),
      positiveText: '立即充值',
      negativeText: '稍后充值',
      positiveButtonProps: {
        type: 'primary',
        style: {
          'background-color': '#445ff6',
          'border-color': '#445ff6'
        }
      },
      negativeButtonProps: {
        style: {
          'color': '#6b7280'
        }
      },
      onPositiveClick: () => {
        ms.info('正在跳转到充值页面...')
        homeStore.setMyData({ act: 'showRechargeModal' })
        resolve(false)
      },
      onNegativeClick: () => {
        ms.info('您可以随时在页面中点击充值按钮')
        resolve(false)
      },
      onClose: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 余额守卫装饰器：为函数添加余额检查
 * @param action 操作描述
 */
export const withBalanceCheck = (action?: string) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const canProceed = await checkBalance(action)
      if (canProceed) {
        return originalMethod.apply(this, args)
      }
    }

    return descriptor
  }
}

/**
 * 快速检查余额状态（不显示弹窗）
 */
export const hasBalance = (): boolean => {
  return homeStore.myData.hasBalance
}