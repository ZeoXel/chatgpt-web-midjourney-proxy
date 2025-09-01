const {
    createProxyMiddleware
} = require('http-proxy-middleware')

// 核心密钥验证函数 - 与 authV2 中间件逻辑保持一致
function validateCoreAuth(req, res) {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY;
    
    if (!AUTH_SECRET_KEY || AUTH_SECRET_KEY.trim() === '') {
        // 未配置核心密钥，允许通过
        return { valid: true };
    }
    
    const auth_secret_keys = AUTH_SECRET_KEY.trim().split(',').filter(item => item !== '');
    const Authorization = req.headers['x-ptoken'];
    
    if (!Authorization || !auth_secret_keys.includes(Authorization.trim())) {
        return {
            valid: false,
            error: {
                status: 423,
                code: 'token_check',
                message: 'Error: 无访问权限 | No access rights'
            }
        };
    }
    
    return { valid: true };
}

module.exports = (req, res) => {
    let target = ''
    let headers = {}
    let pathRewrite = {}
    
    console.log('🔍 Vercel代理请求:', req.method, req.url)
    
    // 统一的核心密钥验证
    const authResult = validateCoreAuth(req, res);
    if (!authResult.valid) {
        console.log('❌ 核心密钥验证失败:', authResult.error.message);
        res.status(authResult.error.status);
        return res.json({
            code: authResult.error.code,
            message: authResult.error.message,
            data: null
        });
    }
    
    // 代理目标地址配置
    if (req.url.startsWith('/mjapi')) {
        target = process.env.MJ_SERVER ?? 'https://api.openai.com';
        headers = {
            'Mj-Api-Secret': process.env.MJ_API_SECRET
        }
        pathRewrite = { '^/mjapi/': '/' }
    }
    else if (req.url.startsWith('/openapi')) {
        target = process.env.OPENAI_API_BASE_URL ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
        }
        pathRewrite = { '^/openapi/': '/' }
    }
    else if (req.url.startsWith('/sunoapi')) {
        target = process.env.SUNO_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.SUNO_KEY || process.env.OPENAI_API_KEY)
        }
        pathRewrite = { '^/sunoapi/': '/' }
    }
    else if (req.url.startsWith('/luma')) {
        target = process.env.LUMA_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.LUMA_KEY || process.env.OPENAI_API_KEY)
        }
        // Luma 不需要路径重写，保持原始路径
    }
    else if (req.url.startsWith('/vidu')) {
        target = process.env.VIDU_SERVER ?? 'https://api.vidu.cn';
        headers = {}
        
        // Vidu API 使用 Token 认证，不是 Bearer
        if (process.env.VIDU_KEY) {
            headers['Authorization'] = 'Token ' + process.env.VIDU_KEY
        }
        
        // Vidu 路径映射逻辑 - 与后端 viduProxy 保持一致
        if (req.url.includes('/vidu/tasks') && req.method === 'POST') {
            pathRewrite = { '^/vidu/tasks': '/ent/v2/reference2video' }
        }
        else if (req.url.includes('/vidu/tasks/') && req.url.includes('/creations')) {
            const taskId = req.url.match(/\/vidu\/tasks\/([^\/]+)\/creations/)?.[1]
            if (taskId) {
                pathRewrite = { [`^/vidu/tasks/${taskId}/creations`]: `/ent/v2/tasks/${taskId}/creations` }
            }
        }
        else if (req.url.includes('/vidu/tasks/') && req.url.includes('/cancel')) {
            const taskId = req.url.match(/\/vidu\/tasks\/([^\/]+)\/cancel/)?.[1]
            if (taskId) {
                pathRewrite = { [`^/vidu/tasks/${taskId}/cancel`]: `/ent/v2/tasks/${taskId}/cancel` }
            }
        }
        else {
            // 默认映射
            pathRewrite = { '^/vidu': '/ent/v2' }
        }
    }
    else if (req.url.startsWith('/viggle')) {
        target = process.env.VIGGLE_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.VIGGLE_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/runwayml')) {
        target = process.env.RUNWAYML_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.RUNWAYML_KEY || process.env.OPENAI_API_KEY),
            'X-Runway-Version': '2024-11-06'
        }
        // RunwayML 特殊路径处理
        if (target.includes('runwayml.com')) {
            pathRewrite = { '^/runwayml': '' }
        }
    }
    else if (req.url.startsWith('/runway')) {
        target = process.env.RUNWAY_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.RUNWAY_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/kling')) {
        target = process.env.KLING_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.KLING_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/ideogram')) {
        target = process.env.IDEOGRAM_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.IDEOGRAM_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/pika')) {
        target = process.env.PIKA_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.PIKA_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/udio')) {
        target = process.env.UDIO_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.UDIO_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else if (req.url.startsWith('/pixverse')) {
        target = process.env.PIXVERSE_SERVER ?? 'https://api.openai.com';
        headers = {
            'Authorization': 'Bearer ' + (process.env.PIXVERSE_KEY || process.env.OPENAI_API_KEY)
        }
    }
    else {
        console.log('❌ 未知的API路径:', req.url)
        return res.status(404).json({ error: 'API路径不支持' })
    }

    console.log('🎯 代理目标:', target)
    console.log('🔀 路径重写:', pathRewrite)

    // 创建代理对象并转发请求
    createProxyMiddleware({
        target,
        changeOrigin: true,
        headers,
        pathRewrite,
        onError: (err, req, res) => {
            console.error('代理错误:', err.message)
            res.status(500).json({ error: '代理请求失败', details: err.message })
        }
    })(req, res)
}
