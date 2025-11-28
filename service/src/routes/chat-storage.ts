/**
 * COS对话历史存储API路由
 *
 * 端点:
 * - POST   /api/chat-storage/:uuid      保存对话历史
 * - GET    /api/chat-storage/:uuid      加载对话历史
 * - DELETE /api/chat-storage/:uuid      删除对话历史
 * - GET    /api/chat-storage/:uuid/stats  获取统计信息
 */

import { Router, Request, Response } from 'express';
import { ChatStorageService } from '../storage/chat-storage';

const router = Router();
const chatStorage = new ChatStorageService();

/**
 * 健康检查
 * GET /api/chat-storage/health
 *
 * 统一返回格式为 { status, message, data }
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'Success',
    success: true,
    message: 'COS Chat Storage API is running',
    data: {
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * UUID验证中间件
 */
function validateUuid(req: Request, res: Response, next: any) {
  const { uuid } = req.params;

  if (!uuid || uuid.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'UUID参数缺失'
    });
  }

  // UUID格式验证 (标准UUID格式)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return res.status(400).json({
      success: false,
      error: 'UUID格式无效'
    });
  }

  next();
}

/**
 * 保存对话历史
 * POST /api/chat-storage/:uuid
 *
 * Body: ChatState
 * {
 *   active: number | null,
 *   usingContext: boolean,
 *   history: Array<{uuid, title, isEdit}>,
 *   chat: Array<{uuid, data: Chat[]}>
 * }
 */
router.post('/:uuid', validateUuid, async (req: any, res: Response) => {
  try {
    const { uuid } = req.params;
    const state = req.body;

    // 验证请求体
    if (!state || typeof state !== 'object') {
      return res.status(400).json({
        success: false,
        error: '请求体格式错误'
      });
    }

    if (!Array.isArray(state.history) || !Array.isArray(state.chat)) {
      return res.status(400).json({
        success: false,
        error: 'ChatState格式错误: history和chat必须是数组'
      });
    }

    console.log(`[Chat Storage API] 保存请求: UUID=${uuid}, 对话数=${state.history.length}`);

    // 保存到COS
    const url = await chatStorage.saveConversations(uuid, state);

    // 与前端通用接口保持一致: { status, message, data }
    res.json({
      status: 'Success',
      success: true,
      message: '对话历史保存成功',
      data: {
        url,
        stats: {
          conversationCount: state.history.length,
          messageCount: state.chat.reduce((sum: number, c: any) => sum + c.data.length, 0)
        }
      }
    });

  } catch (error: any) {
    console.error('[Chat Storage API] 保存失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '对话历史保存失败'
    });
  }
});

/**
 * 加载对话历史
 * GET /api/chat-storage/:uuid
 *
 * Response: ChatState
 */
router.get('/:uuid', validateUuid, async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    console.log(`[Chat Storage API] 加载请求: UUID=${uuid}`);

    // 从COS加载
    const state = await chatStorage.loadConversations(uuid);

    if (!state) {
      return res.status(404).json({
        status: 'Fail',
        success: false,
        message: '对话历史不存在',
        data: null
      });
    }

    res.json({
      status: 'Success',
      success: true,
      message: '对话历史加载成功',
      data: state,
      stats: {
        conversationCount: state.history.length,
        messageCount: state.chat.reduce((sum, c) => sum + c.data.length, 0)
      }
    });

  } catch (error: any) {
    console.error('[Chat Storage API] 加载失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '对话历史加载失败'
    });
  }
});

/**
 * 删除对话历史
 * DELETE /api/chat-storage/:uuid
 */
router.delete('/:uuid', validateUuid, async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    console.log(`[Chat Storage API] 删除请求: UUID=${uuid}`);

    await chatStorage.deleteConversations(uuid);

    res.json({
      status: 'Success',
      success: true,
      message: '对话历史已删除',
      data: null
    });

  } catch (error: any) {
    console.error('[Chat Storage API] 删除失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '对话历史删除失败'
    });
  }
});

/**
 * 获取对话历史统计信息
 * GET /api/chat-storage/:uuid/stats
 */
router.get('/:uuid/stats', validateUuid, async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    console.log(`[Chat Storage API] 统计请求: UUID=${uuid}`);

    const stats = await chatStorage.getConversationStats(uuid);

    res.json({
      status: 'Success',
      success: true,
      message: '获取统计信息成功',
      data: stats
    });

  } catch (error: any) {
    console.error('[Chat Storage API] 统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    });
  }
});

export default router;
