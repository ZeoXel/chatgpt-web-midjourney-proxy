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
import { ideoProxy, ideoProxyFileDo, klingProxy, lumaProxy, pikaProxy, pixverseProxy, runwayProxy, runwaymlProxy, sunoProxy, udioProxy, viggleProxy, viggleProxyFileDo } from './myfun'
import assetsRouter from './api/assets'

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
    const uploadImgSize = process.env.UPLOAD_IMG_SIZE ?? '15'
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

// NewAPI 网关格式的 Vidu 端点 - 使用统一的OPENAI_API_KEY
app.post('/v1/video/generations', authV2, async (req, res) => {
  console.log('🎬 NewAPI Vidu 视频生成请求:')
  console.log('Headers:', req.headers)
  console.log('Body:', JSON.stringify(req.body, null, 2))

  try {
    // NewAPI网关：使用统一的核心API密钥，无需专用VIDU配置
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'

    if (!apiKey) {
      return res.status(500).json({
        error: {
          code: 'configuration_error',
          message: 'OPENAI_API_KEY must be configured'
        }
      })
    }

    const response = await fetch(`${gatewayServer}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    })

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return res.status(response.status).json(data)
    } else {
      const text = await response.text()
      return res.status(response.status).json({
        error: { code: 'invalid_response', message: `Non-JSON response: ${text}` }
      })
    }
  } catch (error) {
    console.error('NewAPI Vidu generation error:', error)
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: error.message || 'Internal server error'
      }
    })
  }
})

app.get('/v1/video/generations/:id', authV2, async (req, res) => {
  const { id } = req.params
  console.log('🔍 NewAPI查询视频状态:', id)

  try {
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'

    if (!apiKey) {
      return res.status(500).json({
        error: {
          code: 'configuration_error',
          message: 'OPENAI_API_KEY must be configured'
        }
      })
    }

    const response = await fetch(`${gatewayServer}/v1/video/generations/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return res.status(response.status).json(data)
    } else {
      const text = await response.text()
      return res.status(response.status).json({
        error: { code: 'invalid_response', message: `Non-JSON response: ${text}` }
      })
    }
  } catch (error) {
    console.error('NewAPI Vidu query error:', error)
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: error.message || 'Internal server error'
      }
    })
  }
})

// 注意：旧的Vidu代理已移除，现在使用NewAPI格式 /v1/video/generations

// Coze Workflow 异步执行端点 - 转发到网关
app.post('/workflows/:workflowId/run-async', authV2, async (req, res) => {
  const { workflowId } = req.params
  console.log('🔄 Coze Workflow异步执行请求:', workflowId)
  console.log('请求体:', JSON.stringify(req.body, null, 2))

  try {
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'http://localhost:3000'

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY未配置'
      })
    }

    // 处理图片路径：将相对路径转换为完整URL
    let parameters = req.body.parameters || { input: req.body.input || '' }
    if (parameters.image && parameters.image.startsWith('/')) {
      // 本地开发：使用内网穿透URL（ngrok/cloudflare tunnel等）
      // 生产环境：使用实际的公网域名
      const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
      parameters = {
        ...parameters,
        image: `${publicUrl}${parameters.image}`
      }
      console.log('图片相对路径已转换为完整URL:', parameters.image)
    }

    // 转换为网关格式
    const gatewayRequest = {
      model: 'coze-workflow-async',  // 使用异步模型
      stream: false,
      messages: req.body.messages || [{ role: 'user', content: req.body.input || '' }],
      workflow_id: workflowId,
      workflow_parameters: parameters
    }

    console.log('转发到网关:', `${gatewayServer}/v1/chat/completions`)
    console.log('网关请求体:', JSON.stringify(gatewayRequest, null, 2))

    const response = await axios.post(
      `${gatewayServer}/v1/chat/completions`,
      gatewayRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    // 转换网关响应为前端期望的格式
    const gatewayResponse = response.data
    return res.json({
      success: true,
      message: gatewayResponse.message || '工作流已开始异步执行',
      workflowId: workflowId,
      executeId: gatewayResponse.execute_id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Coze Workflow异步执行错误:', error.response?.data || error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    })
  }
})

// Coze Workflow 同步执行端点 - 转发到网关
app.post('/workflows/:workflowId/run', authV2, async (req, res) => {
  const { workflowId } = req.params
  console.log('🔄 Coze Workflow同步执行请求:', workflowId)

  try {
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'http://localhost:3000'

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY未配置'
      })
    }

    // 处理图片路径：将相对路径转换为完整URL
    let parameters = req.body.parameters || { input: req.body.input || '' }
    if (parameters.image && parameters.image.startsWith('/')) {
      // 本地开发：使用内网穿透URL（ngrok/cloudflare tunnel等）
      // 生产环境：使用实际的公网域名
      const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`
      parameters = {
        ...parameters,
        image: `${publicUrl}${parameters.image}`
      }
      console.log('图片相对路径已转换为完整URL:', parameters.image)
    }

    // 转换为网关格式
    const gatewayRequest = {
      model: 'coze-workflow',  // 使用同步流式模型
      stream: true,
      messages: req.body.messages || [{ role: 'user', content: req.body.input || '' }],
      workflow_id: workflowId,
      workflow_parameters: parameters
    }

    // 流式转发
    const response = await axios.post(
      `${gatewayServer}/v1/chat/completions`,
      gatewayRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        responseType: 'stream'
      }
    )

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    response.data.pipe(res)
  } catch (error) {
    console.error('Coze Workflow同步执行错误:', error.response?.data || error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    })
  }
})

// Coze Workflow 执行结果查询端点（标准格式）
app.get('/workflows/executions/:executeId', authV2, async (req, res) => {
  const { executeId } = req.params
  console.log('🔍 查询Workflow执行结果:', executeId)

  try {
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'http://localhost:3000'

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY未配置'
      })
    }

    const response = await axios.get(
      `${gatewayServer}/v1/workflows/executions/${executeId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    res.json(response.data)
  } catch (error) {
    console.error('查询执行结果错误:', error.response?.data || error.message)
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    })
  }
})

// Coze Workflow 执行结果查询端点（兼容前端history格式）
app.get('/workflows/:workflowId/history/:executeId', authV2, async (req, res) => {
  const { workflowId, executeId } = req.params
  console.log('🔍 查询Workflow历史记录:', { workflowId, executeId })

  try {
    const apiKey = process.env.OPENAI_API_KEY
    const gatewayServer = process.env.OPENAI_API_BASE_URL || 'http://localhost:3000'

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY未配置'
      })
    }

    const response = await axios.get(
      `${gatewayServer}/v1/workflows/executions/${executeId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    // 转换为前端期望的格式
    const result = response.data
    res.json({
      success: true,
      data: {
        executeId: result.execute_id,
        workflowId: result.workflow_id || workflowId,
        status: result.status,
        progress: result.progress,
        output: result.output,
        error: result.error,
        usage: result.usage,
        submitTime: result.submit_time,
        startTime: result.start_time,
        finishTime: result.finish_time
      }
    })
  } catch (error) {
    console.error('查询历史记录错误:', error.response?.data || error.message)

    // 如果是404错误，返回友好的错误信息
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: '执行记录不存在或接口不存在'
      })
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    })
  }
})

app.use('', router)
app.use('/api', router)

// AI资产存储API
app.use('/api/assets', assetsRouter)

app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
