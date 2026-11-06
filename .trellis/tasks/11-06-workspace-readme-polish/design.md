# 设计

最小差异位于公共页面样式与少量模板：actions-empty、settings-menu-item及workspace空态视觉比例，users-table的列宽／对齐，backup说明的details容器。以实际组件DOM确定选择器，保持原生table和shadcn Table语义及<=820px统一卡片化；不全局放大所有正文或图像。

README以简洁品牌区、概览图、六类能力、推荐Docker Compose步骤和清晰索引为主。完整环境变量、备份、安全、升级和诊断可移入docs/deployment.md，保留旧信息中正确的操作，不声明不存在的镜像或线上能力。

源文件预计README.md、docs/deployment.md、public/styles.css、workspace-pages.css、app.js少量标记、index.html缓存版本。无需新依赖、无API／数据格式／存储变更。
