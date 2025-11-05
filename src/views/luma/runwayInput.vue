<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { runwayVideo2Video } from '@/api/runway';
import { homeStore } from '@/store';
import { useMessage, NInput, NButton, NTag, NSlider, NSwitch } from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { smartUploadVideo, getVideoDuration } from '@/api/videoUpload';

const fsRef = ref();
const videoUrl = ref<string>('');
const videoFile = ref<File | null>(null);
const prompt = ref<string>('');
const videoDuration = ref<number>(0);
const st = ref({
    isDo: false,
    uploading: false,
    structure_transformation: 0.3,  // 降低默认值以更好地保留原视频内容
    flip: false
});
const ms = useMessage();

async function selectFile(input: any) {
    const file = input.target.files[0];
    if (!file) return;

    // 检查文件类型
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const validExtensions = ['.mp4', '.mov', '.avi', '.webm'];

    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExtension) {
        ms.error('仅支持 MP4、MOV、AVI、WebM 格式视频');
        return;
    }

    // 检查文件大小（建议不超过 200MB）
    const sizeMB = file.size / 1024 / 1024;
    const maxSizeMB = 200;

    if (sizeMB > maxSizeMB) {
        ms.error(`视频大小 ${sizeMB.toFixed(2)}MB 超过限制 ${maxSizeMB}MB`);
        return;
    }

    if (sizeMB > 100) {
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
        videoUrl.value = result.url;
        videoFile.value = file;

        const durationInfo = videoDuration.value > 0
            ? `, 时长 ${videoDuration.value.toFixed(1)}秒`
            : '';

        // 根据上传类型显示不同的提示
        if (result.type === 'url') {
            ms.success(`视频上传成功 (${sizeMB.toFixed(2)}MB${durationInfo})`);
        } else {
            ms.success(`视频已选择 (${sizeMB.toFixed(2)}MB${durationInfo}) - 使用本地预览`);
        }
    } catch (e: any) {
        console.error('视频上传错误:', e);
        ms.error(`视频上传失败: ${e.message || e}`);
        videoUrl.value = '';
        videoFile.value = null;
        videoDuration.value = 0;
    }
    st.value.uploading = false;
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
    st.value.structure_transformation = 0.3;  // 降低默认值以更好地保留原视频内容
    st.value.flip = false;
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

    st.value.isDo = true;
    try {
        // 传递视频 URL（Supabase 公网 URL 或 Blob URL）
        await runwayVideo2Video(
            videoUrl.value,
            'runway-video2video',
            prompt.value,
            st.value.structure_transformation,
            st.value.flip
        );
        ms.success('Video2Video 任务已提交');
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
                            <div class="text-[9px] text-gray-600 mt-0.5">最大200MB</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 结构改造强度 -->
        <div class="pt-2">
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm">结构改造强度</span>
                <span class="text-xs text-gray-400">{{ st.structure_transformation.toFixed(2) }}</span>
            </div>
            <n-slider
                v-model:value="st.structure_transformation"
                :step="0.01"
                :min="0"
                :max="1"
                size="small"
            />
            <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>保留结构</span>
                <span>完全重绘</span>
            </div>
        </div>

        <!-- 视频方向 -->
        <section class="pt-2 flex justify-between items-center">
            <div class="text-sm">视频方向</div>
            <n-switch v-model:value="st.flip" size="small">
                <template #checked>竖屏(9:16)</template>
                <template #unchecked>横屏(16:9)</template>
            </n-switch>
        </section>

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
            <div>• 文件大小: 最大 200MB</div>
            <div>• 建议时长: 3-10秒 (短视频效果更佳)</div>
            <div>• 结构改造强度: 越低越保留原视频结构</div>
        </div>
    </div>
</template>

<style scoped>
video {
    aspect-ratio: 16 / 9;
}
</style>
