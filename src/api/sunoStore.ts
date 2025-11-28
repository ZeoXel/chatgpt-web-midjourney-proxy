import { ss } from '@/utils/storage'
 
export type SunoMedia = {
    id: string;
    video_url: string;
    audio_url: string;
    image_url: string;
    image_large_url: string;
    is_video_pending: boolean;
    major_model_version: string;
    model_name: string;
    metadata: {
        tags?: string;
        prompt: string;
        gpt_description_prompt?: string ;
        audio_prompt_id?: string ;
        history?: string ;
        concat_history?: string ;
        type: string;
        duration: number;
        refund_credits: boolean;
        stream: boolean;
        error_type?: string ;
        error_message?: string ;
    };
    is_liked: boolean;
    user_id: string;
    display_name: string;
    handle: string;
    is_handle_updated: boolean;
    is_trashed: boolean;
    reaction?: any; // You might want to define a proper type for this
    created_at: string;
    status: string;
    title: string;
    play_count: number;
    upvote_count: number;
    is_public: boolean;
};
export class sunoStore{
  //private id: string;
  private localKey='suno-store';
  public save(obj:SunoMedia ){
    if(!obj.id ) throw "id must";
    let arr=  this.getObjs();
    let i= arr.findIndex( v=>v.id==obj.id );
    if(i>-1) arr[i]= obj;
    else arr.push(obj);
     ss.set(this.localKey, arr );
    return this;
  }
  public findIndex(id:string){
    return this.getObjs().findIndex( v=>v.id== id )
  }

  public getObjs():SunoMedia[]{
     const obj = ss.get( this.localKey ) as  undefined| SunoMedia[];
     if(!obj) return [];
     return obj;
  }

  /**
   * 获取合并后的音乐列表（COS JSON + localStorage）
   * COS数据优先，使用 id 去重
   */
  public async getObjsWithDB(): Promise<SunoMedia[]> {
    try {
      console.log('[Suno Store] 🔄 开始合并COS和本地数据...');

      // 动态导入 loadSunoAudiosFromCOS 避免循环依赖
      const { loadSunoAudiosFromCOS } = await import('./sunoStorage');

      // 并行加载COS和本地数据
      const [cosAssets, localAssets] = await Promise.all([
        loadSunoAudiosFromCOS({ limit: 200 }),
        Promise.resolve(this.getObjs())
      ]);

      console.log(`[Suno Store] 数据源统计:
  - COS: ${cosAssets.length} 个
  - 本地: ${localAssets.length} 个`);

      // 使用 Map 进行去重合并，COS数据优先
      const mediaMap = new Map<string, SunoMedia>();

      // 1. 先加载COS数据（高优先级）
      cosAssets.forEach(media => {
        if (media.id) {
          mediaMap.set(media.id, { ...media, source: 'cos' as any });
        }
      });

      // 2. 加载本地数据（如果 id 不存在才添加）
      localAssets.forEach(media => {
        if (media.id && !mediaMap.has(media.id)) {
          mediaMap.set(media.id, { ...media, source: 'local' as any });
        }
      });

      // 3. 转换为数组并按创建时间排序
      const merged = Array.from(mediaMap.values());
      merged.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA; // 降序排列（最新的在前）
      });

      console.log(`[Suno Store] ✅ 合并完成: ${merged.length} 个音乐 (已去重)`);

      return merged;
    } catch (error) {
      console.error('[Suno Store] ❌ 合并失败，降级到仅使用本地数据:', error);
      return this.getObjs();
    }
  }

  public delete( obj:SunoMedia ){
    if(!obj.id ) throw "id must";
    let arr=  this.getObjs();
    let i= arr.findIndex( v=>v.id==obj.id );
    if(i<0) return false
    arr.splice(i, 1);
    ss.set(this.localKey, arr );
    return true;
  }
}