/**
 * 视频数据迁移工具
 * 将旧的独立Store数据迁移到统一Store
 */

import { UnifiedVideoStore } from '@/api/videoStore';
import { ViduStore } from '@/api/viduStore';
import { runwayStore } from '@/api/runwayStore';
import { pikaStore } from '@/api/pikaStore';
import { klingStore } from '@/api/klingStore';
import {
  convertViduToUnified,
  convertRunwayToUnified,
  convertPikaToUnified,
  convertKlingToUnified
} from '@/api/videoAdapter';
import { mlog } from '@/api';

/**
 * 一次性迁移所有旧视频数据到统一Store
 */
export function migrateOldVideoData() {
  console.log('🔄 开始迁移旧视频数据到统一Store...');

  const unified = new UnifiedVideoStore();
  let totalMigrated = 0;
  let errors: string[] = [];

  try {
    // 1. 迁移Vidu数据
    try {
      const viduTasks = new ViduStore().getObjs();
      mlog(`📦 发现 ${viduTasks.length} 个Vidu任务`);

      viduTasks.forEach(task => {
        try {
          unified.save(convertViduToUnified(task));
          totalMigrated++;
        } catch (error) {
          errors.push(`Vidu任务 ${task.task_id} 迁移失败: ${error}`);
        }
      });
    } catch (error) {
      console.error('❌ Vidu数据迁移失败:', error);
      errors.push(`Vidu整体迁移失败: ${error}`);
    }

    // 2. 迁移Runway数据
    try {
      const runwayTasks = new runwayStore().getObjs();
      mlog(`📦 发现 ${runwayTasks.length} 个Runway任务`);

      runwayTasks.forEach(task => {
        try {
          unified.save(convertRunwayToUnified(task));
          totalMigrated++;
        } catch (error) {
          errors.push(`Runway任务 ${task.id} 迁移失败: ${error}`);
        }
      });
    } catch (error) {
      console.error('❌ Runway数据迁移失败:', error);
      errors.push(`Runway整体迁移失败: ${error}`);
    }

    // 3. 迁移Pika数据
    try {
      const pikaTasks = new pikaStore().getObjs();
      mlog(`📦 发现 ${pikaTasks.length} 个Pika任务`);

      pikaTasks.forEach(task => {
        try {
          unified.save(convertPikaToUnified(task));
          totalMigrated++;
        } catch (error) {
          errors.push(`Pika任务 ${task.id} 迁移失败: ${error}`);
        }
      });
    } catch (error) {
      console.error('❌ Pika数据迁移失败:', error);
      errors.push(`Pika整体迁移失败: ${error}`);
    }

    // 4. 迁移Kling数据
    try {
      const klingTasks = new klingStore().getObjs();
      mlog(`📦 发现 ${klingTasks.length} 个Kling任务`);

      klingTasks.forEach(task => {
        try {
          unified.save(convertKlingToUnified(task));
          totalMigrated++;
        } catch (error) {
          errors.push(`Kling任务 ${task.data.task_id} 迁移失败: ${error}`);
        }
      });
    } catch (error) {
      console.error('❌ Kling数据迁移失败:', error);
      errors.push(`Kling整体迁移失败: ${error}`);
    }

    // 5. 输出迁移统计
    console.log(`✅ 迁移完成: ${totalMigrated} 个任务`);
    console.log('📊 统一Store统计:', unified.getStats());

    if (errors.length > 0) {
      console.warn(`⚠️ 迁移过程中遇到 ${errors.length} 个错误:`);
      errors.forEach(err => console.warn(`  - ${err}`));
    }

    // 6. 标记已迁移,避免重复执行
    localStorage.setItem('video-migrated', 'true');
    localStorage.setItem('video-migrated-time', new Date().toISOString());
    localStorage.setItem('video-migrated-count', totalMigrated.toString());

    return {
      success: true,
      totalMigrated,
      errors
    };
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    return {
      success: false,
      totalMigrated,
      errors: [...errors, `致命错误: ${error}`]
    };
  }
}

/**
 * 检查是否需要迁移
 * @returns {boolean} true=需要迁移, false=已迁移过
 */
export function checkNeedMigration(): boolean {
  const migrated = localStorage.getItem('video-migrated');
  return !migrated;
}

/**
 * 检查并执行迁移
 * 应用启动时调用一次
 */
export function checkAndMigrate() {
  if (checkNeedMigration()) {
    mlog('🎬 检测到旧数据,开始自动迁移...');
    const result = migrateOldVideoData();

    if (result.success) {
      mlog(`✅ 数据迁移完成: ${result.totalMigrated} 个任务已迁移`);
    } else {
      mlog('❌ 数据迁移失败,请检查控制台日志');
    }

    return result;
  } else {
    const migratedTime = localStorage.getItem('video-migrated-time');
    const migratedCount = localStorage.getItem('video-migrated-count');
    mlog(`✅ 数据已迁移 (时间: ${migratedTime}, 任务数: ${migratedCount})`);
    return null;
  }
}

/**
 * 重置迁移标记,强制重新迁移
 * 仅用于调试或数据修复
 */
export function resetMigrationFlag() {
  localStorage.removeItem('video-migrated');
  localStorage.removeItem('video-migrated-time');
  localStorage.removeItem('video-migrated-count');
  console.log('🔄 迁移标记已重置,下次刷新将重新迁移数据');
}

/**
 * 获取迁移状态
 */
export function getMigrationStatus() {
  const migrated = localStorage.getItem('video-migrated');
  const migratedTime = localStorage.getItem('video-migrated-time');
  const migratedCount = localStorage.getItem('video-migrated-count');

  return {
    isMigrated: !!migrated,
    migratedTime: migratedTime || null,
    migratedCount: migratedCount ? parseInt(migratedCount) : 0
  };
}

// 导出给全局使用
if (typeof window !== 'undefined') {
  (window as any).videoMigration = {
    checkAndMigrate,
    migrateOldVideoData,
    resetMigrationFlag,
    getMigrationStatus
  };
}
