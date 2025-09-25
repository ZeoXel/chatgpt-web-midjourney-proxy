# 📚 Vidu API 调用示例

这里包含了 Vidu 各种生成模式的详细 API 调用示例。

## 🔐 认证方式

所有 API 调用都需要在请求头中包含 Bearer Token：

```bash
Authorization: Bearer sk-your-token-here
```

## 📝 文生视频 (Text to Video)

### 基础调用
```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Authorization: Bearer sk-your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vidu2.0",
    "prompt": "一个美丽的日落场景，海浪轻拍着海岸，金色的阳光洒在水面上",
    "duration": 5
  }'
```

### JavaScript 调用
```javascript
const response = await fetch('http://localhost:3000/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'vidu2.0',
    prompt: '一个美丽的日落场景，海浪轻拍着海岸，金色的阳光洒在水面上',
    duration: 5
  })
});

const result = await response.json();
console.log('任务ID:', result.task_id);
```

### Python 调用
```python
import requests
import json

url = 'http://localhost:3000/v1/tasks'
headers = {
    'Authorization': 'Bearer sk-your-token',
    'Content-Type': 'application/json'
}
data = {
    'model': 'vidu2.0',
    'prompt': '一个美丽的日落场景，海浪轻拍着海岸，金色的阳光洒在水面上',
    'duration': 5
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(f'任务ID: {result["task_id"]}')
```

## 🖼️ 图生视频 (Image to Video)

### 基础调用
```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Authorization: Bearer sk-your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vidu2.0",
    "prompt": "让这张图片动起来，添加自然的摇摆动画效果",
    "mode": "img2video",
    "images": ["data:image/jpeg;base64,/9j/4AAQSkZ..."],
    "duration": 5
  }'
```

### JavaScript 调用
```javascript
// 将文件转换为 base64
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

const imageFile = document.getElementById('imageInput').files[0];
const imageBase64 = await fileToBase64(imageFile);

const response = await fetch('http://localhost:3000/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'vidu2.0',
    prompt: '让这张图片动起来，添加自然的摇摆动画效果',
    mode: 'img2video',
    images: [imageBase64],
    duration: 5
  })
});
```

### Python 调用
```python
import base64

def encode_image(image_path):
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

image_base64 = encode_image('path/to/your/image.jpg')

data = {
    'model': 'vidu2.0',
    'prompt': '让这张图片动起来，添加自然的摇摆动画效果',
    'mode': 'img2video',
    'images': [image_base64],
    'duration': 5
}

response = requests.post(url, headers=headers, json=data)
```

## 🎞️ 首尾帧生视频 (First & Tail Frames)

### 基础调用
```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Authorization: Bearer sk-your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vidu2.0",
    "prompt": "创建从开始帧到结束帧的平滑过渡动画",
    "mode": "firstTail",
    "images": ["开始帧base64", "结束帧base64"],
    "duration": 5
  }'
```

### JavaScript 调用
```javascript
const startImageFile = document.getElementById('startImage').files[0];
const endImageFile = document.getElementById('endImage').files[0];

const startImageBase64 = await fileToBase64(startImageFile);
const endImageBase64 = await fileToBase64(endImageFile);

const response = await fetch('http://localhost:3000/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'vidu2.0',
    prompt: '创建从开始帧到结束帧的平滑过渡动画',
    mode: 'firstTail',
    images: [startImageBase64, endImageBase64],
    duration: 5
  })
});
```

### Python 调用
```python
start_image = encode_image('start_frame.jpg')
end_image = encode_image('end_frame.jpg')

data = {
    'model': 'vidu2.0',
    'prompt': '创建从开始帧到结束帧的平滑过渡动画',
    'mode': 'firstTail',
    'images': [start_image, end_image],
    'duration': 5
}

response = requests.post(url, headers=headers, json=data)
```

## 📚 参考图生视频 (Reference Images)

### 基础调用
```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Authorization: Bearer sk-your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vidu2.0",
    "prompt": "基于参考图的艺术风格创作视频内容",
    "mode": "reference",
    "images": ["参考图1", "参考图2", "参考图3", "参考图4"],
    "duration": 5
  }'
```

### JavaScript 调用
```javascript
const referenceFiles = Array.from(document.getElementById('referenceImages').files);
const referenceBase64Array = await Promise.all(
  referenceFiles.map(file => fileToBase64(file))
);

const response = await fetch('http://localhost:3000/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'vidu2.0',
    prompt: '基于参考图的艺术风格创作视频内容',
    mode: 'reference',
    images: referenceBase64Array,
    duration: 5
  })
});
```

### Python 调用
```python
reference_images = [
    'reference1.jpg',
    'reference2.jpg',
    'reference3.jpg',
    'reference4.jpg'
]

images_base64 = [encode_image(img) for img in reference_images]

data = {
    'model': 'vidu2.0',
    'prompt': '基于参考图的艺术风格创作视频内容',
    'mode': 'reference',
    'images': images_base64,
    'duration': 5
}

response = requests.post(url, headers=headers, json=data)
```

## 📊 任务状态查询

### 查询任务状态
```bash
curl -X GET http://localhost:3000/v1/tasks/{task_id} \
  -H "Authorization: Bearer sk-your-token"
```

### JavaScript 轮询
```javascript
async function pollTaskStatus(taskId, maxWait = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const response = await fetch(`http://localhost:3000/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': 'Bearer sk-your-token'
      }
    });

    const status = await response.json();
    console.log('任务状态:', status.status);

    if (status.status === 'success') {
      console.log('视频URL:', status.url);
      return status;
    } else if (status.status === 'failed') {
      throw new Error(status.reason || '任务失败');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('等待超时');
}
```

### Python 轮询
```python
import time

def poll_task_status(task_id, max_wait=300):
    start_time = time.time()

    while time.time() - start_time < max_wait:
        response = requests.get(f'{url}/{task_id}', headers=headers)
        status = response.json()

        print(f'任务状态: {status["status"]}')

        if status['status'] == 'success':
            print(f'视频URL: {status["url"]}')
            return status
        elif status['status'] == 'failed':
            raise Exception(status.get('reason', '任务失败'))

        time.sleep(3)

    raise Exception('等待超时')
```

## 🔧 高级配置选项

### 自定义参数
```json
{
  "model": "vidu2.0",
  "prompt": "详细的提示词描述",
  "mode": "img2video",
  "images": ["base64图片数据"],
  "duration": 8,
  "size": "1080p",
  "metadata": {
    "seed": 12345,
    "movement_amplitude": "auto",
    "bgm": false
  }
}
```

### 错误处理示例
```javascript
try {
  const response = await fetch('http://localhost:3000/v1/tasks', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk-your-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log('任务提交成功:', result);

} catch (error) {
  console.error('API 调用失败:', error.message);
}
```

## 📋 响应格式说明

### 任务提交成功响应
```json
{
  "task_id": "1758610505473453",
  "status": "submitted",
  "model": "vidu2.0",
  "prompt": "用户输入的提示词",
  "duration": 5,
  "created_at": "2025-09-23T14:55:05.473Z"
}
```

### 任务状态查询响应
```json
{
  "task_id": "1758610505473453",
  "status": "success",
  "url": "https://example.com/generated_video.mp4",
  "created_at": "2025-09-23T14:55:05.473Z",
  "completed_at": "2025-09-23T14:56:30.125Z"
}
```

### 错误响应
```json
{
  "error": {
    "message": "详细的错误描述",
    "code": "INVALID_REQUEST",
    "type": "client_error"
  }
}
```

## 🎯 最佳实践

1. **图片大小**: 建议单张图片不超过 10MB
2. **提示词长度**: 建议在 200 字符以内，过长可能被截断
3. **轮询间隔**: 建议每 3-5 秒查询一次状态
4. **超时设置**: 建议设置 5-10 分钟的超时时间
5. **错误重试**: 对于网络错误，建议实现指数退避重试策略