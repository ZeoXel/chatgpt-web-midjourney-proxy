<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { runwayAlephContext } from '@/api/runway';
import { homeStore } from '@/store';
import { useMessage, NInput, NButton, NTag } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { smartUploadVideo, getVideoDuration, type VideoUploadResult } from '@/api/videoUpload';

const fsRef = ref();
const videoUrl = ref<string>('');
const videoFile = ref<File | null>(null);
const prompt = ref<string>('');
const videoDuration = ref<number>(0);
const supabaseUpload = ref<VideoUploadResult | null>(null);
const st = ref({
    isDo: false,
    uploading: false
});
const ms = useMessage();

async function selectFile(input: any) {
    const file = input.target.files[0];
    if (!file) return;

    supabaseUpload.value = null;

    // 检查文件类型
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const validExtensions = ['.mp4', '.mov', '.avi', '.webm'];

    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExtension) {
        ms.error('仅支持 MP4、MOV、AVI、WebM 格式视频');
        return;
    }

    // 检查文件大小（Aleph 限制 50MB）
    const sizeMB = file.size / 1024 / 1024;
    const maxSizeMB = 50;

    if (sizeMB > maxSizeMB) {
        ms.error(`视频大小 ${sizeMB.toFixed(2)}MB 超过限制 ${maxSizeMB}MB`);
        return;
    }

    if (sizeMB > 30) {
        ms.warning(`视频文件较大 (${sizeMB.toFixed(2)}MB)，提交时可能需要较长时间`);
    }

    st.value.uploading = true;
    try {
        // 获取视频时长
        try {
            videoDuration.value = await getVideoDuration(file);
            const durationText = videoDuration.value.toFixed(1);

            if (videoDuration.value > 30) {
                ms.warning(`视频时长 ${durationText}秒，建议使用 3-10 秒的短视频以获得最佳效果`);
            }
        } catch (e) {
            console.warn('无法获取视频时长:', e);
        }

        // 上传视频到 Supabase
        const result = await smartUploadVideo(file, maxSizeMB);
        if (result.type !== 'url') {
            ms.error('视频上传失败：未获取到可访问的云端地址，请检查 Supabase 配置或稍后重试');
            videoUrl.value = '';
            videoFile.value = null;
            videoDuration.value = 0;
            supabaseUpload.value = null;
            st.value.uploading = false;
            return;
        }

        videoUrl.value = result.url;
        videoFile.value = file;
        supabaseUpload.value = result;

        const durationInfo = videoDuration.value > 0
            ? `, 时长 ${videoDuration.value.toFixed(1)}秒`
            : '';

        // 根据上传类型显示不同的提示
        ms.success(`视频上传成功 (${sizeMB.toFixed(2)}MB${durationInfo})`);

        st.value.uploading = false;
    } catch (e: any) {
        console.error('视频上传错误:', e);
        ms.error(`视频上传失败: ${e.message || e}`);
        videoUrl.value = '';
        videoFile.value = null;
        videoDuration.value = 0;
        supabaseUpload.value = null;
    }
    st.value.uploading = false;
    if (input?.target) {
        input.target.value = '';
    }
}

const clearInput = () => {
    // 如果是 blob URL，需要手动释放
    if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl.value);
    }

    videoUrl.value = '';
    videoFile.value = null;
    prompt.value = '';
    videoDuration.value = 0;
    supabaseUpload.value = null;
};

const generate = async () => {
    if (!videoUrl.value) {
        ms.error('请先上传视频文件');
        return;
    }
    if (!prompt.value) {
        ms.error('请输入风格描述词');
        return;
    }

    if (!videoUrl.value.startsWith('http')) {
        ms.error('视频未上传到可公开访问的地址，请重新上传');
        return;
    }

    st.value.isDo = true;
    try {
        // 调试日志 - 输出完整的请求参数
        console.log('🎬 [Runway Submit] 准备提交任务:', {
            videoUrl: videoUrl.value,
            prompt: prompt.value,
            supabaseUpload: supabaseUpload.value
        });

        // 传递视频 URL（必须是 Supabase 等可访问的公网地址）
        await runwayAlephContext(
            videoUrl.value,
            prompt.value,
            {
                seconds: 5
            }
        );
        ms.success('Aleph 任务已提交');
    } catch (e: any) {
        ms.error(e.message || e);
    }
    st.value.isDo = false;
};

onMounted(() => {
    homeStore.setMyData({ ms: ms });
});

onUnmounted(() => {
    if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl.value);
    }
});
</script>

<template>
    <div class="p-2">
        <!-- 提示词输入 -->
        <div class="pt-1">
            <n-input
                v-model:value="prompt"
                :placeholder="$t('video.descpls')"
                type="textarea"
                size="small"
                :autosize="{ minRows: 3, maxRows: 12 }"
            />
        </div>

        <!-- 视频上传 -->
        <div class="pt-2">
            <div class="flex justify-between items-end">
                <div>
                    <div class="text-sm mb-1">
                        上传视频
                        <span v-if="videoDuration > 0" class="text-xs text-gray-500 ml-1">
                            ({{ videoDuration.toFixed(1) }}秒)
                        </span>
                    </div>
                    <input
                        type="file"
                        @change="selectFile"
                        ref="fsRef"
                        style="display: none"
                        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm"
                    />
                    <div
                        class="h-[80px] w-[142px] overflow-hidden rounded-sm border border-gray-400/20 flex justify-center items-center cursor-pointer hover:border-gray-400/40 transition-colors"
                        @click="fsRef.click()"
                    >
                        <SvgIcon
                            icon="line-md:uploading-loop"
                            size="3xl"
                            class="text-green-300"
                            v-if="st.uploading"
                        />
                        <video
                            v-else-if="videoUrl"
                            loop
                            playsinline
                            muted
                            autoplay
                            referrerpolicy="no-referrer"
                            class="w-full h-full object-cover"
                        >
                            <source :src="videoUrl" referrerpolicy="no-referrer" type="video/mp4" />
                        </video>
                        <div class="text-center text-xs" v-else>
                            <div>点击上传</div>
                            <div class="text-[10px] text-gray-500 mt-1">MP4/MOV/WebM</div>
                            <div class="text-[9px] text-gray-600 mt-0.5">最大50MB</div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                class="pt-2 text-xs"
                :class="videoUrl ? 'text-green-500' : 'text-gray-500'"
            >
                <span v-if="videoUrl">视频已上传到云端，Aleph 将自动分析上下文</span>
                <span v-else>上传 3-10 秒短视频可获得最佳效果</span>
            </div>
        </div>

        <!-- 操作按钮 -->
        <section class="pt-3 flex justify-end items-end">
            <div
                class="cursor-pointer pr-2"
                @click="clearInput"
                v-if="videoUrl || prompt"
            >
                <NTag type="primary" size="small" :bordered="false" round>
                    <span class="cursor-pointer">{{ $t('video.clear') }}</span>
                </NTag>
            </div>

            <div class="text-right">
                <NButton
                    :loading="st.isDo"
                    type="primary"
                    @click="!homeStore.myData.hasBalance ? ms.info('账户余额不足') : generate()"
                    :disabled="!videoUrl || !prompt || !homeStore.myData.hasBalance"
                    style="background-color: #445ff6;"
                >
                    {{ $t('video.generate') }}
                </NButton>
            </div>
        </section>

        <!-- 说明 -->
        <div class="pt-2 text-[11px] text-gray-500">
            <div>• 支持格式: MP4、MOV、AVI、WebM</div>
            <div>• 文件大小: 最大 50MB (Aleph 限制)</div>
            <div>• 固定时长: Aleph Alpha 输出约 5 秒</div>
            <div>• 建议时长: 3-10 秒 (短视频效果更佳)</div>
            <div>• 分辨率由模型根据输入自动匹配</div>
        </div>
    </div>
</template>

<style scoped>
video {
    aspect-ratio: 16 / 9;
}
</style>
