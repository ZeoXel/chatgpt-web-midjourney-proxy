// Vercel Serverless Function入口
// 将整个Express应用包装为Vercel Serverless Function

// 使用异步导入ESM模块
let app = null

const getApp = async () => {
  if (!app) {
    const module = await import('../service/build/index.mjs')
    app = module.default
  }
  return app
}

module.exports = async (req, res) => {
  const expressApp = await getApp()
  return expressApp(req, res)
}
