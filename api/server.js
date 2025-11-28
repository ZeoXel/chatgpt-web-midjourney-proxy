// Vercel Serverless Function入口
// 将整个Express应用包装为Vercel Serverless Function

const app = require('../service/dist/index.js').default

// Vercel会调用这个导出的函数处理所有请求
module.exports = app
