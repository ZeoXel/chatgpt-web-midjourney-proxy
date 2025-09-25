// Vidu 测试页面 JavaScript

class ViduTester {
    constructor() {
        this.selectedMode = '';
        this.uploadedImages = [];
        this.pollInterval = null;

        this.initEventListeners();
    }

    initEventListeners() {
        // 模式选择卡片
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectMode(card.dataset.mode);
            });
        });

        // 文件上传
        const fileUpload = document.getElementById('fileUpload');
        const fileInput = document.getElementById('fileInput');

        fileUpload.addEventListener('click', () => fileInput.click());
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.classList.add('dragover');
        });
        fileUpload.addEventListener('dragleave', () => {
            fileUpload.classList.remove('dragover');
        });
        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // 提交按钮
        document.getElementById('submitBtn').addEventListener('click', () => {
            this.submitTask();
        });

        // 模式选择下拉框
        document.getElementById('modeSelect').addEventListener('change', (e) => {
            this.updateModeSelection(e.target.value);
        });
    }

    selectMode(mode) {
        this.selectedMode = mode;

        // 更新卡片选中状态
        document.querySelectorAll('.mode-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        // 更新下拉框
        const modeSelect = document.getElementById('modeSelect');
        if (mode === 'text2video') {
            modeSelect.value = '';
        } else {
            modeSelect.value = mode;
        }

        // 更新图片上传提示
        this.updateUploadHint(mode);
    }

    updateModeSelection(mode) {
        this.selectedMode = mode || 'text2video';

        // 更新卡片选中状态
        document.querySelectorAll('.mode-card').forEach(card => {
            card.classList.remove('active');
        });

        const targetMode = mode || 'text2video';
        const targetCard = document.querySelector(`[data-mode="${targetMode}"]`);
        if (targetCard) {
            targetCard.classList.add('active');
        }

        this.updateUploadHint(targetMode);
    }

    updateUploadHint(mode) {
        const fileUpload = document.getElementById('fileUpload');
        const hints = {
            'text2video': '📁 文生视频无需上传图片',
            'img2video': '📁 上传1张图片用于图生视频',
            'firstTail': '📁 上传2张图片 (开始帧 + 结束帧)',
            'reference': '📁 上传3张以上参考图片'
        };

        const hint = hints[mode] || '📁 点击或拖拽上传图片';
        fileUpload.querySelector('div').textContent = hint;
    }

    async handleFiles(files) {
        for (let file of files) {
            if (!file.type.startsWith('image/')) continue;

            const base64 = await this.fileToBase64(file);
            this.uploadedImages.push({
                name: file.name,
                base64: base64,
                url: URL.createObjectURL(file)
            });
        }

        this.updateImagePreview();
    }

    fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    updateImagePreview() {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';

        this.uploadedImages.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.innerHTML = `
                <img src="${img.url}" alt="${img.name}">
                <button class="remove" onclick="viduTester.removeImage(${index})">×</button>
            `;
            preview.appendChild(div);
        });
    }

    removeImage(index) {
        URL.revokeObjectURL(this.uploadedImages[index].url);
        this.uploadedImages.splice(index, 1);
        this.updateImagePreview();
    }

    async submitTask() {
        const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
        const apiToken = document.getElementById('apiToken').value.trim();
        const mode = document.getElementById('modeSelect').value;
        const model = document.getElementById('modelSelect').value;
        const prompt = document.getElementById('prompt').value.trim();
        const size = document.getElementById('sizeSelect').value;
        const duration = parseInt(document.getElementById('duration').value);

        // 验证输入
        if (!apiBaseUrl) {
            this.showError('请输入 API 基础地址');
            return;
        }

        if (!apiToken) {
            this.showError('请输入 API Token');
            return;
        }

        if (!prompt) {
            this.showError('请输入提示词');
            return;
        }

        // 验证图片数量
        const imageCount = this.uploadedImages.length;
        if (mode === 'firstTail' && imageCount !== 2) {
            this.showError('首尾帧模式需要上传恰好2张图片');
            return;
        }

        if (mode === 'reference' && imageCount < 3) {
            this.showError('参考图模式需要上传至少3张图片');
            return;
        }

        if (mode === 'img2video' && imageCount !== 1) {
            this.showError('图生视频模式需要上传恰好1张图片');
            return;
        }

        // 构建请求数据
        const requestData = {
            model: model,
            prompt: prompt,
            size: size,
            duration: duration,
            metadata: {
                duration: duration,
                seed: 0,
                resolution: size.includes('1080') ? '1080p' : (size.includes('720') ? '720p' : size),
                movement_amplitude: "auto",
                bgm: false,
                payload: "",
                callback_url: ""
            }
        };

        // 根据模式处理图片参数
        if (mode === 'img2video' && this.uploadedImages.length === 1) {
            // 图生视频：使用image字段
            requestData.image = this.uploadedImages[0].base64;
        } else if (mode && this.uploadedImages.length > 0) {
            // 其他模式：使用images数组（兼容模式）
            requestData.images = this.uploadedImages.map(img => img.base64);
            requestData.mode = mode;
        }

        this.showLoading(true);

        try {
            // 提交任务
            const submitResponse = await this.apiRequest('/v1/video/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiToken}`
                },
                body: JSON.stringify(requestData)
            });

            if (submitResponse.error) {
                throw new Error(submitResponse.error.message || '提交任务失败');
            }

            this.showResponse(submitResponse, 'success');

            // 开始轮询任务状态
            if (submitResponse.task_id) {
                this.startPolling(submitResponse.task_id, apiToken);
            }

        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async startPolling(taskId, apiToken) {
        this.showStatus('正在轮询任务状态...', 'pending');

        this.pollInterval = setInterval(async () => {
            try {
                const status = await this.checkTaskStatus(taskId, apiToken);

                if (status.status === 'succeeded') {
                    this.showStatus('任务完成!', 'success');
                    this.showResponse(status, 'success');
                    // 如果有视频URL，显示视频播放器
                    if (status.url) {
                        this.showVideoPlayer(status.url);
                    }
                    this.stopPolling();
                } else if (status.status === 'failed') {
                    this.showStatus('任务失败', 'error');
                    this.showResponse(status, 'error');
                    this.stopPolling();
                } else if (status.status === 'processing') {
                    this.showStatus(`任务处理中...`, 'pending');
                } else {
                    this.showStatus(`任务状态: ${status.status}`, 'pending');
                }
            } catch (error) {
                this.showError('轮询状态失败: ' + error.message);
                this.stopPolling();
            }
        }, 3000); // 每3秒轮询一次
    }

    async checkTaskStatus(taskId, apiToken) {
        return await this.apiRequest(`/v1/video/generations/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    getApiBaseUrl() {
        return document.getElementById('apiBaseUrl').value.trim() || 'http://localhost:3000';
    }

    async apiRequest(endpoint, options = {}) {
        const url = this.getApiBaseUrl() + endpoint;
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        return data;
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const submitBtn = document.getElementById('submitBtn');

        if (show) {
            loading.style.display = 'block';
            submitBtn.disabled = true;
            submitBtn.textContent = '生成中...';
        } else {
            loading.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 生成视频';
        }
    }

    showResponse(data, type = 'success') {
        const response = document.getElementById('response');
        response.style.display = 'block';
        response.className = `response ${type}`;
        response.textContent = JSON.stringify(data, null, 2);
    }

    showError(message) {
        this.showResponse({ error: message }, 'error');
    }

    showStatus(message, type = 'pending') {
        const response = document.getElementById('response');
        response.style.display = 'block';
        response.className = `response ${type}`;
        response.innerHTML = `<span class="status ${type}">${type}</span> ${message}`;
    }

    showVideoPlayer(videoUrl) {
        const response = document.getElementById('response');
        const videoElement = `
            <div style="margin-top: 20px;">
                <h4>生成的视频:</h4>
                <video controls style="width: 100%; max-width: 600px; margin-top: 10px;">
                    <source src="${videoUrl}" type="video/mp4">
                    您的浏览器不支持视频播放。
                </video>
                <br>
                <a href="${videoUrl}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background: #6366f1; color: white; text-decoration: none; border-radius: 4px;">下载视频</a>
            </div>
        `;
        response.innerHTML += videoElement;
    }
}

// 初始化
const viduTester = new ViduTester();

// 页面加载完成后自动选择文生视频模式
document.addEventListener('DOMContentLoaded', () => {
    viduTester.selectMode('text2video');
});