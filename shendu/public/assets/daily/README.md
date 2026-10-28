# 每日复盘场景插画

2026-10-28，使用系统内置 `image_gen` 生成8张透明插画，替换之前的手写SVG场景。它们只作装饰，不表示真实记录的状态或数值，不使用私人复盘内容生成。

风格参照为项目实际六类入口中的 `../overview/daily.svg`（用户指定的 [Iconfont合集52510](https://www.iconfont.cn/illustrations/detail?cid=52510)），原素材来源及权利说明继续保留在 `../overview/README.md`。将该图标的正常浏览器渲染图作为风格参照，生成新的睡眠画面，再将同一图标和新睡眠画面共同作为其余7张的参照。新构图使用纤长人物、细灰绿描线、夸张物件与奶白/深青绿/薄荷色，少量浅金辅助；不复制原始矢量路径，不将参考素材重新声明为本项目原创。

| 文件 | 语义 | 对应问题 |
| --- | --- | --- |
| intro.webp / intro.png | 人物与巨大笔记本 | 引导 |
| sleep.webp / sleep.png | 月亮窗户、床铺、熟睡的人 | 睡眠 |
| energy.webp / energy.png | 阳光下伸展的身体 | 精力 |
| evidence.webp / evidence.png | 人物拿笔记录清单 | 阶段行动、风险 |
| reflection.webp / reflection.png | 放大镜、纸页与观察者 | 今日事实、原因 |
| action.webp / action.png | 带计划走上台阶、路径与旗帜 | 明日行动、阻碍和应对 |
| calendar.webp / calendar.png | 在日历上圈选一天 | 验证日期 |
| journal.webp / journal.png | 灯、打开的手账与写字的人 | 日记 |

每张原始PNG均为1254×1254 RGBA，保留原图，不手工抠图或修改内容。页面使用无损WebP编码；alpha与雾蓝/白/黑底合成结果逐像素核对一致。外部透明区域是真实alpha，不是棋盘或白底。8张WebP合计约3.45MB，原始PNG约5.66MB。完整尺寸、字节数及PNG/WebP SHA256见 `manifest.json`。

生成模式为内置工具，无API密钥、外部下载地址或运行时生成服务。提示词原文及拼接规则保存在 `prompts.json`：睡眠使用 `sleep_prompt`，其他场景使用 `common_prompt + subject + suffix`。提示词要求统一风格、透明留白、无文字和无背景卡片；生成图为位图插画，不能声明为矢量文件。账户主题只影响控件交互，不改插画含义；无日期的日历格、清单和书页线条均为装饰。

图文方向由真实分组决定：01证据插画右、02事实与原因插画左、03行动插画右、04日记插画左；切换同组题目只切场景，不切方向。手机将小场景放在正常文档流中，保留书写顺序和控件完整宽度。图片统一空alt、aria-hidden，禁止参与指针命中。
