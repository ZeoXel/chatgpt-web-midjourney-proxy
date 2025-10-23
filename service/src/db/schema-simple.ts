/**
 * 简化版数据库Schema - 仅用于多平台数据同步
 * 文件存储继续使用Cloudflare R2，数据库只存URL引用
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * 表1: 聊天会话表
 * 存储用户的所有对话会话
 */
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(), // 对应你的用户系统API Key
  title: varchar('title', { length: 500 }).default('新对话'),

  // 会话数据（直接存JSON，兼容现有localStorage结构）
  messages: jsonb('messages').notNull().default([]), // 消息数组

  // 元数据
  model: varchar('model', { length: 50 }),
  usingContext: jsonb('using_context').default(true),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_id').on(table.userId),
  updatedAtIdx: index('idx_updated_at').on(table.updatedAt),
}));

/**
 * 表2: AI生成内容表（通用）
 * 统一存储Midjourney/Suno/Luma/Vidu等所有AI生成内容
 */
export const aiAssets = pgTable('ai_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // 内容分类
  service: varchar('service', { length: 50 }).notNull(), // 'midjourney', 'suno', 'luma', 'vidu'等
  type: varchar('type', { length: 20 }).notNull(),       // 'image', 'audio', 'video'

  // 核心数据（完全兼容现有Store结构）
  assetData: jsonb('asset_data').notNull(), // 直接存储现有的对象结构
  /*
   * 示例 - Suno:
   * {
   *   id: "xxx",
   *   audio_url: "https://...",
   *   video_url: "https://...",
   *   image_url: "https://...",
   *   metadata: { prompt, tags, duration, ... }
   * }
   *
   * 示例 - Luma:
   * {
   *   id: "xxx",
   *   video: { url: "https://...", width, height },
   *   state: "completed",
   *   metadata: { ... }
   * }
   */

  // 快速检索字段（冗余存储，提升查询性能）
  taskId: varchar('task_id', { length: 255 }), // 第三方任务ID
  mainUrl: varchar('main_url', { length: 1024 }), // 主要资源URL
  prompt: text('prompt'),                      // 提示词

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userServiceIdx: index('idx_user_service').on(table.userId, table.service),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
  taskIdIdx: index('idx_task_id').on(table.taskId),
}));

/**
 * 表3: 用户配置表
 * 存储用户的所有偏好设置
 */
export const userConfigs = pgTable('user_configs', {
  userId: varchar('user_id', { length: 255 }).primaryKey(), // 对应API Key

  // 直接存储整个配置对象（兼容现有localStorage结构）
  gptConfig: jsonb('gpt_config'),      // gptConfigStore
  serverConfig: jsonb('server_config'), // gptServerStore
  uiSettings: jsonb('ui_settings'),    // app-store (主题、语言等)

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * TypeScript类型定义
 */
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export type AiAsset = typeof aiAssets.$inferSelect;
export type NewAiAsset = typeof aiAssets.$inferInsert;

export type UserConfig = typeof userConfigs.$inferSelect;
export type NewUserConfig = typeof userConfigs.$inferInsert;
