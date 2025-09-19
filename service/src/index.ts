import path from 'path'
import fs from 'fs'
import multer from 'multer'
import express from 'express'
// const { createProxyMiddleware } = require('http-proxy-middleware');
// import {createProxyMiddleware} from "http-proxy-middleware"
import proxy from 'express-http-proxy'
import bodyParser from 'body-parser'
import FormData from 'form-data'
import axios from 'axios'
import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import pkg from '../package.json'
import { formattedDate, isNotEmptyString } from './utils/is'
import { auth, authV2, regCookie, turnstileCheck, verify } from './middleware/auth'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import type { ChatMessage } from './chatgpt'
import type { RequestProps } from './types'
import { ideoProxy, ideoProxyFileDo, klingProxy, lumaProxy, pikaProxy, pixverseProxy, runwayProxy, runwaymlProxy, sunoProxy, udioProxy, viduProxy, viggleProxy, viggleProxyFileDo } from './myfun'

const app = express()
const router = express.Router()

app.use(express.static('public', {
  // 设置响应头，允许带有查询参数的请求访问静态文件
  setHeaders: (res, path, stat) => {
    res.set('Cache-Control', 'public, max-age=1')
  },
}))
// app.use(express.json())
app.use(bodyParser.json({ limit: '10mb' })) // 大文件传输

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', authV2, async (req, res) => { // [authV2, limiter]
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {}, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    const isUpload = isNotEmptyString(process.env.API_UPLOADER)
    const isHideServer = process.env.HIDE_SERVER === 'true'
    const amodel = process.env.OPENAI_API_MODEL ?? 'gpt-5-nano'
    const isApiGallery = isNotEmptyString(process.env.MJ_API_GALLERY)
    const cmodels = process.env.CUSTOM_MODELS ?? ''
    const baiduId = process.env.TJ_BAIDU_ID ?? ''
    const googleId = process.env.TJ_GOOGLE_ID ?? ''
    const notify = process.env.SYS_NOTIFY ?? ''
    const disableGpt4 = process.env.DISABLE_GPT4 ?? ''
    const isUploadR2 = isNotEmptyString(process.env.R2_DOMAIN)
    const isWsrv = process.env.MJ_IMG_WSRV ?? ''
    const uploadImgSize = process.env.UPLOAD_IMG_SIZE ?? '3'
    const gptUrl = process.env.GPT_URL ?? ''
    const theme = process.env.SYS_THEME ?? 'dark'
    const isCloseMdPreview = !!process.env.CLOSE_MD_PREVIEW
    const uploadType = process.env.UPLOAD_TYPE
    const turnstile = process.env.TURNSTILE_SITE
    const menuDisable = process.env.MENU_DISABLE ?? ''
    const visionModel = process.env.VISION_MODEL ?? ''
    const systemMessage = process.env.SYSTEM_MESSAGE ?? ''
    const customVisionModel = process.env.CUSTOM_VISION_MODELS ?? ''
    const backgroundImage = process.env.BACKGROUND_IMAGE ?? ''
    let isHk = (process.env.OPENAI_API_BASE_URL ?? '').toLocaleLowerCase().indexOf('-hk') > 0
    if (!isHk)
      isHk = (process.env.LUMA_SERVER ?? '').toLocaleLowerCase().indexOf('-hk') > 0
    if (!isHk)
      isHk = (process.env.VIGGLE_SERVER ?? '').toLocaleLowerCase().indexOf('-hk') > 0
    if (!isHk)
      isHk = (process.env.VIDU_SERVER ?? '').toLocaleLowerCase().indexOf('-hk') > 0

    const data = {
      disableGpt4,
      isWsrv,
      uploadImgSize,
      theme,
      isCloseMdPreview,
      uploadType,
      notify,
      baiduId,
      googleId,
      isHideServer,
      isUpload,
      auth: hasAuth,
      model: currentModel(),
      amodel,
      isApiGallery,
      cmodels,
      isUploadR2,
      gptUrl,
      turnstile,
      menuDisable,
      visionModel,
      systemMessage,
      customVisionModel,
      backgroundImage,
      isHk,
    }
    res.send({ status: 'Success', message: '', data })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', verify)
router.get('/reg', regCookie)

const API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
  ? process.env.OPENAI_API_BASE_URL
  : 'https://api.openai.com'

app.use('/mjapi', authV2, proxy(process.env.MJ_SERVER ? process.env.MJ_SERVER : 'https://api.openai.com', {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    return req.originalUrl.replace('/mjapi', '') // 将URL中的 `/mjapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    if (process.env.MJ_API_SECRET)
      proxyReqOpts.headers['mj-api-secret'] = process.env.MJ_API_SECRET
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },
  // limit: '10mb'

}))

// 设置存储引擎和文件保存路径
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadFolderPath = `./uploads/${formattedDate()}/`// `

    // console.log('dir', __dirname   ) ;

    if (!fs.existsSync('./uploads/'))
      fs.mkdirSync('./uploads/')

    if (!fs.existsSync(uploadFolderPath))
      fs.mkdirSync(uploadFolderPath)

    cb(null, `uploads/${formattedDate()}/`)
  },
  filename(req, file, cb) {
    const filename = Date.now() + path.extname(file.originalname)
    console.log('file', filename)
    cb(null, filename)
  },
})
const upload = multer({ storage })

const storage2 = multer.memoryStorage()
const upload2 = multer({ storage: storage2 })

// 处理文件上传的路由
const isUpload = isNotEmptyString(process.env.API_UPLOADER)
if (isUpload) {
  if (process.env.FILE_SERVER) {
    app.use('/openapi/v1/upload',
      upload2.single('file'),
      async (req, res, next) => {
        // console.log( "boday",req.body ,  req.body.model );
        if (req.file.buffer) {
          const fileBuffer = req.file.buffer
          const formData = new FormData()
          formData.append('file', fileBuffer, { filename: req.file.originalname })
          // formData.append('model',  req.body.model );
          try {
            const url = process.env.FILE_SERVER
            const responseBody = await axios.post(url, formData, {
              headers: {
                // Authorization: 'Bearer '+ process.env.OPENAI_API_KEY ,
                'Content-Type': 'multipart/form-data',
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
      },
    )
  }
  else {
    app.use('/openapi/v1/upload', authV2, upload.single('file'), (req, res) => {
    // res.send('文件上传成功！');
      res.setHeader('Content-type', 'application/json')
      if (req.file.filename)
        res.json({ url: `/uploads/${formattedDate()}/${req.file.filename}`, created: Date.now() })
      else res.json({ error: 'uploader fail', created: Date.now() })
    })
  }
}
else {
  app.use('/openapi/v1/upload', (req, res) => {
    // res.send('文件上传成功！');
    res.json({ error: 'server is no open uploader ', created: Date.now() })
  })
}
app.use('/uploads', express.static('uploads'))

// R2Client function
const R2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_KEY_ID
  const accessKeySecret = process.env.R2_KEY_SECRET
  const endpoint = new AWS.Endpoint(`https://${accountId}.r2.cloudflarestorage.com`)
  const s3 = new AWS.S3({
    endpoint,
    region: 'auto',
    credentials: new AWS.Credentials(accessKeyId, accessKeySecret),
    signatureVersion: 'v4',
  })
  return s3
}

// cloudflare R2 upload
app.post('/openapi/pre_signed', (req, res) => {
  const bucketName = process.env.R2_BUCKET_NAME
  const domain = process.env.R2_DOMAIN
  const s3 = R2Client()
  const fileName = uuidv4()
  const saveFile = `${new Date().toISOString().split('T')[0]}/${fileName}${req.body.file_name}`

  const params = {
    Bucket: bucketName,
    Key: saveFile,
    ContentType: req.body.ContentType,
    Expires: 60 * 60, // 1 hour
  }

  s3.getSignedUrl('putObject', params, (err, url) => {
    if (err) {
      res.status(500).json({
        status: 'Error',
        message: `Couldn't get presigned URL for PutObject: ${err.message}`,
      })
      return
    }

    res.json({
      status: 'Success',
      message: '',
      data: {
        up: url,
        url: `${domain}/${saveFile}`,
      },
    })
  })
})

app.use(
  '/openapi/v1/audio/transcriptions', authV2,
  upload2.single('file'),
  async (req, res, next) => {
    // console.log( "boday",req.body ,  req.body.model );
    if (req.file.buffer) {
      const fileBuffer = req.file.buffer
      const formData = new FormData()
      formData.append('file', fileBuffer, { filename: req.file.originalname })
      formData.append('model', req.body.model)
      try {
        const url = `${API_BASE_URL}/v1/audio/transcriptions`
        const responseBody = await axios.post(url, formData, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
            'Mj-Version': pkg.version,
          },
        })
        // console.log('responseBody', responseBody.data  );
        res.json(responseBody.data)
      }
      catch (e) {
        // console.log('goog',e );
        res.status(400).json({ error: e })
      }
    }
    else {
      res.status(400).json({ error: 'uploader fail' })
    }
  },
)

// 代理openai 接口
app.use('/openapi', authV2, turnstileCheck, proxy(API_BASE_URL, {
  https: false,
  limit: '10mb',
  proxyReqPathResolver(req) {
    return req.originalUrl.replace('/openapi', '') // 将URL中的 `/openapi` 替换为空字符串
  },
  proxyReqOptDecorator(proxyReqOpts, srcReq) {
    proxyReqOpts.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`
    proxyReqOpts.headers['Content-Type'] = 'application/json'
    proxyReqOpts.headers['Mj-Version'] = pkg.version
    return proxyReqOpts
  },
  // limit: '10mb'
}))

// 代理sunoApi 接口
app.use('/sunoapi', authV2, sunoProxy)
app.use('/suno', authV2, sunoProxy)

// 代理luma 接口
app.use('/luma', authV2, lumaProxy)
app.use('/pro/luma', authV2, lumaProxy)

// 代理 viggle 文件
app.use('/viggle/asset', authV2, upload2.single('file'), viggleProxyFileDo)
app.use('/pro/viggle/asset', authV2, upload2.single('file'), viggleProxyFileDo)
// 代理 viggle
app.use('/viggle', authV2, viggleProxy)
app.use('/pro/viggle', authV2, viggleProxy)

app.use('/runwayml', authV2, runwaymlProxy)
app.use('/runway', authV2, runwayProxy)
app.use('/kling', authV2, klingProxy)

app.use('/ideogram/remix', authV2, upload2.single('image_file'), ideoProxyFileDo)
app.use('/ideogram', authV2, ideoProxy)
app.use('/pika', authV2, pikaProxy)
app.use('/udio', authV2, udioProxy)

app.use('/pixverse', authV2, pixverseProxy)

// 代理vidu 接口
// 开发环境临时端点 - 检测开发环境的多种方式
const hasViduConfig = isNotEmptyString(process.env.VIDU_KEY) && isNotEmptyString(process.env.VIDU_SERVER)
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV !== 'production'
console.log('VIDU配置检查:', {
  VIDU_KEY: !!process.env.VIDU_KEY,
  VIDU_SERVER: !!process.env.VIDU_SERVER,
  NODE_ENV: process.env.NODE_ENV,
  hasViduConfig,
  isDev,
  willUseMockAPI: isDev // 开发环境始终使用mock API
})

// 开发环境任务状态存储
const devTasks = new Map()

// 改为强制使用生产环境API，不再使用mock数据
if (false) {
  console.log('🔧 Adding development Vidu endpoints (no production config found)...')

  // 创建任务端点
  app.post('/vidu/tasks', authV2, (req, res) => {
    console.log('📝 Vidu API请求:', req.body)
    const taskId = `vidu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // 存储任务信息，模拟异步处理
    const task = {
      task_id: taskId,
      state: 'created',
      model: req.body.model || 'viduq1',
      prompt: req.body.prompt,
      duration: req.body.duration || 5,
      aspect_ratio: req.body.aspect_ratio || '16:9',
      resolution: req.body.resolution || '1080p',
      created_at: new Date().toISOString(),
      creations: []
    }
    
    devTasks.set(taskId, task)
    
    // 模拟任务状态变化：created -> queueing -> processing -> success
    setTimeout(() => {
      if (devTasks.has(taskId)) {
        devTasks.get(taskId).state = 'queueing'
      }
    }, 1000)
    
    setTimeout(() => {
      if (devTasks.has(taskId)) {
        devTasks.get(taskId).state = 'processing'
      }
    }, 3000)
    
    setTimeout(() => {
      if (devTasks.has(taskId)) {
        const task = devTasks.get(taskId)
        task.state = 'success'
        // 模拟生成的视频结果
        task.creations = [{
          id: `creation-${Date.now()}`,
          url: 'https://vjs.zencdn.net/v/oceans.mp4', // 使用公开的测试视频
          cover_url: 'https://vjs.zencdn.net/poster.jpg'
        }]
      }
    }, 10000) // 10秒后完成
    
    // 返回与vidu官方API完全一致的响应格式
    res.json({
      task_id: taskId,
      state: 'created',
      model: task.model,
      prompt: task.prompt,
      images: req.body.images || [],
      duration: task.duration,
      seed: req.body.seed || 0,
      aspect_ratio: task.aspect_ratio,
      resolution: task.resolution,
      movement_amplitude: req.body.movement_amplitude || 'auto',
      bgm: req.body.bgm || false,
      off_peak: req.body.off_peak || false,
      credits: 1,
      created_at: task.created_at
    })
  })

  // 查询任务状态端点
  app.get('/vidu/tasks/:taskId/creations', authV2, (req, res) => {
    const { taskId } = req.params
    console.log('🔍 查询任务状态:', taskId)

    const task = devTasks.get(taskId)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    // 返回与vidu官方API完全一致的查询响应格式
    res.json({
      id: taskId, // 官方API使用id而不是task_id
      state: task.state,
      err_code: task.state === 'failed' ? 'InternalServiceFailure' : '',
      credits: 1,
      payload: '',
      creations: task.creations || []
    })
  })

  // 取消任务端点
  app.post('/vidu/tasks/:taskId/cancel', authV2, (req, res) => {
    const { taskId } = req.params
    console.log('❌ 取消任务:', taskId)
    
    const task = devTasks.get(taskId)
    if (task) {
      task.state = 'failed'
      task.err_code = 'UserCancelled'
    }
    
    res.json({
      task_id: taskId,
      state: 'failed',
      err_code: 'UserCancelled'
    })
  })
}
else {
  console.log('🚀 Using production Vidu configuration')
}

// 图片代理端点，解决CORS问题
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    // 安全性：只允许特定域名的图片
    const allowedDomains = [
      'mj-oss.oss-cn-shanghai.aliyuncs.com',
      'mj-sh.oss-cn-shanghai.aliyuncs.com',  // 添加实际使用的域名
      'cdn.discordapp.com',
      // 可以添加更多信任的域名
    ]

    const imageUrl = decodeURIComponent(url as string)
    const urlObj = new URL(imageUrl)

    if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
      return res.status(403).json({ error: 'Domain not allowed' })
    }

    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000, // 生产环境增加超时时间
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': urlObj.origin
      }
    })

    // 设置正确的响应头
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24小时缓存
    res.setHeader('Content-Length', response.headers['content-length'] || '')

    // 流式传输图片
    response.data.pipe(res)

    // 处理流错误
    response.data.on('error', (err: any) => {
      console.error('图片流错误:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' })
      }
    })

  } catch (error) {
    console.error('图片代理错误:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy image' })
    }
  }
})

// 临时禁用认证进行调试
app.use('/vidu', viduProxy)
app.use('/pro/vidu', viduProxy)

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
