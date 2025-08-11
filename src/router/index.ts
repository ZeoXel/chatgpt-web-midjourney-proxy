import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import { setupPageGuard } from './permission'

// 布局组件 - 预加载关键布局
import { ChatLayout } from '@/views/chat/layout'

// 异步加载其他布局组件
const MjLayout = () => import('@/views/mj/layout.vue')
const SunoLayout = () => import('@/views/suno/layout.vue')
const LumaLayout = () => import('@/views/luma/layout.vue')

// 页面组件预加载配置
const preloadComponents = {
  chat: () => import('@/views/chat/index.vue'),
  draw: () => import('@/views/mj/draw.vue'),
}

const routes: RouteRecordRaw[] = [
  // 聊天相关路由
  {
    path: '/',
    name: 'Root',
    component: ChatLayout,
    redirect: '/chat',
    meta: { 
      title: '对话',
      icon: 'chat',
      priority: 'high',
      transition: 'slide-right',
    },
    children: [
      {
        path: '/chat/:uuid?',
        name: 'Chat',
        component: preloadComponents.chat,
        meta: { 
          title: '对话',
          keepAlive: true,
        },
      },
    ],
  },
  {
    path: '/g',
    name: 'g',
    component: ChatLayout,
    redirect: '/g/g-2fkFE8rbu',
    meta: { 
      title: 'GPTs',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/g/:gid',
        name: 'GPTs',
        component: preloadComponents.chat,
        meta: { 
          title: 'GPTs',
          keepAlive: true,
        },
      },
    ],
  },
  {
    path: '/m',
    name: 'm',
    component: ChatLayout,
    redirect: '/m/gpt-3.5-turbo',
    meta: { 
      title: '模型',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/m/:gid',
        name: 'Model',
        component: preloadComponents.chat,
        meta: { 
          title: '模型选择',
          keepAlive: true,
        },
      },
    ],
  },
  {
    path: '/s',
    name: 's',
    component: ChatLayout,
    redirect: '/s/t',
    meta: { 
      title: '设置',
      transition: 'fade',
    },
    children: [
      {
        path: '/s/t',
        name: 'Setting',
        component: preloadComponents.chat,
        meta: { 
          title: '设置',
        },
      },
    ],
  },

  // 绘画相关路由
  {
    path: '/draw',
    name: 'Rootdraw',
    component: MjLayout,
    redirect: '/draw/index',
    meta: { 
      title: '绘画',
      icon: 'image',
      priority: 'high',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/draw/:uuid?',
        name: 'draw',
        component: preloadComponents.draw,
        meta: { 
          title: 'AI 绘画',
          keepAlive: true,
        },
      },
    ],
  },

  // 音乐相关路由
  {
    path: '/music',
    name: 'RootMusic',
    component: SunoLayout,
    redirect: '/music/index',
    meta: { 
      title: '音乐',
      icon: 'music',
      priority: 'medium',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/music/:uuid?',
        name: 'music',
        component: () => import(/* webpackChunkName: "music" */ '@/views/suno/music.vue'),
        meta: { 
          title: 'AI 音乐',
          keepAlive: true,
        },
      },
    ],
  },

  // 视频相关路由
  {
    path: '/video',
    name: 'RootVideo',
    component: LumaLayout,
    redirect: '/video/index',
    meta: { 
      title: '视频',
      icon: 'video',
      priority: 'medium',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/video/:uuid?',
        name: 'video',
        component: () => import(/* webpackChunkName: "video" */ '@/views/luma/video.vue'),
        meta: { 
          title: 'AI 视频',
          keepAlive: true,
        },
      },
    ],
  },

  // 舞蹈动画路由
  {
    path: '/dance',
    name: 'RootDance',
    component: LumaLayout,
    redirect: '/dance/index',
    meta: { 
      title: '舞蹈',
      icon: 'dance',
      priority: 'low',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/dance/:uuid?',
        name: 'dance',
        component: () => import(/* webpackChunkName: "dance" */ '@/views/viggle/dance.vue'),
        meta: { 
          title: '舞蹈动画',
        },
      },
    ],
  },

  // 语音相关路由
  {
    path: '/wav',
    name: 'RootWav',
    component: LumaLayout,
    redirect: '/wav/index',
    meta: { 
      title: '语音',
      icon: 'audio',
      priority: 'low',
      transition: 'slide-left',
    },
    children: [
      {
        path: '/wav/:uuid?',
        name: 'wav',
        component: () => import(/* webpackChunkName: "audio" */ '@/views/wav/wav.vue'),
        meta: { 
          title: 'AI 语音',
        },
      },
    ],
  },

  // 错误页面
  {
    path: '/404',
    name: '404',
    component: () => import(/* webpackChunkName: "error" */ '@/views/exception/404/index.vue'),
    meta: { 
      title: '页面未找到',
      hideInMenu: true,
    },
  },
  {
    path: '/500',
    name: '500',
    component: () => import(/* webpackChunkName: "error" */ '@/views/exception/500/index.vue'),
    meta: { 
      title: '服务器错误',
      hideInMenu: true,
    },
  },

  // 通配符路由
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    redirect: '/404',
    meta: { 
      hideInMenu: true,
    },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (to, from, savedPosition) => {
    // 支持浏览器前进后退时的滚动位置恢复
    if (savedPosition) {
      return savedPosition
    }
    // 路由切换时平滑滚动到顶部
    return { 
      left: 0, 
      top: 0, 
      behavior: 'smooth' 
    }
  },
})

setupPageGuard(router)

// 路由预加载策略
const preloadRoute = async (routeName: string) => {
  const route = routes.find(r => r.name === routeName)
  if (route && typeof route.component === 'function') {
    try {
      await route.component()
    } catch (error) {
      console.warn(`Failed to preload route ${routeName}:`, error)
    }
  }
}

// 智能预加载
const setupRoutePreloading = () => {
  // 在空闲时预加载高优先级路由
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      preloadRoute('Rootdraw') // 预加载绘画页面
    })
  }

  // 基于用户行为的预加载
  router.afterEach((to) => {
    const currentRoute = to.name as string
    const relatedRoutes = getRelatedRoutes(currentRoute)
    
    // 延迟预加载相关路由
    setTimeout(() => {
      relatedRoutes.forEach(routeName => {
        preloadRoute(routeName)
      })
    }, 1000)
  })
}

// 获取相关路由
const getRelatedRoutes = (currentRoute: string): string[] => {
  const routeMap: Record<string, string[]> = {
    'Chat': ['Rootdraw', 'RootMusic'],
    'draw': ['RootMusic', 'RootVideo'],
    'music': ['RootVideo', 'Rootdraw'],
    'video': ['RootDance', 'RootMusic'],
  }
  
  return routeMap[currentRoute] || []
}

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
  
  // 设置预加载策略
  setupRoutePreloading()
}
