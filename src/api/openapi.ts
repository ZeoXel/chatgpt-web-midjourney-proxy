import {
	gptConfigStore,
	gptServerStore,
	homeStore,
	useAuthStore,
} from "@/store";
import { mlog, myTrim } from "./mjapi";
import { fetchSSE } from "./sse/fetchsse";
import axios from "axios";
import { localGet, localSaveAny } from "./mjsave";
import { isNumber, isObject } from "@/utils/is";
import { t } from "@/locales";
import { ChatMessage } from "gpt-tokenizer/esm/GptEncoding";
import { chatSetting } from "./chat";
import { MessageApiInjection } from "naive-ui/es/message/src/MessageProvider";
import { ideoSubmit } from "./ideo";
import { saveImageToCOS } from "./imageStorage";
import { error } from "console";
//import {encode,  encodeChat}  from "gpt-tokenizer"
//import {encode,  encodeChat} from "gpt-tokenizer/cjs/encoding/cl100k_base.js";
//import { get_encoding } from '@dqbd/tiktoken'
//import FormData from 'form-data';

export const KnowledgeCutOffDate: Record<string, string> = {
	default: "2021-09",
	"gpt-4-1106-preview": "2023-04",
	"gpt-4-0125-preview": "2023-12",
	"gpt-4-vision-preview": "2023-04",
	"gpt-4-turbo-2024-04-09": "2023-12",
	"gpt-4o-2024-05-13": "2023-10",
	"o1-preview-2024-09-12": "2023-10",
	"o1-preview": "2023-10",
	o1: "2023-10",
	"o1-2024-12-17": "2023-10",
	"o1-mini": "2023-10",
	"o1-mini-2024-09-12": "2023-10",
	"gpt-4o": "2023-10",
	"gpt-4o-mini": "2023-10",
	"gpt-4o-mini-2024-07-18": "2023-10",
	"gpt-4o-2024-08-06": "2023-10", //chatgpt-4o-latest
	"chatgpt-4o-latest": "2023-10",
	"gpt-4o-2024-11-20": "2023-10",
	"gpt-4-turbo": "2023-12",
	"gpt-4-turbo-preview": "2023-12",
	"gpt-5.1": "2025-01",
	"claude-3-opus-20240229": "2023-08",
	"claude-3-sonnet-20240229": "2023-08",
	"claude-3-haiku-20240307": "2023-08",
	"claude-3-5-sonnet-20240620": "2024-04",
	"claude-3-5-sonnet-20241022": "2024-04",
	"claude-3-7-sonnet-20250219": "2024-04",
	"claude-sonnet-4-5-20250929": "2024-10",
	"gemini-pro": "2023-12",
	"gemini-pro-vision": "2023-12",
	"gpt-4.5-preview-2025-02-27": "2024-10",
	"gpt-4.5-preview": "2024-10",
	"deepseek-v3": "2023-12",
	"deepseek-r1": "2023-12",
	"gemini-pro-1.5": "2024-04",
	"gemini-3-pro-preview": "2025-01",
	"grok-4.1": "2024-10",
};

const getUrl = (url: string) => {
	if (url.indexOf("http") == 0) return url;
	if (gptServerStore.myData.OPENAI_API_BASE_URL) {
		return `${gptServerStore.myData.OPENAI_API_BASE_URL}${url}`;
	}
	return `/openapi${url}`;
};
export const gptGetUrl = getUrl;
export const gptFetch = (url: string, data?: any, opt2?: any) => {
	mlog("gptFetch", url);
	let headers = { "Content-Type": "application/json" };
	if (opt2 && opt2.headers) headers = opt2.headers;

	headers = { ...headers, ...getHeaderAuthorization() };
	return new Promise<any>((resolve, reject) => {
		let opt: RequestInit = { method: "GET" };
		opt.headers = headers;
		if (opt2?.upFile) {
			opt.method = "POST";
			opt.body = data as FormData;
		} else if (data) {
			opt.body = JSON.stringify(data);
			opt.method = "POST";
		}
		fetch(getUrl(url), opt)
			.then((d) =>
				d
					.json()
					.then((d) => resolve(d))
					.catch((e) => reject(e)),
			)
			.catch((e) => reject(e));
	});
};

export const regCookie = async (n: string) => {
	if (n == "") return;
	//mlog('regCookie:', n)
	let headers = { "Content-Type": "application/json", "x-vtoken": n };
	//headers={...headers,...getHeaderAuthorization()}
	let opt: RequestInit = { method: "GET" };
	opt.headers = headers;
	const ck = await new Promise<any>((resolve, reject) => {
		fetch("/api/reg", opt)
			.then((d) =>
				d
					.json()
					.then((d) => resolve(d))
					.catch((e) => reject(e)),
			)
			.catch((e) => reject(e));
	});
	homeStore.setMyData({ ctoken: ck.ctoken });

	mlog("regCookie:", ck, n);
};
// 前端直传 cloudflare r2
function uploadR2(file: File) {
	return new Promise<any>((resolve, reject) => {
		//预签名
		axios
			.post(
				gptGetUrl("/pre_signed"),
				{ file_name: file.name, content_type: file.type },
				{
					headers: { "Content-Type": "application/json" },
				},
			)
			.then((response) => {
				if (response.data.status == "Success") {
					const signedUrl = response.data.data.up;
					//上传
					fetch(signedUrl, {
						method: "PUT",
						body: file,
						headers: {
							"Content-Type": file.type,
						},
					})
						.then((res2) => {
							if (res2.ok) {
								console.log("Upload successful!", response.data.data.url);
								return resolve({ url: response.data.data.url });
							} else {
								return reject(res2);
							}
						})
						.catch((error) => {
							return reject(error);
						});
				} else {
					return reject(response.data);
				}
			})
			.catch((error) => reject(error));
	});
}

export const GptUploader = (_url: string, FormData: FormData) => {
	//R2上传
	const upLoaderR2 = () => {
		const file = FormData.get("file") as File;
		return uploadR2(file);
	};

	//执行上传
	const uploadNomalDo = (url: string, headers: any) => {
		return new Promise<any>((resolve, reject) => {
			axios
				.post(url, FormData, {
					headers,
				})
				.then((response) => resolve(response.data))
				.catch((error) => reject(error));
		});
	};

	//除R2外默认流程
	const uploadNomal = (url: string) => {
		url = gptServerStore.myData.UPLOADER_URL
			? gptServerStore.myData.UPLOADER_URL
			: gptGetUrl(url);
		let headers = { "Content-Type": "multipart/form-data" };
		if (
			gptServerStore.myData.OPENAI_API_BASE_URL &&
			url.indexOf(gptServerStore.myData.OPENAI_API_BASE_URL) > -1
		) {
			headers = { ...headers, ...getHeaderAuthorization() };
		} else {
			const authStore = useAuthStore();
			if (authStore.token) {
				const header2 = { "x-ptoken": authStore.token };
				headers = { ...headers, ...header2 };
			}
		}
		if (homeStore.myData.vtoken) {
			const vtokenh = { "x-vtoken": homeStore.myData.vtoken };
			headers = { ...headers, ...vtokenh };
		}
		return uploadNomalDo(url, headers);
	};

	//处理上传流程
	const allowR2 = homeStore.myData.session.isUploadR2 === true;
	const uploadType = (
		(homeStore.myData.session.uploadType ?? "") as string
	).toLocaleLowerCase();
	let headers = { "Content-Type": "multipart/form-data" };

	//R2
	if (allowR2 && uploadType == "r2") {
		return upLoaderR2();
		//容器
	} else if (uploadType == "container") {
		const authStore = useAuthStore();
		if (authStore.token) {
			const header2 = { "x-ptoken": authStore.token };
			headers = { ...headers, ...header2 };
		}
		let url = `/openapi${_url}`;
		return uploadNomalDo(url, headers);

		//前端API
	} else if (uploadType == "api") {
		headers = { ...headers, ...getHeaderAuthorization() };
		let url = `${gptServerStore.myData.OPENAI_API_BASE_URL}${_url}`;
		return uploadNomalDo(url, headers);

		//自定义链接
	} else if (uploadType == "myurl") {
		return uploadNomalDo(_url, headers);
	}

	//默认上传流程
	if (allowR2) {
		return upLoaderR2();
	}
	return uploadNomal(_url);
};

export const whisperUpload = (FormData: FormData) => {
	const url = gptGetUrl("/v1/audio/transcriptions");
	let headers = { "Content-Type": "multipart/form-data" };
	headers = { ...headers, ...getHeaderAuthorization() };
	return new Promise<any>((resolve, reject) => {
		axios
			.post(url, FormData, {
				headers,
			})
			.then((response) => resolve(response.data))
			.catch((error) => reject(error));
	});
};

//gpt 文件上传 /v1/image/edits
export const gptUploadFile = (url: string, FormData: FormData) => {
	url = gptGetUrl(url);
	let headers = { "Content-Type": "multipart/form-data" };
	headers = { ...headers, ...getHeaderAuthorization() };

	return axios.post(url, FormData, { headers });
};

/**
 * 获取 Assets API 路径
 * 开发环境: /api/api/assets (经过Vite代理重写)
 * 生产环境: /api/assets (Vercel Serverless Functions)
 */
function getAssetsApiPath(): string {
	const isDev =
		import.meta.env.DEV ||
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1";
	return isDev ? "/api/api/assets" : "/api/assets";
}

/**
 * 保存DALL-E（智能绘画）资产到数据库
 * 支持模型: nano-banana, nano-banana-2, doubao-seedream-4-0-250828, seedream-3.0
 */
async function saveDallAssetToDatabase(
	chat: Chat.Chat,
	requestData: any,
): Promise<void> {
	if (!homeStore.myData.session?.isDatabaseEnabled) {
		return;
	}
	try {
		// 获取用户的API Key
		const apiKey = gptServerStore.myData.OPENAI_API_KEY;
		console.log("[DALL-E Asset Save] 调试信息:", {
			hasApiKey: !!apiKey,
			apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : "null",
			gptServerStoreKeys: Object.keys(gptServerStore.myData),
		});

		if (!apiKey) {
			console.warn("[DALL-E Asset Save] 未配置API Key，跳过保存");
			return;
		}

		// 只保存允许的模型
		const allowedModels = [
			"nano-banana",
			"nano-banana-2",
			"doubao-seedream-4-0-250828",
			"seedream-3.0",
		];
		if (!chat.model || !allowedModels.includes(chat.model)) {
			console.log("[DALL-E Asset Save] ⏭️ 跳过不支持的模型:", chat.model);
			return;
		}

		// 构建资产数据
		const assetData = {
			service: "dall-e", // 统一使用 dall-e 作为服务标识
			type: "image",
			asset_data: {
				model: chat.model,
				size: requestData.size,
				quality: requestData.quality,
				revised_prompt: chat.text, // API返回的修订后的prompt
				timestamp: new Date().toISOString(),
			},
			task_id: chat.myid,
			main_url: chat.opt?.imageUrl,
			prompt: requestData.prompt, // 用户原始输入的prompt
		};

		console.log("[DALL-E Asset Save] 保存数据:", {
			myid: chat.myid,
			model: chat.model,
			prompt: assetData.prompt?.substring(0, 50) + "...",
			main_url: assetData.main_url ? "有" : "无",
		});

		// 调用后端API
		const apiPath = getAssetsApiPath();
		const response = await fetch(apiPath, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(assetData),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				`API error: ${response.status} - ${JSON.stringify(error)}`,
			);
		}

		const result = await response.json();
		console.log("[DALL-E Asset Save] ✅ 保存成功:", result.asset?.id);
	} catch (error) {
		console.error("[DALL-E Asset Save] ❌ 保存失败:", error);
		throw error;
	}
}

/**
 * 从数据库获取DALL-E（智能绘画）资产列表
 * 返回用户的历史生成记录
 */
export async function getDallAssetsFromDatabase(options?: {
	limit?: number;
	offset?: number;
}): Promise<any[]> {
	if (!homeStore.myData.session?.isDatabaseEnabled) {
		return [];
	}
	console.log("[DALL-E Asset Load] 🌐 开始从数据库加载资产...");

	try {
		const apiKey = gptServerStore.myData.OPENAI_API_KEY;
		if (!apiKey) {
			console.warn("[DALL-E Asset Load] ⚠️ 未配置API Key，跳过数据库读取");
			return [];
		}

		const params = new URLSearchParams({
			service: "dall-e",
			type: "image",
			limit: (options?.limit || 100).toString(),
			offset: (options?.offset || 0).toString(),
		});

		const apiPath = getAssetsApiPath();
		console.log("[DALL-E Asset Load] 请求路径:", `${apiPath}?${params}`);

		const response = await fetch(`${apiPath}?${params}`, {
			method: "GET",
			headers: {
				"x-api-key": apiKey,
			},
		});

		console.log(
			"[DALL-E Asset Load] 响应状态:",
			response.status,
			response.statusText,
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("[DALL-E Asset Load] API错误响应:", errorText);
			throw new Error(`API error: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		console.log(
			`[DALL-E Asset Load] ✅ 从数据库加载 ${result.assets?.length || 0} 个资产`,
		);

		if (result.assets && result.assets.length > 0) {
			console.log("[DALL-E Asset Load] 第一个资产示例:", {
				id: result.assets[0].id,
				model: result.assets[0].asset_data?.model,
				prompt: result.assets[0].prompt?.substring(0, 30) + "...",
				created_at: result.assets[0].created_at,
			});
		}

		return result.assets || [];
	} catch (error) {
		console.error("[DALL-E Asset Load] ❌ 加载失败:", error);
		return [];
	}
}

/**
 * 将传统尺寸格式转换为 aspect_ratio 格式
 * 例如: "1024x1024" -> "1:1", "1792x1024" -> "16:9"
 */
const convertSizeToAspectRatio = (size: string): string => {
	// 如果本身就是比例字符串（如 "4:3"），直接返回
	if (size.includes(":")) return size;

	const sizeMap: Record<string, string> = {
		// 即梦新标准尺寸 (高分辨率)
		"2048x2048": "1:1",
		"2304x1728": "4:3",
		"1728x2304": "3:4",
		"2560x1440": "16:9",
		"1440x2560": "9:16",
		// 原有尺寸映射
		"1024x1024": "1:1",
		"1536x1024": "3:2", // 4:3 和 3:2 都映射到这个尺寸
		"1024x1536": "2:3", // 3:4 和 2:3 都映射到这个尺寸
		"1792x1024": "16:9",
		"1024x1792": "9:16",
		"1920x1080": "21:9",
		// 其他常见尺寸
		"512x512": "1:1",
		"256x256": "1:1",
		"1280x720": "16:9",
		"720x1280": "9:16",
	};
	return sizeMap[size] || "1:1"; // 默认返回 1:1
};

/**
 * 将 quality 参数转换为 image_size (仅 nano-banana-2 支持)
 * 注意: nano-banana 不支持 image_size 参数
 */
const convertQualityToImageSize = (
	quality: string,
	model: string,
): string | undefined => {
	if (model !== "nano-banana-2") {
		return undefined; // 仅 nano-banana-2 支持 image_size
	}
	const qualityMap: Record<string, string> = {
		high: "4K",
		medium: "2K",
		low: "1K",
		hd: "4K",
		standard: "2K",
	};
	return qualityMap[quality] || "2K";
};

export const subGPT = async (data: any, chat: Chat.Chat) => {
	let d: any;
	let action = data.action;
	// mlog("gp-image-1 base64Array ",   data.base64Array   )
	//chat.myid=  `${Date.now()}`;
	if (
		action == "gpt.dall-e-3" &&
		data.data &&
		data.data.model &&
		(data.data.model === "nano-banana" ||
			data.data.model === "nano-banana-2" ||
			data.data.model === "doubao-seedream-4-0-250828" ||
			data.data.model === "seedream-3.0")
	) {
		// 智能绘画系列
		mlog("智能绘画请求数据 ", data.data);

		// 判断是使用 generations 还是 edits 端点
		let endpoint = "/v1/images/generations";
		let hasImage = false;
		let requestData: any;
		let useFormData = false;

		// 转换参数
		// 即梦与 nano-banana 统一使用 aspect_ratio 映射，
		// 但即梦模型仍然保留 size 以兼容现有网关实现
		const isSeeDream = data.data.model === "doubao-seedream-4-0-250828" || data.data.model === "seedream-3.0";
		const aspectRatio = data.data.size
			? convertSizeToAspectRatio(data.data.size)
			: "1:1";
		const imageSize = data.data.quality
			? convertQualityToImageSize(data.data.quality, data.data.model)
			: undefined;

		// 如果有上传的图片，使用 edits 端点
		if (data.data.base64Array && data.data.base64Array.length > 0) {
			endpoint = "/v1/images/edits";
			hasImage = true;
			useFormData = true; // edits端点需要FormData

			mlog(
				"nano-banana 包含参考图片:",
				data.data.base64Array.length,
				"张，将使用 /v1/images/edits 端点",
			);

			// 创建FormData对象
			const formData = new FormData();
			formData.append("model", data.data.model);
			formData.append("prompt", data.data.prompt);
			formData.append("response_format", "url");

			// 尺寸参数
			// 即梦模型: 同时传入 size 与 aspect_ratio，兼容新尺寸比例
			// nano-banana 系列: 仅使用 aspect_ratio
			if (isSeeDream) {
				formData.append("size", data.data.size || "1024x1024");
				formData.append("aspect_ratio", aspectRatio);
			} else {
				formData.append("aspect_ratio", aspectRatio);
			}

			// 添加 image_size (仅 nano-banana-2)
			if (imageSize) {
				formData.append("image_size", imageSize);
			}

			// 处理所有图片数据（支持多图参考）
			for (let i = 0; i < data.data.base64Array.length; i++) {
				const imageItem = data.data.base64Array[i];
				if (imageItem && imageItem.base64) {
					// 将base64转换为Blob
					let base64Data = imageItem.base64;
					if (base64Data.includes(",")) {
						base64Data = base64Data.split(",")[1];
					}

					// 将base64转换为Blob
					const byteCharacters = atob(base64Data);
					const byteNumbers = new Array(byteCharacters.length);
					for (let j = 0; j < byteCharacters.length; j++) {
						byteNumbers[j] = byteCharacters.charCodeAt(j);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: "image/png" });

					// 添加图片到FormData（使用相同字段名 "image"）
					formData.append("image", blob, `image${i}.png`);
				}
			}
			mlog(
				`nano-banana 已将 ${data.data.base64Array.length} 张图片转换为Blob并添加到FormData`,
			);

			requestData = formData;
		} else {
			// 没有图片时使用JSON格式（Generations端点）
			requestData = {
				model: data.data.model,
				prompt: data.data.prompt,
				response_format: "url",
			};

			// 尺寸参数
			// 即梦模型: 同时传入 size 与 aspect_ratio，兼容新尺寸比例
			// nano-banana 系列: 仅使用 aspect_ratio
			if (isSeeDream) {
				requestData.size = data.data.size || "1024x1024";
				requestData.aspect_ratio = aspectRatio;
			} else {
				requestData.aspect_ratio = aspectRatio;
			}

			// 添加 image_size (仅 nano-banana-2)
			if (imageSize) {
				requestData.image_size = imageSize;
			}

			// 如果有参考图的URL数组，添加到请求中
			if (data.data.imageUrls && data.data.imageUrls.length > 0) {
				requestData.image = data.data.imageUrls;
			}
		}

		try {
			mlog(
				`nano-banana 即将发起请求到 ${endpoint}:`,
				useFormData ? "FormData格式" : requestData,
			);

			// 根据是否使用FormData调用不同的方法
			let d;
			if (useFormData) {
				// FormData需要特殊处理
				d = await gptFetch(endpoint, requestData, {
					upFile: true,
					headers: {},
				});
			} else {
				d = await gptFetch(endpoint, requestData);
			}
			mlog("nano-banana 返回结果 ", d);

			// 验证响应数据结构
			if (!d || !d.data || !Array.isArray(d.data) || d.data.length === 0) {
				mlog("即梦绘图 响应数据格式错误:", d);
				throw new Error(`响应数据格式错误: ${JSON.stringify(d)}`);
			}

			mlog(`✅ 即梦绘图收到响应，图片数量: ${d.data.length}`, d.data);

			// 无论单图还是多图，统一处理为 imageUrls 数组
			const imageUrls = d.data.map((item: any) => ({
				url: item.url || "https://www.openai-hk.com/res/img/open.png",
			}));

			mlog(`✅ 生成 imageUrls 数组:`, imageUrls);

			// 设置聊天对象
			chat.text =
				d.data[0].revised_prompt ??
				`${data.data.model} 成功生成 ${d.data.length} 张图片`;
			chat.opt = {
				imageUrls: imageUrls,
				imageUrl: imageUrls[0]?.url, // 同时保留单图字段兼容性
			};
			chat.loading = false;

			mlog(`✅ 最终 chat.opt:`, JSON.stringify(chat.opt, null, 2));

			// 更新到前端
			homeStore.setMyData({ act: "updateChat", actData: chat });
			mlog(`✅ 已触发 updateChat 事件`);

			// 保存所有图片到数据库和COS
			for (let i = 0; i < d.data.length; i++) {
				const imgData = d.data[i];
				const imgChat = {
					...chat,
					myid: i === 0 ? chat.myid : `${chat.myid}_${i}`,
					opt: { imageUrl: imgData.url },
				};
				saveDallAssetToDatabase(imgChat, data.data).catch((err) => {
					console.warn(`[DALL-E Asset Save] 保存第${i + 1}张图片到数据库失败:`, err);
				});

				// 保存到COS
				saveImageToCOS({
					id: imgChat.myid,
					service: data.data.model || 'dall-e-3',
					model: data.data.model,
					prompt: data.data.prompt,
					original_url: imgData.url,
					status: 'success',
					created_at: new Date().toISOString(),
					metadata: {
						revised_prompt: imgData.revised_prompt,
						size: data.data.size,
						quality: data.data.quality,
					}
				}).catch((err) => {
					console.warn(`[Image COS Save] 保存第${i + 1}张图片到COS失败:`, err);
				});
			}
		} catch (e: any) {
			mlog("nano-banana 请求失败", e);

			// 确保loading状态被正确清除
			chat.loading = false;

			// 解析错误信息，提供更友好的提示
			let errorMessage = `${data.data.model} 请求失败！\n`;
			let errorDetail = "";

			if (e && typeof e === "object") {
				// 解析 API 错误响应
				const errorData = e.response?.data || e;

				if (errorData.error) {
					const apiError = errorData.error;

					// 处理常见错误类型
					if (apiError.code === "model_not_found") {
						errorMessage += "❌ 模型不可用\n";
						errorDetail = `分组中没有可用的 ${data.data.model} 模型渠道。\n`;
						errorDetail += "💡 请检查:\n";
						errorDetail += "1. API Key 是否有效\n";
						errorDetail += "2. 账户是否有余额\n";
						errorDetail += "3. 模型是否在当前分组中启用\n";
					} else if (apiError.code === "insufficient_quota") {
						errorMessage += "❌ 余额不足\n";
						errorDetail = "账户余额不足，无法继续使用图片生成服务。";
					} else if (apiError.code === "invalid_api_key") {
						errorMessage += "❌ API Key 无效\n";
						errorDetail = "请检查 API Key 配置是否正确。";
					} else {
						errorMessage += `❌ ${apiError.type || "未知错误"}\n`;
						errorDetail = apiError.message || "请求失败，请稍后重试。";
					}

					// 添加 request_id 用于排查
					if (apiError.message && apiError.message.includes("request id:")) {
						const requestIdMatch = apiError.message.match(
							/request id: ([\w]+)/,
						);
						if (requestIdMatch) {
							errorDetail += `\n\n🔍 Request ID: ${requestIdMatch[1]}`;
						}
					}
				} else if (e.message) {
					errorDetail = e.message;
				} else {
					errorDetail = "未知错误，请稍后重试。";
				}
			} else {
				errorDetail = String(e);
			}

			chat.text = errorMessage + errorDetail;
			chat.error = true; // 标记为错误状态

			// 强制更新UI
			homeStore.setMyData({ act: "updateChat", actData: chat });

			// 额外的状态重置，确保UI响应
			setTimeout(() => {
				homeStore.setMyData({ act: "forceUpdate" });
			}, 100);

			// 抛出错误以便上层捕获
			throw new Error(errorMessage + errorDetail);
		}
	} else if (
		action == "gpt.dall-e-3" &&
		data.data &&
		data.data.model &&
		data.data.model.indexOf("ideogram") > -1
	) {
		//ideogram
		mlog("ddlog 数据 ", data.data);
		try {
			let d = await ideoSubmit(data.data);
			mlog("ddlog 数据返回 ", d);
			const rz = d[0];
			chat.text = rz.prompt; //rz.p??`图片已完成`;
			chat.opt = { imageUrl: rz.url };
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		} catch (e) {
			//chat.text='失败！'+"\n```json\n"+JSON.stringify(d, null, 2)+"\n```\n";
			chat.text = "失败！" + "\n```json\n" + e + "\n```\n";
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		}
	} else if (action == "gpt.dall-e-3" && data.data.base64Array != undefined) {
		//执行变化
		mlog("gp-image-1 base64Array ", data.data, data.data.base64Array);
		//let d= await gptFetch('/v1/images/edits', data.data);
		const formData = new FormData();
		for (let o in data.data) {
			if (o == "base64Array") {
				for (let f of data.data.base64Array) {
					formData.append("image[]", f.file);
				}
			} else {
				formData.append(o, data.data[o]);
			}
		}
		mlog("formData  ", formData);

		//const jda=    upd.data
		try {
			const ds = await gptUploadFile("/v1/images/edits", formData);
			const d = ds.data;
			if (ds.status != 200) throw "Fail with status:" + ds.status;
			//const d= jda;
			//mlog("gp-image-1 结果 ",  d   )

			let key = "dall:" + chat.myid;
			const rz: any = d.data[0];
			if (rz.b64_json) {
				const base64 = "data:image/png;base64," + rz.b64_json;
				await localSaveAny(base64, key);
			}

			chat.text = rz.revised_prompt ?? `图片已完成`;
			chat.opt = {
				imageUrl: rz.url
					? rz.url
					: "https://www.openai-hk.com/res/img/open.png",
			};
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		} catch (e) {
			chat.text =
				"失败！" +
				"\n```json\n" +
				(d ? JSON.stringify(d, null, 2) : e) +
				"\n```\n";
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		}
	} else if (action == "gpt.dall-e-3") {
		//执行变化
		// chat.model= 'dall-e-3';

		let d = await gptFetch("/v1/images/generations", data.data);
		try {
			const rz: any = d.data[0];
			let key = "dall:" + chat.myid;

			if (rz.b64_json) {
				const base64 = "data:image/png;base64," + rz.b64_json;
				await localSaveAny(base64, key);
			}
			chat.text = rz.revised_prompt ?? `图片已完成`;
			chat.opt = {
				imageUrl: rz.url
					? rz.url
					: "https://www.openai-hk.com/res/img/open.png",
			};
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		} catch (e) {
			//chat.text='失败！'+"\n```json\n"+JSON.stringify(d, null, 2)+"\n```\n";
			chat.text =
				"失败！" +
				"\n```json\n" +
				(d ? JSON.stringify(d, null, 2) : e) +
				"\n```\n";
			chat.loading = false;
			homeStore.setMyData({ act: "updateChat", actData: chat });
		}
	}
};

export const isDallImageModel = (model: string | undefined) => {
	if (!model) return false;
	if (model.indexOf("flux") > -1) return true;
	if (model.indexOf("ideogram") > -1) return true;
	if (model.indexOf("gpt-image") > -1) return true;
	if (model === "nano-banana" || model === "nano-banana-2") return true;
	if (model.indexOf("seedream") > -1) return true;
	return ["dall-e-2", "dall-e-3", "ideogram"].indexOf(model) > -1;
};

interface subModelType {
	message: any[];
	onMessage: (d: { text: string; isFinish: boolean; isAll?: boolean }) => void;
	onError?: (d?: any) => void;
	signal?: AbortSignal;
	model?: string;
	uuid?: string | number;
}
function getHeaderAuthorization() {
	let headers = {};
	if (homeStore.myData.vtoken) {
		const vtokenh = {
			"x-vtoken": homeStore.myData.vtoken,
			"x-ctoken": homeStore.myData.ctoken,
		};
		headers = { ...headers, ...vtokenh };
	}
	if (!gptServerStore.myData.OPENAI_API_KEY) {
		const authStore = useAuthStore();
		if (authStore.token) {
			const bmi = { "x-ptoken": authStore.token };
			headers = { ...headers, ...bmi };
			return headers;
		}
		return headers;
	}
	const bmi = {
		Authorization: "Bearer " + gptServerStore.myData.OPENAI_API_KEY,
	};
	headers = { ...headers, ...bmi };
	return headers;
}

export const getSystemMessage = (uuid?: number) => {
	//KnowledgeCutOffDate
	let sysTem = gptConfigStore.myData.systemMessage;
	if (uuid) {
		const chatS = new chatSetting(uuid);
		sysTem = chatS.getGptConfig().systemMessage;
	}
	if (sysTem) return sysTem;
	let model = gptConfigStore.myData.model
		? gptConfigStore.myData.model
		: "gpt-5";
	let producer = "You are ChatGPT, a large language model trained by OpenAI.";
	if (model.includes("claude"))
		producer = "You are Claude, a large language model trained by Anthropic.";
	if (model.includes("gemini"))
		producer = "You are Gemini, a large language model trained by Google.";
	if (model.includes("deepseek"))
		producer = "You are DeepSeek, a large language model trained by DeepSeek.";
	if (model.includes("grok"))
		producer = "You are grok, a large language model trained by xAi.";
	//用户自定义系统
	if (homeStore.myData.session.systemMessage)
		producer = homeStore.myData.session.systemMessage;

	let DEFAULT_SYSTEM_TEMPLATE = `${producer}`;

	if (KnowledgeCutOffDate[model] || model.indexOf("gpt-") > -1)
		DEFAULT_SYSTEM_TEMPLATE += `
Knowledge cutoff: ${KnowledgeCutOffDate[model] ?? KnowledgeCutOffDate.default}`;
	DEFAULT_SYSTEM_TEMPLATE += `
Current model: ${model}
Current time: ${new Date().toLocaleString()}
Latex inline: $x^2$
Latex block: $$e=mc^2$$`;
	return DEFAULT_SYSTEM_TEMPLATE;
};

export const isNewModel = (model: string) => {
	// 已不再区分模型，所有 Chat 请求统一走非流式路径
	// 保留函数以兼容现有调用，但始终返回 true
	return true;
};
export const subModel = async (opt: subModelType) => {
	//
	let model =
		opt.model ??
		(gptConfigStore.myData.model ? gptConfigStore.myData.model : "gpt-5");
	let max_tokens = gptConfigStore.myData.max_tokens;
	let temperature = 0.5;
	let top_p = 1;
	let presence_penalty = 0,
		frequency_penalty = 0;
	if (opt.uuid) {
		const chatSet = new chatSetting(+opt.uuid);
		const gStore = chatSet.getGptConfig();
		temperature = gStore.temperature ?? temperature;
		top_p = gStore.top_p ?? top_p;
		presence_penalty = gStore.presence_penalty ?? presence_penalty;
		frequency_penalty = gStore.frequency_penalty ?? frequency_penalty;
		max_tokens = gStore.max_tokens;
	}
	if (model == "gpt-4-vision-preview" && max_tokens > 4096) max_tokens = 4096;

	//gptServerStore.myData.GPTS_GX
	if (gptServerStore.myData.GPTS_GX) {
		model = model.replace("gpt-4-gizmo-", "");
	}

	// 统一使用非流式调用，所有 Chat 请求都从 /v1/chat/completions 一次性获取完整结果
	// 为兼容不同网关/模型，实现如下策略：
	// 1. 对所有模型使用标准的 max_tokens
	// 2. 对 gpt-5* / o1-* 额外附加 max_completion_tokens，保证新模型也能正常工作
	const body: any = {
		max_tokens,
		model,
		//temperature,
		top_p,
		presence_penalty,
		frequency_penalty,
		messages: opt.message,
		stream: false,
	};
	if (model.startsWith('gpt-5') || model.startsWith('o1-'))
		body.max_completion_tokens = max_tokens;
	try {
		mlog("🐞非流输出", body);
		opt.onMessage({ text: t("mj.thinking"), isFinish: false });
		const obj: any = await gptFetch("/v1/chat/completions", body);
		//mlog('结果 >>',obj   )
		opt.onMessage({
			text: obj?.choices?.[0]?.message?.content ?? "",
			isFinish: true,
			isAll: true,
		});
	} catch (error) {
		mlog("❌未错误2", error);
		opt.onError && opt.onError(error);
	}
};

export const getInitChat = (txt: string) => {
	let promptMsg: Chat.Chat = {
		dateTime: new Date().toLocaleString(),
		text: txt,
		inversion: true,
		error: false,
		conversationOptions: null,
		requestOptions: { prompt: txt, options: null },
	};
	return promptMsg;
};

export interface ttsType {
	model: string;
	input: string;
	voice?: string;
}
export const subTTS = async (tts: ttsType) => {
	if (!tts.voice) tts.voice = "alloy";
	let url = getUrl("/v1/audio/speech");
	let headers = {
		"Content-Type": "application/json",
	};
	headers = { ...headers, ...getHeaderAuthorization() };
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(tts),
	});

	if (!response.ok) {
		throw new Error(`API request failed with status ${response.status}`);
	}
	const audioData = await response.arrayBuffer();
	const contentType = response.headers.get("Content-Type");
	const blob = new Blob([audioData], { type: contentType ?? "audio/mpeg" });
	mlog("blob", blob);
	const saveID = await localSaveAny(blob);
	const pp = await bolbObj(blob);
	return { blob, saveID, ...pp };
};

export const bolbObj = (blob: Blob) => {
	return new Promise<{ player: HTMLAudioElement; duration: number }>(
		(resolve, reject) => {
			const player = new window.Audio();
			player.src = URL.createObjectURL(blob);

			player.addEventListener("loadedmetadata", () => {
				mlog("时长", player.duration);
				resolve({ player, duration: player.duration });
			});
			player.addEventListener("error", (e) => {
				reject(e);
			});
			player.load();
		},
	);
};

function formatDate(): string[] {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1;
	const lastDay = new Date(year, month, 0);
	const formattedFirstDay = `${year}-${month.toString().padStart(2, "0")}-01`;
	const formattedLastDay = `${year}-${month.toString().padStart(2, "0")}-${lastDay.getDate().toString().padStart(2, "0")}`;
	return [formattedFirstDay, formattedLastDay];
}

//

export const gptUsage = async () => {
	// fetch(getUrl(url),  opt )
	//     .then(d=>d.json().then(d=> resolve(d))
	//     .catch(e=>reject(e)))
	//     .catch(e=>reject(e))
	const [startDate, endDate] = formatDate();
	const urlUsage = `/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`;
	const usageData = await gptFetch(urlUsage);
	const billData = await gptFetch("/v1/dashboard/billing/subscription");

	const usage = Math.round(usageData.total_usage) / 100;
	mlog("gpt", usage, billData);
	//remaining = subscriptionData.system_hard_limit_usd - totalUsage;
	return {
		usage,
		remaining:
			Math.round(
				(billData.hard_limit ?? billData.hard_limit_usd * 100) -
					usageData.total_usage,
			) / 100,
		hard_limit_usd: billData.hard_limit_usd,
	};
};

export const openaiSetting = (q: any, ms: MessageApiInjection) => {
	//mlog()
	mlog("setting", q);

	// 处理hasBalance参数（iframe现传入具体余额数值）
	if (q.hasBalance !== undefined) {
		const rawBalance = q.hasBalance;
		const balanceAmount =
			typeof rawBalance === "number" ? rawBalance : Number(rawBalance);
		let hasBalance = true;

		if (!Number.isNaN(balanceAmount)) {
			hasBalance = balanceAmount > 0;
			homeStore.setMyData({
				hasBalance,
				balanceAmount,
				balanceNeedsLogin: false,
			});
			mlog("hasBalance设置为:", hasBalance, "余额:", balanceAmount);
		} else {
			// 兼容旧的布尔字符串传参
			hasBalance = String(rawBalance).toLowerCase() === "true";
			homeStore.setMyData({
				hasBalance,
				balanceAmount: hasBalance ? 1 : 0,
				balanceNeedsLogin: false,
			});
			mlog("hasBalance布尔兼容模式，状态:", hasBalance);
		}

		// hasBalance状态已设置，由BalanceWarning组件统一处理UI提示
	}

	// 未登录：URL 中既没有密钥也没有余额信息
	// 重要：只在首次检测到缺少凭据且当前没有有效登录状态时才触发
	const isIframe = typeof window !== "undefined" && window.self !== window.top;
	const missingPortalCredentials =
		isIframe && !Reflect.has(q, "hasBalance") && !Reflect.has(q, "settings");

	// 防止路由切换时误触发：只有在真正未登录时才重置状态
	// 如果 balanceNeedsLogin 已经是 false，说明用户之前已成功传递凭据，不应重置
	const shouldResetToNeedsLogin =
		missingPortalCredentials &&
		homeStore.myData.balanceNeedsLogin !== false &&
		homeStore.myData.balanceAmount === 0;

	if (shouldResetToNeedsLogin) {
		homeStore.setMyData({
			hasBalance: false,
			balanceAmount: 0,
			balanceWarningDismissed: false,
			balanceNeedsLogin: true,
		});
		gptServerStore.setInit();
	}

	if (q.settings) {
		mlog("q.setting", q.settings);
		try {
			let obj = JSON.parse(q.settings);
			const url = obj.url ?? undefined;
			const key = obj.key ?? undefined;
			//let setQ= { }
			gptServerStore.setMyData({
				OPENAI_API_BASE_URL: url,
				MJ_SERVER: url,
				SUNO_SERVER: url,
				LUMA_SERVER: url,
				RUNWAY_SERVER: url,
				VIGGLE_SERVER: url,
				IDEO_SERVER: url,
				KLING_SERVER: url,
				MINIMAX_SERVER: url,
				PIKA_SERVER: url,
				UDIO_SERVER: url,
				PIXVERSE_SERVER: url,
				RIFF_SERVER: url,
				VIDU_SERVER: url,

				OPENAI_API_KEY: key,
				MJ_API_SECRET: key,
				SUNO_KEY: key,
				LUMA_KEY: key,
				RUNWAY_KEY: key,
				VIGGLE_KEY: key,
				IDEO_KEY: key,
				KLING_KEY: key,
				MINIMAX_KEY: key,
				PIKA_KEY: key,
				UDIO_KEY: key,
				PIXVERSE_KEY: key,
				RIFF_KEY: key,
				VIDU_KEY: key,
			});
			blurClean();
			gptServerStore.setMyData(gptServerStore.myData);
			ms.success("设置服务端成功！");
		} catch (error) {}
	} else if (isObject(q)) {
		mlog("setting2", q);
		gptServerStore.setMyData(q);
		//gptServerStore.setMyData( gptServerStore.myData );
		blurClean();
		gptServerStore.setMyData(gptServerStore.myData);
	}

	// 处理UUID参数
	if (q.uuid) {
		mlog("q.uuid", q.uuid);
		const uuid = String(q.uuid).trim();
		// 验证UUID格式
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (uuidRegex.test(uuid)) {
			gptServerStore.setMyData({ USER_UUID: uuid });
			mlog("UUID已保存:", uuid);
		} else {
			mlog("UUID格式无效:", uuid);
		}
	}
};
export const blurClean = () => {
	mlog("blurClean");
	gptServerStore.myData.OPENAI_API_BASE_URL = myTrim(
		myTrim(gptServerStore.myData.OPENAI_API_BASE_URL.trim(), "/"),
		"\\",
	);
	gptServerStore.myData.OPENAI_API_KEY =
		gptServerStore.myData.OPENAI_API_KEY.trim();
	gptServerStore.myData.MJ_SERVER = myTrim(
		myTrim(gptServerStore.myData.MJ_SERVER.trim(), "/"),
		"\\",
	);
	gptServerStore.myData.MJ_API_SECRET =
		gptServerStore.myData.MJ_API_SECRET.trim();
	gptServerStore.myData.UPLOADER_URL = myTrim(
		myTrim(gptServerStore.myData.UPLOADER_URL.trim(), "/"),
		"\\",
	);
	// 清理UUID
	if (gptServerStore.myData.USER_UUID) {
		gptServerStore.myData.USER_UUID = gptServerStore.myData.USER_UUID.trim();
	}
};

export const countTokens = async (
	dataSources: Chat.Chat[],
	input: string,
	uuid: number,
) => {
	const chatSet = new chatSetting(uuid);
	const myStore = chatSet.getGptConfig();
	let rz = {
		system: 0,
		input: 0,
		history: 0,
		remain: 330,
		modelTokens: "4k",
		planOuter: myStore.max_tokens,
	};
	const model = myStore.model;
	const max = getModelMax(model);
	let unit = 1024;
	if (model == "gpt-4-1106-preview" || model == "gpt-4-vision-preview")
		unit = 1000;
	//gpt-4-turbo-2024-04-09
	if (model.indexOf("gpt-4-turbo") > -1) unit = 1000;
	rz.modelTokens = `${max}k`;
	//cl100k_base.encode(input)

	const encode = await encodeAsync();
	rz.input = encode(input).length;
	rz.system = encode(getSystemMessage()).length;
	const encodeChat = await encodeChatAsync();
	const msg = await getHistoryMessage(dataSources, 1);
	rz.history =
		msg.length == 0
			? 0
			: encodeChat(msg, model.indexOf("gpt-4") > -1 ? "gpt-4" : "gpt-3.5-turbo")
					.length;
	//
	rz.remain = unit * max - rz.history - rz.planOuter - rz.input - rz.system;

	return rz;
};
const getModelMax = (model: string) => {
	let max = 4;
	model = model.toLowerCase();
	if (model.indexOf("8k") > -1) {
		return 8;
	} else if (
		model.indexOf("16k") > -1 ||
		model == "gpt-3.5-turbo-1106" ||
		model == "gpt-3.5-turbo-0125"
	) {
		return 16;
	} else if (model.indexOf("32k") > -1) {
		return 32;
	} else if (model.indexOf("grok") > -1) {
		return 128;
	} else if (
		model.indexOf("gpt-4.5") > -1 ||
		model.indexOf("gpt-4-turbo") > -1 ||
		model.indexOf("gpt-4o") > -1 ||
		model.indexOf("o1-") > -1
	) {
		return 128;
	} else if (model.indexOf("gpt-5") > -1) {
		return 128; // GPT-5系列支持128K上下文
	} else if (model.indexOf("64k") > -1 || model.indexOf("deepseek") > -1) {
		return 64;
	} else if (
		model.indexOf("128k") > -1 ||
		model == "gpt-4-1106-preview" ||
		model == "gpt-4-0125-preview" ||
		model == "gpt-4-vision-preview"
	) {
		return 128;
	} else if (model.indexOf("gpt-4") > -1) {
		max = 8;
	} else if (model.toLowerCase().includes("claude-3")) {
		//options.maxModelTokens = 120*1024;
		//options.maxResponseTokens = 4096
		return 120;
	}

	return max;
};

export const encodeAsync = async () => {
	const { encode } = await import("gpt-tokenizer");

	return encode; //(str).length;
};
export const encodeChatAsync = async () => {
	const { encodeChat } = await import("gpt-tokenizer");

	return encodeChat; //(obj,model ).length;
};

export const getHistoryMessage = async (
	dataSources: Chat.Chat[],
	loadingCnt = 1,
	start = 1000,
) => {
	let i = 0;
	let rz: ChatMessage[] = [];
	//const loadingCnt= 1;// 1就是没有loading，3 就是有loading
	let istart =
		isNumber(start) && start >= 0
			? Math.min(start, dataSources.length - loadingCnt)
			: dataSources.length - loadingCnt;
	mlog("istart", istart, start);
	for (let ii = istart; ii >= 0; ii--) {
		//let o of dataSources.value
		if (i >= gptConfigStore.myData.talkCount) break;
		i++;

		let o = dataSources[ii];
		//mlog('o',ii ,o);
		let content = o.text;
		if (o.inversion && o.opt?.images && o.opt.images.length > 0) {
			//获取附件信息 比如 图片 文件等
			try {
				let str = (await localGet(o.opt.images[0])) as string;
				let fileBase64 = JSON.parse(str) as string[];
				let arr = fileBase64.filter((ff: string) => ff.indexOf("http") > -1);
				if (arr.length > 0) content = arr.join(" ") + " " + content;
				mlog(t("mjchat.attr"), o.opt.images[0], content);
			} catch (ee) {}
		}

		//mlog('d',gptConfigStore.myData.talkCount ,i ,o.inversion , o.text);
		rz.push({ content, role: !o.inversion ? "assistant" : "user" });
	}
	rz.reverse();
	mlog("rz", rz);
	return rz;
};

export const isDisableMenu = (menu: string) => {
	return (
		homeStore.myData.session &&
		homeStore.myData.session.menuDisable &&
		homeStore.myData.session.menuDisable.indexOf(menu) > -1
	);
};
