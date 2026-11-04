# 技术设计与边界

## 行为差异及归属

当前 record-art.js 为历史和行动验证提供24张过渡素材。目标是保持分配算法与页面结构，替换为65张真实生成、经过审阅的新素材。图片归属 assets/records，分配仍归属 record-art.js；原有概览和沉浸画布继续使用各自目录。

## 生成与处理

原始官方 imagegen/scripts/image_gen.py 使用 gpt-image-2，1024平方、medium质量。密钥只在执行进程内从 Windows 用户环境变量读取；不写入脚本或参数。安装依赖到已忽略的 shendu/tmp/imagegen-venv。先生成一个真实样例审阅，再生成其余独立作业；保留成功结果，只重试缺失或有明确质量问题的图片。已存在的 generation-plan.json / jobs.jsonl 是唯一提示词来源。

用户后续明确使用Sub2API第三方专用密钥与其提供的兼容端点。该端点的/v1/models已通过认证且列出gpt-image-2。执行时仅在当前进程设置OPENAI_BASE_URL，继续使用原始官方CLI，不创建自定义API runner；服务地址与密钥不写入客户端或公开素材清单。

原始PNG保存在 output/imagegen/record-library，WebP发布到 shendu/public/assets/records。使用本地Pillow处理和联系图检查，不调用其他图像服务。暖白底如需去底，只处理与画布外缘连通的背景并检查人物／道具边缘，不能声称模型原生透明。清单记录生成方式、模型、提示词引用、尺寸与源／发布图SHA256，不包含秘密或个人数据。

## 接入与兼容

record-art.js只登记实际存在且审阅通过的图片，按六类独立配置语义关键词。recordArtAssignments算法保持原样，两页仍传入完整state.records后再筛选。只更新该模块、必要的app.js import及index.html缓存版本，不改页面布局、API、数据库、记录结构或等待期。

## 检验与回滚

测试对65个实际文件校验分类数、唯一哈希、文件存在及同类耗尽前不重用。浏览器用隔离合成数据验证历史／行动页面加载、配色、跨页稳定、窄屏和主题。回滚可还原catalog及缓存版本，不涉及数据迁移。
