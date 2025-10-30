<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { mlog } from '@/api';
import { smartUploadImage } from '@/api/imageUpload';
import { useMessage, NButton, NInput, NTag, NSelect, NSwitch } from 'naive-ui';
import { homeStore } from '@/store';
import { t } from "@/locales";
import { sora2Feed, sora2Fetch } from '@/api/sora2';
import { UnifiedVideoStore, UnifiedVideoTask } from '@/api/videoStore';

// Sora2 尺寸选项
const sizeOptions = [
    { label: '720P横屏 (1280x720)', value: '1280x720', aspect: 16/9, style: 'width: 100%; height: 56.25%;' },
    { label: '720P竖屏 (720x1280)', value: '720x1280', aspect: 9/16, style: 'width: 56.25%; height: 100%;' }
];

// 时长选项
const secondsOptions = [
    { label: '10秒', value: '10' },
    { label: '15秒', value: '15' }
];

const sora2 = ref({
    prompt: '',
    model: 'sora-2',
    size: '720x1280',
    seconds: '10',
    watermark: false,
    input_reference: ''
});

const fsRef = ref();
const ms = useMessage();
const st = ref({ isLoading: false });

async function selectFile(input: any) {
    const file = input.target.files[0];
    if (!file) return;

    try {
        st.value.isLoading = true;
        ms.info('正在上传图片...');

        const result = await smartUploadImage(file);
        sora2.value.input_reference = result.url;
        fsRef.value = '';

        const sizeMB = ((result.size || 0) / (1024 * 1024)).toFixed(2);
        if (result.type === 'url') {
            ms.success(`图片上传成功 (${sizeMB}MB) - 使用云存储`);
        } else {
            ms.success(`图片压缩成功 (${sizeMB}MB) - 使用压缩Base64`);
        }
    } catch (error: any) {
        ms.error(`图片上传失败: ${error.message || error}`);
        mlog('selectFile error:', error);
    } finally {
        st.value.isLoading = false;
    }
}

const clearInput = () => {
    sora2.value.prompt = '';
    sora2.value.input_reference = '';
    fsRef.value = '';
};

const createVideo = async () => {
    if (!sora2.value.prompt) {
        ms.error('请输入视频描述');
        return;
    }

    st.value.isLoading = true;
    try {
        // 创建 FormData
        const formData = new FormData();
        formData.append('model', sora2.value.model);
        formData.append('prompt', sora2.value.prompt);
        formData.append('size', sora2.value.size);
        formData.append('seconds', sora2.value.seconds);
        formData.append('watermark', sora2.value.watermark.toString());

        if (sora2.value.input_reference) {
            formData.append('input_reference', sora2.value.input_reference);
        }

        mlog('Creating Sora2 video:', {
            model: sora2.value.model,
            prompt: sora2.value.prompt,
            size: sora2.value.size,
            seconds: sora2.value.seconds,
            watermark: sora2.value.watermark,
            has_reference: !!sora2.value.input_reference
        });

        const result: any = await sora2Fetch('/v1/videos', formData, { upFile: true });
        st.value.isLoading = false;

        if (result.id) {
            ms.success('视频生成任务已创建');

            // ✅ 立即创建 pending 任务，让UI能马上显示"加载中"
            const unifiedStore = new UnifiedVideoStore();
            const pendingTask: UnifiedVideoTask = {
                id: result.id,
                service: 'sora2',
                url: '',
                status: 'pending',
                prompt: sora2.value.prompt,
                model: sora2.value.model,
                duration: parseFloat(sora2.value.seconds),
                created_at: Date.now(),
                updated_at: Date.now(),
                extra: {
                    size: sora2.value.size,
                    watermark: sora2.value.watermark
                }
            };
            unifiedStore.save(pendingTask);
            homeStore.setMyData({ act: 'Sora2Feed' }); // 立即触发UI刷新

            // 然后开始轮询任务状态
            sora2Feed(result.id);
        } else {
            ms.error(t('mj.createFail'));
        }
    } catch (error: any) {
        st.value.isLoading = false;
        ms.error(`创建失败: ${error.message || error}`);
        mlog('createVideo error:', error);
    }
};

onMounted(() => {
    homeStore.setMyData({ ms: ms });
});
</script>

<template>
    <div class="p-2">
        <!-- 尺寸选择 -->
        <div class="flex items-center justify-between space-x-1">
            <template v-for="item in sizeOptions" :key="item.value">
                <section
                    class="aspect-item flex-1 rounded border-2 dark:border-neutral-700 cursor-pointer relative"
                    :class="{'border-primary': sora2.size === item.value}"
                    @click="sora2.size = item.value"
                >
                    <div class="aspect-box-wrapper mx-auto my-2 flex h-5 w-5 items-center justify-center">
                        <div class="aspect-box rounded border-2 dark:border-neutral-700" :style="item.style"></div>
                    </div>
                    <p class="mb-1 text-center text-[11px]">{{ item.label.split(' ')[0] }}</p>
                </section>
            </template>
        </div>

        <!-- 提示词输入 -->
        <div class="pt-2">
            <n-input
                v-model:value="sora2.prompt"
                :placeholder="$t('video.descpls')"
                type="textarea"
                size="small"
                :autosize="{ minRows: 3, maxRows: 12 }"
            />
        </div>

        <!-- 时长选择 -->
        <div class="pt-2">
            <div class="flex items-center justify-between">
                <span class="text-sm">时长</span>
                <n-select
                    v-model:value="sora2.seconds"
                    :options="secondsOptions"
                    size="small"
                    class="!w-[70%]"
                />
            </div>
        </div>

        <!-- 水印开关 -->
        <section class="pt-2 flex justify-between items-center">
            <div>添加水印</div>
            <n-switch v-model:value="sora2.watermark" size="small" />
        </section>

        <!-- 参考图片上传 -->
        <div class="pt-2">
            <div class="flex justify-between items-end">
                <div>
                    <div class="text-sm mb-1">{{ $t('video.selectimg') }}（可选）</div>
                    <input
                        type="file"
                        @change="selectFile"
                        ref="fsRef"
                        style="display: none"
                        accept="image/jpeg, image/jpg, image/png, image/gif"
                    />
                    <div
                        class="h-[80px] w-[80px] overflow-hidden rounded-sm border border-gray-400/20 flex justify-center items-center cursor-pointer"
                        @click="fsRef.click()"
                    >
                        <img :src="sora2.input_reference" v-if="sora2.input_reference" />
                        <div class="text-center text-xs" v-else>点击上传</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 操作按钮 -->
        <section class="pt-3 flex justify-end items-end">
            <div
                class="cursor-pointer pr-2"
                @click="clearInput"
                v-if="sora2.input_reference || sora2.prompt"
            >
                <NTag type="primary" size="small" :bordered="false" round>
                    <span class="cursor-pointer">{{ $t('video.clear') }}</span>
                </NTag>
            </div>

            <div class="text-right">
                <NButton
                    :loading="st.isLoading"
                    type="primary"
                    @click="!homeStore.myData.hasBalance ? ms.info('账户余额不足，无法使用视频生成功能') : createVideo()"
                    :disabled="!sora2.prompt || !homeStore.myData.hasBalance"
                    style="background-color: #445ff6;"
                >
                    {{ $t('video.generate') }}
                </NButton>
            </div>
        </section>
    </div>
</template>

<style scoped>
.aspect-item {
    transition: all 0.2s;
}

.aspect-item:hover {
    transform: translateY(-2px);
}
</style>
