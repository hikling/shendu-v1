# 实施计划

- [x] 核实本机用户环境变量可用；恢复既有要求并持久化规划。
- [x] 主代理：官方CLI依赖、修订样图、65个独立场景已生成；六类实际联系图全量审阅通过。
- [x] 主代理：WebP发布素材及生成清单，源／发布图各65个唯一SHA256，640平方Alpha与原始1254平方尺寸核验通过。
- [x] Trellis implement：只接入经审阅图片至record-art.js，扩展相关测试与缓存版本。
- [x] Trellis check：全范围规格与代码复核，npm run check、npm test、git diff --check。
- [x] 主代理：隔离浏览器检查、截图，更新README／素材文档／规格。
- [ ] 主代理：最终质量门、提交、归档和日志、推送main并核对最终HEAD的CI。

遇到API权限、配额或模型错误先核实具体原因；不静默更换模型，不把提示词清单视为已生成图片。保留已成功输出，避免重发整批请求。

## 2026-11-04 执行状态

- 隔离环境中安装官方 openai 3.45.0 与 Pillow 13.0.0；Windows用户级 OPENAI_API_KEY 存在，沙箱外执行进程可读取，未打印其内容。
- 官方原始CLI、gpt-image-2、weekly-01-seven-pages单作业、max-attempts=1首次请求返回 `401 Unauthorized` / `AuthenticationError`。无成功输出，未运行其余64张，不修改客户端素材或宣称完成。
- 用户确认密钥来自OpenAI官方平台。官方文档 https://developers.openai.com/api/docs/guides/error-codes 已读取，401为认证错误。
- 只读诊断 `GET https://api.openai.com/v1/models` 返回401，JSON错误代码 `invalid_api_key`，类型 `invalid_request_error`。已排查空白、外侧引号、非ASCII、SecureString对象／加密串和掩码占位符；没有可在本机无损修复的格式问题。密钥值未输出或落盘。
- 已为用户打开 https://platform.openai.com/api-keys，需在官方平台新建并将创建时显示的完整Secret key更新到本机用户环境变量后重试。当前应用文件没有改动，无新图；保留生成环境与任务规划。
- 用户随后更换为第三方密钥。用户级密钥存在，但Process/User/Machine均未配置OPENAI_BASE_URL或OPENAI_API_BASE。需用户提供第三方平台名称及Base URL／文档后才能向正确服务发送请求；不继续使用官方默认端点测试这枚第三方密钥。
- 用户提供Sub2API服务地址。无密钥探测确认服务标题为Sub2API；该地址HTTPS握手失败。按用户指定地址以其第三方专用密钥请求/v1/models返回200，列出gpt-image-2。继续原始官方CLI的单作业生成，不切换模型，不把服务地址或密钥写入应用。
- Sub2API端点的真实生成请求明确返回403：`Image generation is not enabled for this group`。密钥认证和模型列举已通过，但当前分组禁止图片生成。无输出，不尝试其他端点规避分组限制；需该服务管理员开启此密钥所属分组的图片生成权限后，重试相同单作业。
- 已只读核对该实例公开的GroupsView界面：分组创建／编辑表单均有allow_image_generation复选框（i18n键allowImageGeneration）。所需操作为管理员在分组管理编辑当前Key所属分组，开启图片生成并保存；无需切换模型，也无需开启仅Gemini分组出现的allow_batch_image_generation选项。
- 用户开启权限后样图成功。首版人物偏几何肖像，已拒绝并移入忽略的scratch；65份提示词统一修正为真实概览图标的细曲线、长肢体、象牙白和稀疏平面填色。修订样图通过，剩余64个独立作业并发3生成。请求1024平方，服务实际返回1254平方；清单将保留请求与真实尺寸，不伪报原生透明。

- 交付检查：65张图片已接入，85/85测试通过，桌面与手机、减少动态、白色主题浏览器验收通过。
