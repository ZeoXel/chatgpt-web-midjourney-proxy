import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'

// 导入 Tailwind CSS
import './styles/utilities.css'

async function bootstrap() {
  const app = createApp(App)
  
  // 设置资源
  setupAssets()
  
  // 设置滚动条样式
  setupScrollbarStyle()
  
  // 设置状态管理
  setupStore(app)
  
  // 设置国际化
  setupI18n(app)
  
  // 设置路由
  await setupRouter(app)
  
  // 挂载应用
  app.mount('#app')
  
  console.log('🚀 应用启动完成')
}

bootstrap().catch(error => {
  console.error('❌ 应用启动失败:', error)
})
