# 图生视频生成

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/video_generation:
    post:
      summary: 图生视频生成
      deprecated: false
      description: ''
      tags:
        - 视频模型/MiniMax视频模型
      parameters:
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                model:
                  type: string
                  x-apifox-mock: MiniMax-Hailuo-2.3
                  description: 可用值：MiniMax-Hailuo-2.3
                prompt:
                  type: string
                  description: >-
                    视频的文本描述，最大 2000 字符。对于 MiniMax-Hailuo-2.3
                    模型，支持使用 [指令] 语法进行运镜控制。

                    可在 prompt 中通过 [指令] 格式添加运镜指令，以实现精确的镜头控制。


                    支持 15 种运镜指令的指令:

                    左右移: [左移], [右移]

                    左右摇: [左摇], [右摇]

                    推拉: [推进], [拉远]

                    升降: [上升], [下降]

                    上下摇: [上摇], [下摇]

                    变焦: [变焦推近], [变焦拉远]

                    其他: [晃动], [跟随], [固定]

                    使用规则:

                    组合运镜: 同一组 [] 内的多个指令会同时生效，如 [左摇,上升]，建议组合不超过 3 个。

                    顺序运镜: prompt 中前后出现的指令会依次生效，如 "...[推进], 然后...[拉远]"。

                    自然语言: 也支持通过自然语言描述运镜，但使用标准指令能获得更准确的响应。
                duration:
                  type: integer
                resolution:
                  type: string
                  enum:
                    - 768P
                    - 1080P
                  x-apifox-enum:
                    - value: 768P
                      name: ''
                      description: ''
                    - value: 1080P
                      name: ''
                      description: ''
                first_frame_image:
                  type: string
                  description: >-
                    将指定图片作为视频的起始帧。支持公网 URL 或 Base64 编码的 Data URL
                    (data:image/jpeg;base64,...)。
                'prompt_optimizer ':
                  type: boolean
                  description: |+
                    是否自动优化 prompt，默认为 true。设为 false 可进行更精确的控制

              required:
                - model
                - prompt
                - first_frame_image
              x-apifox-orders:
                - model
                - prompt
                - duration
                - first_frame_image
                - resolution
                - 'prompt_optimizer '
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                required:
                  - id
                x-apifox-orders:
                  - id
              example:
                task_id: '106916112212032'
                base_resp:
                  status_code: 0
                  status_msg: success
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 视频模型/MiniMax视频模型
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-349752638-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```

## 使用指南

以下示例基于统一网关 `https://api.bltcy.ai`，请将 `YOUR_MINIMAX_KEY` 替换为实际凭证。所有请求均需要 `Authorization: Bearer <API_KEY>` 头。

### 1. 图生视频（单首帧）

```bash
curl -X POST "https://api.bltcy.ai/minimax/v1/video_generation" \
  -H "Authorization: Bearer YOUR_MINIMAX_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-Hailuo-2.3",
    "prompt": "蓝天白云下的现代公园，镜头沿着小径缓慢推进",
    "duration": 6,
    "resolution": "768P",
    "first_frame_image": "https://example.com/first-frame.jpg"
  }'
```

典型响应：

```json
{
  "task_id": "330838076482088",
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

记录返回的 `task_id` 用于后续查询。

### 2. 首尾帧生成（实验特性）

首尾帧模式需要使用支持该能力的模型，并额外传入 `mode` 和 `frame_images` 字段。示例：

```bash
curl -X POST "https://api.bltcy.ai/minimax/v1/video_generation" \
  -H "Authorization: Bearer YOUR_MINIMAX_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-Hailuo-2.3",
    "mode": "first_tail",
    "prompt": "从黎明到黄昏的城市航拍镜头",
    "duration": 6,
    "resolution": "768P",
    "frame_images": [
      "https://example.com/first-frame.jpg",
      "https://example.com/last-frame.jpg"
    ]
  }'
```

> ⚠️ 如果模型暂不支持该模式，会返回 `status_code: 2013`（`invalid params, model ... does not support First-and-Last-Frame-Video mode`）。此时需与平台确认已开通支持首尾帧的模型版本。

### 3. 任务状态查询

MiniMax 的查询接口为 `GET /minimax/v1/query/video_generation`，需携带 `task_id`。

```bash
curl "https://api.bltcy.ai/minimax/v1/query/video_generation?task_id=330838076482088" \
  -H "Authorization: Bearer YOUR_MINIMAX_KEY"
```

可能返回：

```json
{
  "base_resp": { "status_code": 0, "status_msg": "success" },
  "status": "Processing",
  "task_id": "330838076482088"
}
```

常见状态值：

- `Processing` / `Pending`：任务执行中；
- `Succeed` / `Finished`：生成完成，可获取视频地址；
- `Failed`：任务失败，详见返回的 `status_msg` 或 `error` 字段。

### 4. 获取视频链接

当任务完成时，响应中会包含视频及封面链接（字段可能位于 `result`、`task_result` 或 `data` 中）。示例：

```json
{
  "base_resp": { "status_code": 0, "status_msg": "success" },
  "status": "Succeed",
  "task_id": "330838076482088",
  "task_result": {
    "video_url": "https://example-cdn.com/video.mp4",
    "cover_image_url": "https://example-cdn.com/video-cover.jpg",
    "duration": 6,
    "resolution": "768P"
  }
}
```

前端在拿到 `video_url` 后即可渲染视频或提供下载。若需要首尾帧信息，可从 `frame_images` 字段中读取。

## 实测记录（2025-11-05）

- 使用 `MiniMax-Hailuo-2.3`、首帧图调用 `POST /minimax/v1/video_generation` 成功返回 `task_id: 330838076482088`；
- 通过 `GET /minimax/v1/query/video_generation?task_id=330838076482088` 查询任务状态，初始状态为 `Processing`；
- 首尾帧模式在该模型上返回 `status_code: 2013`，需确认具备相应模型后再调用。
- 在 `https://railway.lsaigc.com` 网关使用相同模型成功提交任务（`task_id: 330845071683684`），查询接口返回 `status: Preparing`。
- 若需要首尾帧模式，请使用 `MiniMax-Hailuo-02` 模型并确保同时提供首帧、尾帧图片。

> 注：以上测试均通过 `https://api.bltcy.ai` 网关完成，仅供调试参考。

# 首尾帧视频生成

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/video_generation:
    post:
      summary: 首尾帧视频生成
      deprecated: false
      description: |-
        MiniMax-Hailuo-02 模型 首尾帧视频生成功能
        新增“last_frame_image”参数，配合“first_frame_image”参数，来控制视频生成的起始与结束画面
        支持分辨率及时长：768P (6s，10s) 和 1080P (6s)
      tags:
        - 视频模型/MiniMax视频模型
      parameters:
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                model:
                  type: string
                  x-apifox-mock: MiniMax-Hailuo-2.3
                  description: 可用值：MiniMax-Hailuo-2.3
                prompt:
                  type: string
                duration:
                  type: integer
                resolution:
                  type: string
                  enum:
                    - 768P
                    - 1080P
                  x-apifox-enum:
                    - value: 768P
                      name: ''
                      description: ''
                    - value: 1080P
                      name: ''
                      description: ''
                first_frame_image:
                  type: string
                  description: >-
                    将指定图片作为视频的起始帧。支持公网 URL 或 Base64 编码的 Data URL
                    (data:image/jpeg;base64,...)。
                last_frame_image:
                  type: string
                  description: >-
                    将指定图片作为视频的结束帧。支持公网 URL 或 Base64 编码的 Data URL
                    (data:image/jpeg;base64,...)。
                'prompt_optimizer ':
                  type: boolean
                  description: |+
                    是否自动优化 prompt，默认为 true。设为 false 可进行更精确的控制

              required:
                - model
                - prompt
                - first_frame_image
                - last_frame_image
              x-apifox-orders:
                - model
                - prompt
                - duration
                - first_frame_image
                - last_frame_image
                - resolution
                - 'prompt_optimizer '
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                required:
                  - id
                x-apifox-orders:
                  - id
              example:
                task_id: '106916112212032'
                base_resp:
                  status_code: 0
                  status_msg: success
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 视频模型/MiniMax视频模型
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-349752186-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
# 视频任务状态查询

var myHeaders = new Headers();
myHeaders.append("Authorization", "Bearer {{YOUR_API_KEY}}");

var requestOptions = {
   method: 'GET',
   headers: myHeaders,
   redirect: 'follow'
};

fetch("/minimax/v1/query/video_generation?task_id={task_id}", requestOptions)
   .then(response => response.text())
   .then(result => console.log(result))
   .catch(error => console.log('error', error));


# 获取视频链接

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /minimax/v1/files/retrieve:
    get:
      summary: 获取视频链接
      deprecated: false
      description: ''
      tags:
        - 视频模型/MiniMax视频模型
      parameters:
        - name: file_id
          in: query
          description: ''
          required: true
          example: '302892389810432'
          schema:
            type: string
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  file:
                    type: object
                    properties:
                      file_id:
                        type: integer
                      bytes:
                        type: integer
                      created_at:
                        type: integer
                      filename:
                        type: string
                      purpose:
                        type: string
                      download_url:
                        type: string
                      backup_download_url:
                        type: string
                    required:
                      - file_id
                      - bytes
                      - created_at
                      - filename
                      - purpose
                      - download_url
                      - backup_download_url
                  base_resp:
                    type: object
                    properties:
                      status_code:
                        type: integer
                      status_msg:
                        type: string
                    required:
                      - status_code
                      - status_msg
                required:
                  - file
                  - base_resp
              example:
                file:
                  file_id: 302892389810432
                  bytes: 0
                  created_at: 1755501139
                  filename: output.mp4
                  purpose: video_generation
                  download_url: >-
                    https://public-cdn-video-data-algeng.oss-cn-wulanchabu.aliyuncs.com/inference_output%2Fvideo%2F2025-08-18%2F1bd7a87b-b486-46fe-9147-8639a199811f%2Foutput.mp4?Expires=1755538199&OSSAccessKeyId=LTAI5tAmwsjSaaZVA6cEFAUu&Signature=MnjwhtIuAyNXh%2BNgbwZxANiy3Ww%3D
                  backup_download_url: >-
                    https://public-cdn-video-data-algeng-us.oss-us-east-1.aliyuncs.com/inference_output%2Fvideo%2F2025-08-18%2F1bd7a87b-b486-46fe-9147-8639a199811f%2Foutput.mp4?Expires=1755538199&OSSAccessKeyId=LTAI5tCpJNKCf5EkQHSuL9xg&Signature=ErMN5N81FmtGvYFIlo37t2wtNho%3D
                base_resp:
                  status_code: 0
                  status_msg: success
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 视频模型/MiniMax视频模型
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-337525758-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
