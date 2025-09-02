import axios from 'axios'
import type { NextFunction, Request, Response } from 'express'
import FormData from 'form-data'
import proxy from 'express-http-proxy'
import pkg from '../package.json'
import { isNotEmptyString } from './utils/is'

const API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
  ? process.env.OPENAI_API_BASE_URL
  : 'https://api.openai.com'


export const runwayProxy = proxy(process.env.RUNWAY_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.RUNWAY_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.RUNWAY_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

// runwaymlProxy

export const runwaymlProxy = proxy(process.env.RUNWAYML_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    let url = req.originalUrl
    const server = process.env.RUNWAYML_SERVER ?? API_BASE_URL
    if (server.includes('runwayml.com'))
      url = req.originalUrl.replace('/runwayml', '')

    return url // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.RUNWAYML_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.RUNWAYML_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    proxyReqOpts.headers['X-Runway-Version'] = '2024-11-06' // 'X-Runway-Version':
    return proxyReqOpts
  },

})

export const klingProxy = proxy(process.env.KLING_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.KLING_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.KLING_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})



export const viduProxy = proxy(process.env.VIDU_SERVER ?? 'https://api.vidu.cn', {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    const url = req.originalUrl
    console.log('🔍 VIDU代理请求:', req.method, url)

    // 根据请求路径映射到正确的API端点
    if (url.includes('/vidu/tasks') && req.method === 'POST') {
      // 创建视频任务
      console.log('📝 映射到创建任务端点: /ent/v2/reference2video')
      return '/ent/v2/reference2video'
    }
    else if (url.includes('/vidu/tasks/') && url.includes('/creations') && req.method === 'GET') {
      // 查询任务状态 - 使用官方端点格式
      const taskId = url.match(/\/vidu\/tasks\/([^\/]+)\/creations/)?.[1]
      const targetPath = `/ent/v2/tasks/${taskId}/creations`
      console.log('🔍 映射到查询任务端点:', targetPath)
      return targetPath
    }
    else if (url.includes('/vidu/tasks/') && url.includes('/cancel') && req.method === 'POST') {
      // 取消任务
      const taskId = url.match(/\/vidu\/tasks\/([^\/]+)\/cancel/)?.[1]
      const targetPath = `/ent/v2/tasks/${taskId}/cancel`
      console.log('❌ 映射到取消任务端点:', targetPath)
      return targetPath
    }

    // 默认移除 /vidu 前缀，映射到 /ent/v2
    const defaultPath = url.replace('/vidu', '/ent/v2')
    console.log('🔄 默认映射:', defaultPath)
    return defaultPath
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // Vidu API使用Token认证，不是Bearer
    if (process.env.VIDU_KEY)
      proxyReqOpts.headers.Authorization = `Token ${process.env.VIDU_KEY}`
    else
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`

    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },
})

export const sunoProxy = proxy(process.env.SUNO_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    return req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.SUNO_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.SUNO_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})
