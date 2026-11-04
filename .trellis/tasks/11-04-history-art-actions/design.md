# 设计与契约

## 行为差异与归属

当前 historyCardHtml 每类型只有 HISTORY_ART 一张，actionCard 还是旧纵向白卡。实际归属是 app.js 两个列表渲染器与 styles.css 的局部视图样式。

- 新增 public/record-art.js：RECORD_ART 图池、recordArtAssignments(records, catalog=RECORD_ART) -> Map<id,{src,scene}>。只读全量记录，按周期及ID稳定排序，同类优先未使用图，关键词匹配与ID散列决定候选；一轮图池用完才复用。两页都先传全量 state.records，之后再筛选，因此筛选及跨页稳定。保持24张真实素材作为过渡，未来生成后显式更新catalog；不引用65个尚未生成路径。
- app.js 历史页仅替换配图来源；行动页使用独立 actions-page 和 archive 纸感视觉，共用已有分类色、记录日期规范化与配图分配函数。保留原 actionCard 信息、模板快照与 bindActionButtons/openVerification，不复制业务判定。
- 验证表单继续走原 openModal、原ID及原字段，只添加局部视觉类／图文头部。不能更改既有等待期或验证结果锁定。
- art/record-library/generation-plan.json 保存65个不同构图及配色。output/imagegen/record-library 保存经用户确认使用的CLI最终图片；仅在实际生成并目视验收后处理WebP、写manifest、更新catalog。默认 gpt-image-2，暖白背景；本次不切换到需要另行确认的透明模型。

## 质量与回滚

配图为aria-hidden、pointer-events:none、保留尺寸并懒加载。历史样式只维持原布局；行动页两列卡片和手机单列，长行动/结果可展开以完整阅读。结果与时间不能只靠颜色区别；失效/等待用真实禁用按钮和文字。新列表支持自定义全白主题和两种减少动态效果设置。

纯分配模块测试验证同类不重复直到耗尽、六类图池隔离、输入顺序/筛选/重复ID稳定、实际文件存在。浏览器使用隔离SQLite合成账号验证六类、可验证/等待/已验证、长标题与提交。回滚只需还原本轮UI文件与新模块；无DB迁移或数据写入兼容成本。
