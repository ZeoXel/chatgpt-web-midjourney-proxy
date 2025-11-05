import axios from 'axios'
import type { NextFunction, Request, Response } from 'express'
import FormData from 'form-data'
import proxy from 'express-http-proxy'
import pkg from '../package.json'
import { isNotEmptyString } from './utils/is'

const API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
  ? process.env.OPENAI_API_BASE_URL
  : 'https://api.openai.com'

export const lumaProxy = proxy(process.env.LUMA_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.LUMA_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.LUMA_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const runwayProxy = proxy(process.env.RUNWAY_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    // 移除 /runway 或 /pro/runway 前缀
    let url = req.originalUrl
    if (url.startsWith('/pro/runway')) {
      url = url.replace('/pro/runway', '')
    } else if (url.startsWith('/runway')) {
      url = url.replace('/runway', '')
    }
    console.log('[Runway Proxy] Original URL:', req.originalUrl, '→ Proxied URL:', url)
    return url
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
  limit: '15mb',
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
  limit: '15mb',
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

export const minimaxProxy = proxy(process.env.MINIMAX_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.MINIMAX_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.MINIMAX_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Accept-Encoding'] = 'identity'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const viggleProxy = proxy(process.env.VIGGLE_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    // mlog("sunoapi")
    if (process.env.VIGGLE_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.VIGGLE_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const ideoProxy = proxy(process.env.IDEO_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.IDEO_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.IDEO_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const pikaProxy = proxy(process.env.PIKA_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.PIKA_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.PIKA_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const pixverseProxy = proxy(process.env.PIXVERSE_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.PIXVERSE_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.PIXVERSE_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

export const udioProxy = proxy(process.env.UDIO_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl // req.originalUrl.replace('/sunoapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.UDIO_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.UDIO_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

// req, res, next
export const ideoProxyFileDo = async (req: Request, res: Response, next?: NextFunction) => {
  console.log('req.originalUrl', req.originalUrl)
  let API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
    ? process.env.OPENAI_API_BASE_URL
    : 'https://api.openai.com'
  API_BASE_URL = process.env.IDEO_SERVER ?? API_BASE_URL
  if (req.file.buffer) {
    const fileBuffer = req.file.buffer
    const formData = new FormData()
    formData.append('image_file', fileBuffer, { filename: req.file.originalname })
    formData.append('image_request', req.body.image_request)
    try {
      const url = `${API_BASE_URL}${req.originalUrl}`
      const responseBody = await axios.post(url, formData, {
        headers: {
          'Authorization': `Bearer ${process.env.IDEO_KEY ?? process.env.OPENAI_API_KEY}`,
          'Content-Type': 'multipart/form-data',
          // 'Mj-Version': pkg.version
        },
      })
      res.json(responseBody.data)
    }
    catch (e) {
      res.status(400).json({ error: e })
    }
  }
  else {
    res.status(400).json({ error: 'uploader fail' })
  }
}

export const viggleProxyFileDo = async (req: Request, res: Response, next?: NextFunction) => {
  // if ( process.env.VIGGLE_KEY ) proxyReqOpts.headers['Authorization'] ='Bearer '+process.env.VIGGLE_KEY;
  // else   proxyReqOpts.headers['Authorization'] ='Bearer '+process.env.OPENAI_API_KEY;
  console.log('req.originalUrl', req.originalUrl)
  let API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
    ? process.env.OPENAI_API_BASE_URL
    : 'https://api.openai.com'
  API_BASE_URL = process.env.VIGGLE_SERVER ?? API_BASE_URL
  if (req.file.buffer) {
    const fileBuffer = req.file.buffer
    const formData = new FormData()
    formData.append('file', fileBuffer, { filename: req.file.originalname })
    // formData.append('model',  req.body.model );
    try {
      const url = `${API_BASE_URL}${req.originalUrl}`
      const responseBody = await axios.post(url, formData, {
        headers: {
          'Authorization': `Bearer ${process.env.VIGGLE_KEY ?? process.env.OPENAI_API_KEY}`,
          'Content-Type': 'multipart/form-data',
          // 'Mj-Version': pkg.version
        },
      })
      res.json(responseBody.data)
    }
    catch (e) {
      res.status(400).json({ error: e })
    }
  }
  else {
    res.status(400).json({ error: 'uploader fail' })
  }
}

// viduProxy已移除 - 现在使用NewAPI格式端点 /v1/video/generations

export const sunoProxy = proxy(process.env.SUNO_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    return req.originalUrl.replace('/sunoapi', '')
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.SUNO_KEY)
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.SUNO_KEY}`
    else proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },

})

// Sora2 代理 - 使用 NewAPI 网关格式，支持 FormData
export const sora2Proxy = proxy(process.env.SORA2_SERVER ?? API_BASE_URL, {
  https: false,
  limit: '15mb',
  proxyReqPathResolver(req) {
    const targetServer = process.env.SORA2_SERVER ?? API_BASE_URL
    console.log(`[Sora2] 代理请求到: ${targetServer}${req.originalUrl}`)
    return req.originalUrl // 保持完整路径 /v1/videos 或 /v1/videos/:id
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.SORA2_KEY) {
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.SORA2_KEY}`
      console.log('[Sora2] 使用 SORA2_KEY 认证')
    }
    else {
      proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
      console.log('[Sora2] 使用 OPENAI_API_KEY 认证')
    }

    // ✅ 不强制覆盖 Content-Type，保持原始请求的类型
    // GET 请求和非 multipart 请求才设置为 json
    const contentType = srcReq.headers['content-type'] || ''
    if (srcReq.method === 'GET' || !contentType.includes('multipart')) {
      proxyReqOpts.headers['Content-Type'] = 'application/json'
    }
    // 如果是 multipart/form-data，让它保持原样传递

    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },
  userResDecorator(proxyRes, proxyResData, userReq, userRes) {
    try {
      const data = JSON.parse(proxyResData.toString('utf8'))
      console.log('[Sora2] 响应状态:', proxyRes.statusCode)
      console.log('[Sora2] 响应数据:', JSON.stringify(data, null, 2))

      // 如果返回错误，记录详细信息
      if (data.code === 'fail_submit_task' || proxyRes.statusCode >= 400) {
        console.error('[Sora2] ❌ 请求失败:')
        console.error('  - URL:', userReq.originalUrl)
        console.error('  - 状态码:', proxyRes.statusCode)
        console.error('  - 错误码:', data.code)
        console.error('  - 错误信息:', data.message || '无')
        console.error('  - 目标服务器:', process.env.SORA2_SERVER ?? API_BASE_URL)
      }
    }
    catch (e) {
      // 如果不是JSON，忽略
    }
    return proxyResData
  },

})
