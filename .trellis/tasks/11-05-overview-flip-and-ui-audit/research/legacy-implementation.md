# 遗留表面实现报告

## 边界

原缺口是登录/注册、重新认证、通用确认及连接状态仍使用旧样式，而复盘画布、历史归档和工作区已定稿。实际所有者在 `app.js` 的 `renderAuth`、`sessionExpired`、`openModal`、`boot/init`；父会话另明确授权了 `bindBackup` 中目标删除的单一事件段。没有更改API、记录模式、保存或权限协议，没有添加依赖或生成图片。

## 修改

- `public/app.js`：登录/注册用纸面、原版红印与慎獨字样、粗宋体层级和本地阅读场景。保留字段ID/name/约束、显示密码、注册开关和完整auth清理；新增错误消息的局部status语义。
- `sessionExpired`：夜灯静态图、明确字段label、纸面表单；原始编辑器继续挂载，持久弹窗不能关闭，登录失败不清除输入，成功后仍要求再次保存。
- `openModal`：只给非定制表面加 `legacy-dialog` 和一个静态本地插画。显式排除 workspace、verification 与8个已统一的备份/用户form；标题提取、focus/inert/busy/persistent与事件绑定顺序不变。装饰只在脱离文档的template中插入。
- `bindBackup`：系统confirm改成原Radix确认。打开/取消/Esc不发送删除；明确确认只删除对应配置，提交时禁止重复点击；失败保留弹框并启用重试。
- `boot/init`：同一品牌纸面加载/连接错误与相关本地图；请求、401、重试、重新连接绑定保持原样。
- `public/legacy-surfaces.css`：独立作用域、桌面与820/540/360断点，清晰输入边界、危险提示、键盘focus与两类减少动态支持。没有新增动画或悬停色块。
- `tests/ui-overlay-inert.test.mjs`：使用实际app所有者和生产shadcn构建，补充定制表面排除、持久重新认证失败/成功保留原编辑器、注册约束、删除确认/取消/Esc/重试/焦点返回。
- `research/ui-inventory.md`：覆盖全部路由、弹层、通知与浏览器离站警告的清单。

## 检查

- `npm run check`：通过。
- `node --test tests/ui-overlay-inert.test.mjs tests/ui-surfaces.test.mjs tests/ui-runtime.test.mjs`：首批21项通过；补上删除行为回归后单独 `ui-overlay-inert` 6/6通过（集成后该三文件合计22项）。
- `git diff --check`：通过，仅已有CRLF转换提示。
- 6个引用的本地WebP逐一存在：reading-corner、morning-window、night-lamp、journal-page、protect-time、tomorrow-bag。

## 主会话接续

主会话负责index引入新CSS、缓存版本、完整build/test与真实浏览器桌面/820/390/320验收、规范/README、提交main及CI。尚未声称视觉验收或仓库同步完成。检查登录完整页高、宋体断行、夜灯弹窗在窄屏的字段/按钮可达性，以及备份恢复长摘要的内部滚动。
