# 周、月、90 天、年度与重大决策插画

五类复盘的 16 个阶段均已使用内置 imagegen 生成独立的透明人物场景，并接入逐题画布。每个阶段只显示对应的插画，不复用同一图片或仅修改颜色。[查看 16 张插画总览](extended-art-sheet.png)。

| 资源槽 | 已接入场景 | 类别色 |
| --- | --- | --- |
| `weekly-recap` | 人物排好七张散页，回看这一周 | 暖赭红 |
| `weekly-pattern` | 人物用放大镜寻找重复的习惯轨迹 | 暖赭红 |
| `weekly-next` | 人物把三张重点卡片放进下周计划 | 暖赭红 |
| `monthly-result` | 人物翻动月历，对照目标与结果 | 深琥珀 |
| `monthly-bottleneck` | 人物解开纸带组成的结 | 深琥珀 |
| `monthly-experiment` | 人物在桌面摆放小型实验器皿与计划纸 | 深琥珀 |
| `quarterly-evidence` | 人物站在三段路标旁，回看经过的路线 | 深蓝 |
| `quarterly-direction` | 人物调整一枚大型罗盘指针 | 深蓝 |
| `quarterly-next` | 人物把三枚目标标在远处的路线图上 | 深蓝 |
| `yearly-coordinate` | 人物展开长卷，周围有四季线索 | 深紫 |
| `yearly-release` | 人物放下旧纸页，保留一本精选手册 | 深紫 |
| `yearly-next` | 人物打开新年第一页，旁边有年轮状时钟 | 深紫 |
| `decision-question` | 人物站在两条道路入口，手持问题纸 | 深橄榄绿 |
| `decision-evidence` | 人物在天平两端放事实纸页与未知线索 | 深橄榄绿 |
| `decision-choice` | 人物把选项放进打开的决定盒 | 深橄榄绿 |
| `decision-review` | 人物在未来日期的纸页上留下回看标记 | 深橄榄绿 |

生成时以每日复盘的透明人物插画为共同画风参照，保持细描线、奶白纸色、深青轮廓、对应类别色和少量浅金。每张图有不同的主物件、人物姿态与外轮廓，同类别也不只换颜色。透明 1:1 构图不包含文字、数字、Logo、界面框或私人复盘内容。

素材保存在 [`shendu/public/assets/extended/`](../shendu/public/assets/extended/)，其中包含原始 PNG、无损 WebP、[提示词](../shendu/public/assets/extended/prompts.json)和 [SHA256 清单](../shendu/public/assets/extended/manifest.json)。已逐张检查透明度、道具、语义贴合和桌面/手机裁切，并按资源槽替换临时 SVG。
