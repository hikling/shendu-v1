# 慎独：复盘内容与完成流程修改

基线：dadde33d6cf967abf8f940036c9703f779563607。用户已授权提交并同步 GitHub main；本报告记录本次实现与检查范围，不代表运行站点已部署。

## 实现结果

- 六类复盘的全部文字输入统一200px固定高度；包括普通问题、指标、行动、阻碍/应对、日记与决策名称。长文框内滚动，锁定后仍可聚焦阅读和复制。
- 完成后的实际最后一步提供查看历史复盘、前往行动验证；移除填写行动验证的局部按钮。移除日记时仍能完成并看到导航。
- 每类最多30个普通问题，可新增、删除、恢复默认问题及调整必填；每日睡眠、精力、风险、日记可关闭/恢复；阶段指标支持0–12项。保留核心行动、应对、验证日期、每日阻碍条件和决策名称。
- 当前草稿跟随设置，锁定或过期记录按原快照显示。指标使用稳定ID保留草稿填写内容，移除的指标答案保存在archivedMetrics。原有问题答案不会因模板删除而擦除。

## 验证证据

- npm ci：成功。
- npm run check：通过（包含新增schema/metrics模块）。
- npm test：215项通过、0失败；pretest生产构建通过。
- npm run smoke:ui -- http://127.0.0.1:3100：健康接口、HTML、app模块、本地shadcn JS/CSS通过。
- git diff --check：通过。
- 真实桌面浏览器：新增空白问题聚焦；移除默认问题；自定义问题必填拦截；关闭每日可选题/零指标；长文保存；普通题与双输入题均计算为200px/overflow:auto；无日记最后一步完成；完成后行动页跳转成功。
- 真实组件桥接JSDOM：checkbox/reset同步、局部更新保留其他设置、空白标题拦截、失败重试、保存期间保护、锁定长文可聚焦、旧快照、指标身份与草稿无损同步。
- 窄屏浏览器：未完成。用户反馈重新开启后，浏览器工具仍返回“Local browser use is disabled in Work settings”。未用其他工具绕过。
- Premium静态审计曾返回14项兼容性检查提示（原生控件归属、无法静态识别的按钮处理器、CSS尺寸/滚动条扫描）。既有原生/React桥接归属见规范；当前不能宣称该审计严格通过。自动化与真实桌面结果独立列示。后续检查时原脚本路径已不可读，未据此推断原因。

## 本地预览

http://localhost:3100 使用隔离虚构数据，不连接线上站点。测试使用本地虚构账户。运行数据与密钥被任务目录的.gitignore排除。

## 提交范围

代码提交：feat: customize review content and completion flow

包含下面的本次修改文件（不包含测试数据库、密钥、临时日志或审计原始文件）：
- `.trellis/spec/backend/http-and-security.md`
- `.trellis/spec/frontend/extended-review-flow.md`
- `.trellis/spec/frontend/review-composition.md`
- `.trellis/spec/frontend/state-and-data.md`
- `.trellis/spec/frontend/ui-quality.md`
- `DESIGN.md`
- `HANDOVER.md`
- `UX-CONTRACT.md`
- `shendu/package.json`
- `shendu/public/app.js`
- `shendu/public/daily-flow.js`
- `shendu/public/extended-flow.js`
- `shendu/public/index.html`
- `shendu/public/styles.css`
- `shendu/public/workspace-pages.css`
- `shendu/server.mjs`
- `shendu/tests/daily-flow.test.mjs`
- `shendu/tests/extended-flow.test.mjs`
- `shendu/tests/workspace-pages.test.mjs`
- `shendu/public/review-schema.js`
- `shendu/public/review-metrics.js`
- `shendu/tests/review-schema.test.mjs`
- `shendu/tests/review-metrics.test.mjs`
- `shendu/tests/review-settings-api.test.mjs`
- `shendu/tests/review-customization-ui.test.mjs`

另含本任务PRD、设计、执行计划、验证报告与上下文清单。无未识别的并行改动。用户已于2026-11-08明确授权提交到GitHub并同步main。
