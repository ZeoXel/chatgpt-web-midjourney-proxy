const axios = require('axios');

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

module.exports = async (req, res) => {
    // 只处理GET请求
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // 核心密钥验证
    const authResult = validateCoreAuth(req, res);
    if (!authResult.valid) {
        console.log('❌ 图片代理核心密钥验证失败:', authResult.error.message);
        res.status(authResult.error.status);
        return res.json({
            code: authResult.error.code,
            message: authResult.error.message,
            data: null
        });
    }

    try {
        const { url } = req.query;

        if (!url) {
            res.status(400).json({ error: 'URL parameter is required' });
            return;
        }

        console.log('🖼️ Vercel图片代理请求:', url);

        // 安全性：只允许特定域名的图片
        const allowedDomains = [
            'mj-oss.oss-cn-shanghai.aliyuncs.com',
            'cdn.discordapp.com',
            'attachments.discord.com',
            // 可以添加更多信任的域名
        ];

        const imageUrl = decodeURIComponent(url);
        let urlObj;

        try {
            urlObj = new URL(imageUrl);
        } catch (e) {
            res.status(400).json({ error: 'Invalid URL format' });
            return;
        }

        const isAllowed = allowedDomains.some(domain =>
            urlObj.hostname.includes(domain) || urlObj.hostname.endsWith(domain)
        );

        if (!isAllowed) {
            console.log('❌ 域名不在允许列表:', urlObj.hostname);
            res.status(403).json({ error: 'Domain not allowed' });
            return;
        }

        // 请求图片
        const response = await axios.get(imageUrl, {
            responseType: 'stream',
            timeout: 25000, // Vercel有30秒限制，留5秒缓冲
            maxRedirects: 3,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': urlObj.origin,
                'Accept': 'image/*,*/*;q=0.8'
            }
        });

        // 设置响应头
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const contentLength = response.headers['content-length'];

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24小时缓存

        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // 流式传输图片
        response.data.pipe(res);

        // 处理流错误
        response.data.on('error', (err) => {
            console.error('🖼️ 图片流错误:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error' });
            }
        });

        // 成功日志
        response.data.on('end', () => {
            console.log('✅ 图片代理成功:', urlObj.hostname);
        });

    } catch (error) {
        console.error('🖼️ 图片代理错误:', error.message);

        if (!res.headersSent) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                res.status(504).json({ error: 'Request timeout' });
            } else if (error.response?.status) {
                res.status(error.response.status).json({ error: 'Upstream error' });
            } else {
                res.status(500).json({ error: 'Failed to proxy image' });
            }
        }
    }
};