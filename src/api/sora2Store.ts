import { ss } from "@/utils/storage";

// Sora2 任务接口
export interface Sora2Task {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  prompt: string;
  model: 'sora-2' | 'sora-2-pro';
  size?: string;
  seconds?: string;
  watermark?: boolean;
  url?: string;
  video_url?: string;
  thumbnail?: string;
  error?: string;
  progress?: number | string;
  created_at?: number;
  completed_at?: number;
  last_feed?: number;
}

export class sora2Store {
  private localKey = 'sora2-store';

  public save(obj: Sora2Task) {
    if (!obj.id) throw "taskID must";
    let arr = this.getObjs();
    let i = arr.findIndex(v => v.id == obj.id);
    if (i > -1) arr[i] = obj;
    else arr.push(obj);
    ss.set(this.localKey, arr);
    return this;
  }

  public findIndex(id: string) {
    return this.getObjs().findIndex(v => v.id == id)
  }

  public getObjs(): Sora2Task[] {
    const obj = ss.get(this.localKey) as undefined | Sora2Task[];
    if (!obj) return [];
    return obj;
  }

  public getOneById(id: string): Sora2Task | null {
    const i = this.findIndex(id)
    if (i < 0) return null;
    let arr = this.getObjs();
    return arr[i]
  }

  public delete(obj: Sora2Task) {
    if (!obj.id) throw "id must";
    let arr = this.getObjs();
    let i = arr.findIndex(v => v.id == obj.id);
    if (i < 0) return false
    arr.splice(i, 1);
    ss.set(this.localKey, arr);
    return true;
  }
}
