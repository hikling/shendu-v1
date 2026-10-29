# 设计与实现边界

当前五类复盘在 `renderReview()` 的非每日分支一次渲染引导、工具栏、所有问题和行动区。每日分支已经有可复用的引导、单题、焦点、草稿和静态插画语言。差距位于浏览器端 `shendu/public/app.js` 的非每日渲染/绑定路径及 `styles.css` 的页面样式；不涉及存储、API 或服务端验证。

## 页面与内容

使用统一的沉浸式外壳：无共享顶部导航的简短引导；进入后左上角只显示当前真实阶段，顶部显示当前周期和退出，中央一次只呈现当前问题及输入，底部为返回、保存、前进/完成。桌面以阶段交替安排插画左右位置，手机把小幅插画放在题目之前且不挡输入。旧字段保持挂载，切题不重建输入节点；状态文案与焦点随题目更新，减少动态时直接展示全文。

| 类别 | 阶段与题目顺序 | 视觉主题 |
| --- | --- | --- |
| 周 | 01 回看一周：plan, progress；02 找出规律：patterns, keepStop；03 安排下周：nextThree, action, ifThen, verifyDate | 七日纸页、重复与节奏；暖赭红 |
| 月 | 01 目标与结果：goalResult, change；02 看见瓶颈：want, bottleneck；03 小步实验：experiment, action, ifThen, verifyDate | 月度纸页与系统；深琥珀 |
| 90 天 | 01 阶段证据：hope, evidence；02 校准方向：worth, choices；03 下一阶段：nextGoals, action, ifThen, verifyDate | 路标与罗盘；深蓝 |
| 年 | 01 年度坐标：coordinates, expectations, areas；02 保留与放下：decisions, keepRelease；03 走向明年：nextYear, action, ifThen, verifyDate | 年轮、书册与时间；深紫 |
| 决策 | 01 写清问题：recordTitle, decision, options；02 检查依据：facts, expectation, failure；03 作出选择：choice, firstStep；04 约定回看：action, ifThen, verifyDate | 分岔路径与权衡；深橄榄绿 |

引导分别使用一条简短双句，不改 `QUOTES` 的已有内容或其他消费位置。可见大题目使用当前模板文案，已知语义短语才加类别色，其他文本保留原样；渲染自定义标题用文本节点或现有 `esc()`，不拼接未转义 HTML。说明文案应短，输入本身有边界、标签和反馈，不能只靠占位文字标识。每屏仅一个主操作。

## 数据与交互契约

单一配置描述五类题目和阶段；渲染/切题/校验共用一套逻辑，不复制五套页面。保留 `QUESTIONS` 与 `DEFAULT_REVIEW_TEMPLATES` 作为问题与自定义文案来源。每个题目的 `data-answer`、`data-simple`、`#record-title` 保持原字段；`collectCurrent()`、`saveCurrent()`、`validateCurrent()`、`completeCurrent()` 和服务端契约仍是唯一保存/最终校验通道。当前屏若为必填，前进时只检查这一屏；最终完成仍运行已有全量验证。错误在当前屏可见并聚焦具体字段。多个答案使用每日既有可折叠条目模式，重绘后恢复当前题与新条目的焦点。保存、初次获 ID、锁定后重绘和历史进入都保留或恢复合理题目。

日期继续使用原 `verifyDate` 字段与北京时间下限。可复用每日常驻日期笺及其键盘语义，但不能改变其他业务规则。只读时所有表单与日期不可编辑，最后一屏继续展示 `reviewAfterword()`；任何场景装饰都不接收指针或焦点。共享标题/按钮/纸面样式优先复用每日样式的基类，新增样式按五类类型变量覆写，避免把概览或每日的现有布局顺带改动。

## 插画交接

本轮临时使用 `assets/overview/{weekly,monthly,quarterly,yearly,decision}.svg`，各类不重复，不声明为 imagegen 结果。外壳暴露 `data-review-type` 和与 `research/imagegen-plan.md` 一致的 16 个 `data-review-phase` 语义资源槽，以后可按 3+3+3+3+4 阶段替换为不同图，而不改表单。引导页沿用该类别第一阶段资源槽。沿用每日的细描线、奶白纸面、深色轮廓、类别色与少量金色，不用文字、Logo、白底卡片或私人复盘内容。生成后保存原始 PNG、页面 WebP、提示词和来源记录，并实页替换与验收。

## 回滚

全部改动局限于前端共享渲染与样式、测试和文档；记录格式无迁移。回滚该前端提交即可恢复五类原布局，原记录仍可读写。
