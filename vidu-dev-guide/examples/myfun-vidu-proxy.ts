import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { isNotEmptyString } from '../utils/is';
import FormData from 'form-data'
import proxy from "express-http-proxy"
import pkg from '../package.json'

const API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
    ? process.env.OPENAI_API_BASE_URL
    : 'https://api.openai.com'

/**
 * Vidu API 基础代理配置
 * 用于处理标准的 API 请求转发
 */
export const viduProxy = proxy(process.env.VIDU_SERVER ?? API_BASE_URL, {
    https: false, 
    limit: '10mb',
    
    /**
     * URL 路径解析器
     * 将前端请求路径映射到实际的 API 路径
     */
    proxyReqPathResolver: function (req) {
        let url = req.originalUrl;
        let server = process.env.VIDU_SERVER ?? API_BASE_URL
        
        // 处理官方服务器路径映射
        if (server.indexOf('vidu.com') > -1) {
            // 如果是官方 Vidu 服务器，移除路径前缀
            url = req.originalUrl.replace('/vidu', '')
        }
        
        return url
    },
    
    /**
     * 请求选项装饰器
     * 设置认证头部和其他必要的请求头
     */
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
        // 设置认证头部
        if (process.env.VIDU_KEY) {
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_KEY;
        } else {
            // 后备认证方案
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;  
        }
        
        // 设置标准头部
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        proxyReqOpts.headers['Mj-Version'] = pkg.version;
        
        // 设置 Vidu 特定头部（根据 API 文档调整）
        proxyReqOpts.headers['X-Vidu-Version'] = '2024-12-01';
        
        // 设置用户代理
        proxyReqOpts.headers['User-Agent'] = `ChatGPT-Web-Midjourney-Proxy/${pkg.version}`;
        
        return proxyReqOpts;
    },
    
    /**
     * 自定义错误处理
     */
    proxyErrorHandler: function (err, res, next) {
        console.error('Vidu proxy error:', err);
        
        res.status(500).json({
            error: 'Vidu service unavailable',
            message: err.message,
            service: 'vidu'
        });
    },
    
    /**
     * 响应装饰器（可选）
     * 用于处理响应数据或添加日志
     */
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
        // 记录响应日志
        console.log(`Vidu API Response: ${userReq.originalUrl} - ${proxyRes.statusCode}`);
        
        // 可以在这里处理响应数据
        return proxyResData;
    }
});

/**
 * Vidu Pro 版本代理配置（如果支持）
 * 用于处理 Pro 版本的特殊功能
 */
export const viduProProxy = proxy(process.env.VIDU_PRO_SERVER ?? process.env.VIDU_SERVER ?? API_BASE_URL, {
    https: false, 
    limit: '20mb', // Pro 版本可能支持更大文件
    
    proxyReqPathResolver: function (req) {
        let url = req.originalUrl;
        let server = process.env.VIDU_PRO_SERVER ?? process.env.VIDU_SERVER ?? API_BASE_URL
        
        // Pro 版本路径处理
        if (server.indexOf('pro.vidu.com') > -1) {
            url = req.originalUrl.replace('/pro/vidu', '')
        } else {
            // 如果使用统一服务器，保留 pro 路径
            url = req.originalUrl.replace('/pro/vidu', '/pro')
        }
        
        return url
    },
    
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
        // 优先使用 Pro Key
        if (process.env.VIDU_PRO_KEY) {
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_PRO_KEY;
        } else if (process.env.VIDU_KEY) {
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.VIDU_KEY;
        } else {
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;  
        }
        
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        proxyReqOpts.headers['Mj-Version'] = pkg.version;
        proxyReqOpts.headers['X-Vidu-Version'] = '2024-12-01';
        proxyReqOpts.headers['X-Vidu-Tier'] = 'pro'; // 标识 Pro 版本
        
        return proxyReqOpts;
    },
});

/**
 * Vidu 文件上传处理函数
 * 专门处理需要上传文件的请求（如图片转视频）
 */
export const viduProxyFileDo = async (req: Request, res: Response, next?: NextFunction) => { 
    console.log('Vidu file upload request:', req.originalUrl);
    
    let API_BASE_URL = isNotEmptyString(process.env.OPENAI_API_BASE_URL)
        ? process.env.OPENAI_API_BASE_URL
        : 'https://api.openai.com'
    
    API_BASE_URL = process.env.VIDU_SERVER ?? API_BASE_URL
    
    if (req.file?.buffer) {
        const fileBuffer = req.file.buffer;
        const formData = new FormData();
        
        // 添加文件数据
        formData.append('image_file', fileBuffer, { 
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        
        // 添加其他表单字段
        if (req.body.prompt) {
            formData.append('prompt', req.body.prompt);
        }
        
        // 添加生成参数
        if (req.body.duration) {
            formData.append('duration', req.body.duration);
        }
        if (req.body.aspect_ratio) {
            formData.append('aspect_ratio', req.body.aspect_ratio);
        }
        if (req.body.style) {
            formData.append('style', req.body.style);
        }
        if (req.body.motion_strength) {
            formData.append('motion_strength', req.body.motion_strength);
        }
        
        // 其他可选参数
        Object.keys(req.body).forEach(key => {
            if (!['prompt', 'duration', 'aspect_ratio', 'style', 'motion_strength'].includes(key)) {
                if (req.body[key] !== undefined && req.body[key] !== null) {
                    formData.append(key, req.body[key]);
                }
            }
        });
        
        try {
            let url = `${API_BASE_URL}${req.originalUrl}`;
            
            console.log(`Making request to: ${url}`);
            
            let responseBody = await axios.post(url, formData, {
                headers: {
                    Authorization: 'Bearer ' + (process.env.VIDU_KEY ?? process.env.OPENAI_API_KEY),
                    'Content-Type': 'multipart/form-data',
                    'Mj-Version': pkg.version,
                    'X-Vidu-Version': '2024-12-01',
                },
                // 设置超时时间
                timeout: 30000,
                // 设置最大内容长度
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            
            console.log('Vidu API response:', responseBody.status);
            res.json(responseBody.data);
            
        } catch (e) { 
            console.error('Vidu file upload error:', e);
            
            let errorMessage = 'File upload failed';
            let statusCode = 400;
            
            if (axios.isAxiosError(e)) {
                if (e.response) {
                    statusCode = e.response.status;
                    errorMessage = e.response.data?.error?.message || e.response.statusText;
                } else if (e.request) {
                    statusCode = 500;
                    errorMessage = 'Network error';
                } else {
                    statusCode = 500;
                    errorMessage = e.message;
                }
            }
            
            res.status(statusCode).json({ 
                error: errorMessage,
                service: 'vidu',
                operation: 'file_upload'
            });
        }

    } else {
        res.status(400).json({
            error: 'No file uploaded or file upload failed',
            service: 'vidu'
        });
    }
}

/**
 * Vidu 批量文件上传处理函数
 * 用于处理多个文件上传的情况
 */
export const viduBatchFileDo = async (req: Request, res: Response, next?: NextFunction) => {
    console.log('Vidu batch file upload request:', req.originalUrl);
    
    let API_BASE_URL = process.env.VIDU_SERVER ?? (
        isNotEmptyString(process.env.OPENAI_API_BASE_URL)
            ? process.env.OPENAI_API_BASE_URL
            : 'https://api.openai.com'
    );
    
    // 检查是否有文件上传
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        return res.status(400).json({
            error: 'No files uploaded',
            service: 'vidu'
        });
    }
    
    const formData = new FormData();
    
    // 添加所有文件
    files.forEach((file, index) => {
        formData.append(`file_${index}`, file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        });
    });
    
    // 添加其他表单数据
    Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined && req.body[key] !== null) {
            formData.append(key, req.body[key]);
        }
    });
    
    try {
        let url = `${API_BASE_URL}${req.originalUrl}`;
        
        let responseBody = await axios.post(url, formData, {
            headers: {
                Authorization: 'Bearer ' + (process.env.VIDU_KEY ?? process.env.OPENAI_API_KEY),
                'Content-Type': 'multipart/form-data',
                'Mj-Version': pkg.version,
                'X-Vidu-Version': '2024-12-01',
            },
            timeout: 60000, // 批量上传可能需要更长时间
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        res.json(responseBody.data);
        
    } catch (e) {
        console.error('Vidu batch upload error:', e);
        
        let errorMessage = 'Batch upload failed';
        let statusCode = 400;
        
        if (axios.isAxiosError(e)) {
            if (e.response) {
                statusCode = e.response.status;
                errorMessage = e.response.data?.error?.message || e.response.statusText;
            } else {
                statusCode = 500;
                errorMessage = 'Network error';
            }
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            service: 'vidu',
            operation: 'batch_upload'
        });
    }
}

/**
 * Vidu 健康检查函数
 * 用于检查服务是否可用
 */
export const viduHealthCheck = async (req: Request, res: Response) => {
    try {
        const viduServerAvailable = !!process.env.VIDU_SERVER && !!process.env.VIDU_KEY;
        const viduProAvailable = !!process.env.VIDU_PRO_SERVER && !!process.env.VIDU_PRO_KEY;
        
        // 可以添加实际的 API 连通性测试
        // const testResult = await axios.get(`${process.env.VIDU_SERVER}/health`);
        
        res.json({
            service: 'vidu',
            status: viduServerAvailable ? 'available' : 'unavailable',
            config: {
                hasServer: !!process.env.VIDU_SERVER,
                hasKey: !!process.env.VIDU_KEY,
                hasPro: viduProAvailable,
                version: pkg.version
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            service: 'vidu',
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 请求日志中间件
 * 用于记录 Vidu API 的请求日志
 */
export const viduRequestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // 记录请求信息
    console.log(`[Vidu] ${req.method} ${req.originalUrl} - Start`);
    
    // 监听响应结束事件
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[Vidu] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
}