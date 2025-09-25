#!/usr/bin/env node
/**
 * Vidu API 测试脚本 - 简洁版
 */

import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(text) {
    return new Promise(resolve => rl.question(text, resolve));
}

async function main() {
    console.log('🎬 Vidu API 测试工具');
    console.log('='.repeat(40));

    // 获取配置
    const apiToken = await question('请输入 API Token: ');
    const apiBase = (await question('API 地址 (默认: http://localhost:3000): ')) || 'http://localhost:3000';
    const prompt = (await question('视频描述 (默认: 一个美丽的日落场景): ')) || '一个美丽的日落场景，海浪轻拍着海岸';

    console.log('\n🚀 提交任务中...');

    try {
        // 提交任务
        const payload = {
            model: 'vidu2.0',
            prompt: prompt,
            duration: 5,
            images: []
        };

        const response = await fetch(`${apiBase}/v1/video/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            console.log('❌ 任务提交失败:');
            console.log(JSON.stringify(result, null, 2));
            rl.close();
            return;
        }

        console.log('✅ 任务提交成功!');
        console.log('📋 任务ID:', result.task_id);

        if (result.task_id) {
            console.log('\n⏳ 正在轮询任务状态...');
            await pollStatus(result.task_id, apiToken, apiBase);
        }

    } catch (error) {
        console.log('❌ 错误:', error.message);
    }

    rl.close();
}

async function pollStatus(taskId, token, apiBase) {
    const maxAttempts = 60; // 最多轮询60次 (5分钟)
    let attempts = 0;

    const poll = setInterval(async () => {
        attempts++;

        try {
            const response = await fetch(`${apiBase}/v1/video/generations/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const status = await response.json();

            if (status.status === 'success' || status.status === 'succeeded') {
                console.log('🎉 任务完成!');
                if (status.url) {
                    console.log('📹 视频URL:', status.url);
                }
                clearInterval(poll);
                return;
            }

            if (status.status === 'failed') {
                console.log('💥 任务失败:', status.reason || '未知原因');
                clearInterval(poll);
                return;
            }

            console.log(`📊 状态: ${status.status} (${attempts}/${maxAttempts})`);

            if (attempts >= maxAttempts) {
                console.log('⏰ 轮询超时');
                clearInterval(poll);
            }

        } catch (error) {
            console.log('❌ 查询状态失败:', error.message);
            clearInterval(poll);
        }
    }, 5000); // 每5秒轮询一次
}

main().catch(console.error);