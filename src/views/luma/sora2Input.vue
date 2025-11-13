<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { mlog } from '@/api';
import { useMessage, NButton, NInput, NTag, NSelect, NSwitch } from 'naive-ui';
import { homeStore } from '@/store';
import { t } from "@/locales";
import { sora2Feed, sora2Fetch } from '@/api/sora2';
import { UnifiedVideoStore, UnifiedVideoTask } from '@/api/videoStore';
import { compressImage } from '@/utils/imageCompressor';

// Sora2 尺寸选项
const sizeOptions = [
    { label: '720P横屏 (1280x720)', value: '1280x720', aspect: 16/9, style: 'width: 100%; height: 56.25%;', requiresPro: false },
    { label: '720P竖屏 (720x1280)', value: '720x1280', aspect: 9/16, style: 'width: 56.25%; height: 100%;', requiresPro: false },
    // 1080P（按需求提供 1792x1024 与 1024x1792），仅 Pro 支持
    { label: '1080P横屏 (1792x1024)', value: '1792x1024', aspect: 16/9, style: 'width: 100%; height: 56.25%;', requiresPro: true, tip: '1080P横屏仅 sora-2-pro 支持' },
    { label: '1080P竖屏 (1024x1792)', value: '1024x1792', aspect: 9/16, style: 'width: 56.25%; height: 100%;', requiresPro: true, tip: '1080P竖屏仅 sora-2-pro 支持' },
];

// 时长选项（25s 仅 Pro 支持）
const secondsOptions = [
    { label: '10秒', value: '10', requiresPro: false },
    { label: '15秒', value: '15', requiresPro: false },
    { label: '25秒', value: '25', requiresPro: true }
];

// 根据模型动态禁用 25s（naive-ui 支持 options[].disabled）
const uiSecondsOptions = computed(() => {
    const isPro = sora2.value.model === 'sora-2-pro';
    return secondsOptions.map(o => ({
        label: o.label,
        value: o.value,
        disabled: !!o.requiresPro && !isPro
    }));
});

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

// ✅ 保存原始 File 对象和预览 URL
const referenceFile = ref<File | null>(null);
const previewUrl = ref<string>('');

async function selectFile(input: any) {
    const file = input.target.files[0];
    if (!file) return;

    // ✅ 验证文件类型和大小
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        ms.error('仅支持 JPG、PNG、GIF 格式的图片');
        return;
    }

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
        ms.error('图片大小不能超过 15MB');
        return;
    }

    try {
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        mlog(`📤 开始处理图片: ${file.name} (${originalSizeMB}MB)`);

        // ✅ 压缩图片以加快上传速度（保持高质量）
        let processedFile: File = file;
        if (file.size > 2 * 1024 * 1024) { // 如果大于 2MB 则压缩
            mlog('🔄 图片较大，开始压缩...');
            const compressedBlob = await compressImage(file, {
                maxWidth: 2048,
                maxHeight: 2048,
                quality: 0.9, // 高质量
                maxSizeMB: 5   // 压缩到 5MB 以内
            });

            // 转换回 File 对象（保留原始文件名）
            processedFile = new File([compressedBlob], file.name, {
                type: compressedBlob.type || file.type
            });

            const compressedSizeMB = (processedFile.size / (1024 * 1024)).toFixed(2);
            mlog(`✅ 压缩完成: ${originalSizeMB}MB → ${compressedSizeMB}MB`);
            ms.info(`图片已压缩: ${originalSizeMB}MB → ${compressedSizeMB}MB`);
        }

        // ✅ 保存处理后的文件对象（用于提交时直接上传）
        referenceFile.value = processedFile;

        // ✅ 创建预览 URL
        if (previewUrl.value) {
            URL.revokeObjectURL(previewUrl.value);
        }
        previewUrl.value = URL.createObjectURL(processedFile);

        const finalSizeMB = (processedFile.size / (1024 * 1024)).toFixed(2);
        ms.success(`图片已选择 (${finalSizeMB}MB)`);
    } catch (error: any) {
        ms.error(`图片处理失败: ${error.message || error}`);
        mlog('❌ selectFile error:', error);
    }

    if (input?.target) {
        input.target.value = '';
    }
}

const clearInput = () => {
    sora2.value.prompt = '';
    sora2.value.input_reference = '';

    // ✅ 清除文件引用和预览 URL
    referenceFile.value = null;
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
        previewUrl.value = '';
    }

    fsRef.value = '';
};

// 当切换为非 Pro 模型时，若当前选择为 1080P，自动降级为 720P
watch(() => sora2.value.model, (m) => {
    const isPro = m === 'sora-2-pro';
    if (!isPro && (sora2.value.size === '1792x1024' || sora2.value.size === '1024x1792')) {
        sora2.value.size = '720x1280';
        ms.info('已切换为非 Pro 模型，分辨率自动调整为 720P');
    }
    if (!isPro && sora2.value.seconds === '25') {
        sora2.value.seconds = '15';
        ms.info('已切换为非 Pro 模型，时长自动调整为 15 秒');
    }
});

const createVideo = async () => {
    if (!sora2.value.prompt) {
        ms.error('请输入视频描述');
        return;
    }

    // 提交前校验：1080P 仅 Pro 支持
    if (sora2.value.model !== 'sora-2-pro' && (sora2.value.size === '1792x1024' || sora2.value.size === '1024x1792')) {
        ms.error('当前模型不支持 1080P，请切换为 sora-2-pro');
        return;
    }
    // 提交前校验：25s 仅 Pro 支持
    if (sora2.value.model !== 'sora-2-pro' && sora2.value.seconds === '25') {
        ms.error('当前模型不支持 25 秒，请切换为 sora-2-pro');
        return;
    }

    st.value.isLoading = true;
    try {
        // ✅ 创建 FormData（后端需要 multipart/form-data 格式）
        const formData = new FormData();
        formData.append('model', sora2.value.model);
        formData.append('prompt', sora2.value.prompt);
        formData.append('size', sora2.value.size);
        formData.append('seconds', sora2.value.seconds);
        formData.append('watermark', sora2.value.watermark.toString());

        // ✅ 如果有参考图片，直接传递 File 对象（参考官方示例）
        if (referenceFile.value) {
            formData.append('input_reference', referenceFile.value, referenceFile.value.name);
        }

        mlog('Creating Sora2 video with FormData:', {
            model: sora2.value.model,
            prompt: sora2.value.prompt,
            size: sora2.value.size,
            seconds: sora2.value.seconds,
            watermark: sora2.value.watermark,
            has_reference: !!referenceFile.value,
            reference_file: referenceFile.value?.name
        });

        // ✅ 使用 FormData 格式发送
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
                    watermark: sora2.value.watermark,
                    has_reference: !!referenceFile.value
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

        // ✅ 特殊处理：response_processing_failed 可能表示任务已创建但响应超时
        if (error.message && error.message.includes('response_processing_failed')) {
            ms.warning('任务可能已提交，请稍后在任务列表中查看');
            mlog('⚠️ [Sora2] 响应处理失败，但任务可能已创建');
        } else {
            ms.error(`创建失败: ${error.message || error}`);
        }

        mlog('createVideo error:', error);
    }
};

onMounted(() => {
    homeStore.setMyData({ ms: ms });
});

// ✅ 组件卸载时清理预览 URL
onUnmounted(() => {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
    }
});
</script>

<template>
    <div class="p-2">
        <!-- 模型选择 -->
        <div class="pt-1">
            <n-select
                v-model:value="sora2.model"
                :options="[
                    { label: 'Sora 2', value: 'sora-2' },
                    { label: 'Sora 2 Pro', value: 'sora-2-pro' }
                ]"
                size="small"
                placeholder="选择模型"
            />
        </div>

        <!-- 尺寸选择 -->
        <div class="flex items-center justify-between space-x-1">
            <template v-for="item in sizeOptions" :key="item.value">
                <section
                    class="aspect-item flex-1 rounded border-2 dark:border-neutral-700 cursor-pointer relative"
                    :class="{
                        'border-primary': sora2.size === item.value,
                        'opacity-50 cursor-not-allowed': item.requiresPro && sora2.model !== 'sora-2-pro'
                    }"
                    @click="
                        (item.requiresPro && sora2.model !== 'sora-2-pro')
                          ? ms.warning(item.tip || '仅 sora-2-pro 支持该分辨率')
                          : (sora2.size = item.value)
                    "
                >
                    <div class="aspect-box-wrapper mx-auto my-2 flex h-5 w-5 items-center justify-center">
                        <div class="aspect-box rounded border-2 dark:border-neutral-700" :style="item.style"></div>
                    </div>
                    <p class="mb-1 text-center text-[11px]">
                        {{ item.label.split(' ')[0] }}
                        <span v-if="item.requiresPro" class="text-amber-500 ml-1">Pro</span>
                    </p>
                </section>
            </template>
        </div>

        <!-- 分辨率提示 -->
        <div class="pt-1 text-[11px] text-gray-500">
            <div>1792x1024 1080P横屏仅 sora-2-pro 支持</div>
            <div>1024x1792 1080P竖屏仅 sora-2-pro 支持</div>
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
                        class="h-[80px] w-[80px] overflow-hidden rounded-sm border border-gray-400/20 flex justify-center items-center cursor-pointer hover:border-gray-400/40 transition-colors"
                        @click="fsRef.click()"
                    >
                        <!-- 已选择图片预览 -->
                        <img :src="previewUrl" v-if="previewUrl" class="w-full h-full object-cover" />
                        <!-- 初始状态 -->
                        <div class="text-center text-xs" v-else>点击上传</div>
                    </div>
                </div>
            </div>

            <!-- 已选择图片提示 -->
            <div class="pt-1 text-xs text-green-500" v-if="referenceFile">
                ✅ 已选择图片: {{ referenceFile.name }}
            </div>
        </div>

        <!-- 操作按钮 -->
        <section class="pt-3 flex justify-end items-end">
            <div
                class="cursor-pointer pr-2"
                @click="clearInput"
                v-if="previewUrl || sora2.prompt"
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
