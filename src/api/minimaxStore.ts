import { ss } from '@/utils/storage';

export interface MinimaxTask {
  task_id: string;
  status?: string;
  task_status?: string;
  prompt?: string;
  model?: string;
  duration?: number;
  resolution?: string;
  first_frame_image?: string;
  last_frame_image?: string;
  frame_images?: string[];
  mode?: string;
  file?: {
    download_url?: string;
    filename?: string;
    file_id?: number | string;
    bytes?: number;
    created_at?: number | string;
    purpose?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  result?: {
    video_url?: string;
    cover_image_url?: string;
    duration?: number;
    resolution?: string;
    [key: string]: any;
  };
  task_result?: {
    video_url?: string;
    cover_image_url?: string;
    duration?: number;
    resolution?: string;
    [key: string]: any;
  };
  data?: Record<string, any>;
  created_at?: string | number;
  updated_at?: string | number;
  last_feed?: number;
  error?: string;
  progress?: number;
  [key: string]: any;
}

export class MinimaxStore {
  private localKey = 'minimax-store';

  save(task: MinimaxTask) {
    if (!task.task_id) throw new Error('task_id is required');

    const tasks = this.getObjs();
    const index = tasks.findIndex(item => item.task_id === task.task_id);

    const sanitizedTask = {
      ...task,
      first_frame_image: task.first_frame_image?.startsWith('data:')
        ? '[uploaded-image]'
        : task.first_frame_image,
      last_frame_image: task.last_frame_image?.startsWith('data:')
        ? '[uploaded-image]'
        : task.last_frame_image,
      frame_images: task.frame_images?.map((img) =>
        img?.startsWith?.('data:') ? '[uploaded-image]' : img,
      ),
    };

    if (index > -1)
      tasks[index] = sanitizedTask;
    else tasks.push(sanitizedTask);

    ss.set(this.localKey, tasks);
    return this;
  }

  getObjs(): MinimaxTask[] {
    const obj = ss.get(this.localKey) as MinimaxTask[] | undefined;
    return obj ?? [];
  }

  getOne(task_id: string): MinimaxTask | null {
    return this.getObjs().find(item => item.task_id === task_id) ?? null;
  }

  delete(task_id: string) {
    const tasks = this.getObjs();
    const index = tasks.findIndex(item => item.task_id === task_id);
    if (index < 0) return false;
    tasks.splice(index, 1);
    ss.set(this.localKey, tasks);
    return true;
  }
}

export const minimaxStore = new MinimaxStore();
