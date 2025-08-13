import localforage from 'localforage';

// Simple Tauri-aware persistent storage helpers
type JSONValue = any;

export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_IPC__' in (window as any) || '__TAURI__' in (window as any);
};

async function ensureDirFor(filePath: string) {
  const { dirname } = await import('@tauri-apps/api/path');
  const { createDir, exists } = await import('@tauri-apps/api/fs');
  const dir = await dirname(filePath);
  const has = await exists(dir);
  if (!has) await createDir(dir, { recursive: true });
}

/**
 * Save JSON data.
 * - In Tauri: writes to the app's data directory (platform-specific).
 * - In Browser/PWA: falls back to IndexedDB via localforage.
 */
export async function saveJSON(filename: string, data: JSONValue): Promise<void> {
  if (isTauri()) {
    const { writeTextFile } = await import('@tauri-apps/api/fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const dir = await appDataDir();
    const filePath = await join(dir, filename);
    await ensureDirFor(filePath);
    await writeTextFile(filePath, JSON.stringify(data, null, 2));
    return;
  }
  await localforage.setItem(filename, data);
}

/**
 * Load JSON data.
 * Returns defaultValue if missing or parse fails.
 */
export async function loadJSON<T = JSONValue>(filename: string, defaultValue: T): Promise<T> {
  if (isTauri()) {
    const { readTextFile } = await import('@tauri-apps/api/fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    try {
      const dir = await appDataDir();
      const filePath = await join(dir, filename);
      const text = await readTextFile(filePath);
      return JSON.parse(text) as T;
    } catch {
      return defaultValue;
    }
  }
  const v = await localforage.getItem<T>(filename);
  return (v ?? defaultValue) as T;
}

/**
 * Remove saved file/item.
 */
export async function removeSaved(filename: string): Promise<void> {
  if (isTauri()) {
    const { removeFile } = await import('@tauri-apps/api/fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    try {
      const dir = await appDataDir();
      const filePath = await join(dir, filename);
      await removeFile(filePath);
    } catch {
      // ignore if not exists
    }
    return;
  }
  await localforage.removeItem(filename);
}

/**
 * Optional utility: export a saved JSON file from AppData to a user-chosen folder.
 * Returns the destination path or null if canceled.
 */
export async function exportToFolder(filename: string, subdir?: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { readTextFile, writeTextFile, createDir } = await import('@tauri-apps/api/fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { open } = await import('@tauri-apps/api/dialog');

  const base = (await open({ directory: true, multiple: false })) as string | null;
  if (!base) return null;

  const srcDir = await appDataDir();
  const srcPath = await join(srcDir, filename);
  const dstDir = subdir ? await join(base, subdir) : base;
  await createDir(dstDir, { recursive: true });
  const dstPath = await join(dstDir, filename);

  const content = await readTextFile(srcPath);
  await writeTextFile(dstPath, content);
  return dstPath;
}

/**
 * Example filenames you can standardize across the app.
 * - configs: 'config.json'
 * - servers: 'servers.json'
 * - chats: 'chats.json'
 * - gallery index: 'gallery/index.json'
 *
 * Usage:
 *   await saveJSON('config.json', state);
 *   const cfg = await loadJSON('config.json', defaultCfg);
 */
