# Design

## Boundary / canonical owners
只调整dailySceneArt资源、每日头部进度及现有gaugeCard/updateGauge的唯一睡眠/精力控件归属。gaugeCard仅由dailyEvidence两次调用，不创建第二套保存或数字计算路径。app.js保留数据字段sleep/energy、原生number(0—24/.5及0—100/5)、dirty监听、输入挂载和保存校验；不改API/数据库。共享headerBrandContent和其他五类不改。

## Art
根会话用内置imagegen生成8张1254×1254透明PNG，实际daily.svg截图仅作为风格参照；首张睡眠作为其余图片的统一人物/笔触/配色参照。深青绿#15584E、青绿#1E8F83、薄荷#A9D9CC、奶白#FFFBEA与少量浅金，极细灰绿描线，纤长人像、小五官与夸张物件。禁止粗线圆头人物、蓝色背景圆片、卡片底板和文字。所有图片预留透明外边距，保持正向并随分组摆放。保存原始生成图片，浏览器资源可无损转换WebP但不做内容绘制/抠图修改。8场景仍为intro/sleep/energy/evidence/reflection/action/calendar/journal。同一批次共享参照及提示词骨架，生成日志记录提示词、路径、尺寸与哈希。

## Number panel
一个浅纸白的完整控件表面包含简明的输入说明、数值与中文单位、状态文字、参考尺。数字保留宋体/衬线强调但收至适当大小，数值输入和单位通过内层组合容器形成一个可见输入区域；聚焦组合容器增强轮廓。空值不出现虚构0的填充/指针，显示“输入时长”或“输入分值”提示。单位睡眠用“小时”，精力用“/100”。下方状态使用中性与个人基线比较，不加入医学判断。参考尺明确标“时长参考（小时）”或“精力参考”，均匀刻度睡眠0/6/12/18/24、精力0/25/50/75/100；基线有独立短线和文字图例，当前值指针只在输入后显示。尺不是可拖动控件，不使用slider语义。

保留雾蓝#E9EDF7、深墨#152B54、纸白#F8FAFF、边界#7487A3、占位#5A7193；参考尺使用青绿色并以文字/标记辅助，颜色不单独表达信息。手机数字/单位同处输入容器，状态与尺顺排，不用旧390px拆成三行的散落样式。

## Progress / safety
删除daily-question-count DOM及写入；daily-step-status只报组名/当前题意，不报题数。删除顶部data-daily-intro按钮及专属监听/hidden写入/样式，底部第一题的data-daily-back仍可回引导。不要通过display:none遗留无效控制逻辑。资源版本统一提升overview21。

## Verify / rollback
真实隔离后端桌面空/已填睡眠精力，320/390，sleep24/7.5/清空、energy100/0/清空、自定义基线与只读、dirty保存后回看；其他6题组方向和品牌不回退。npm run check及daily-flow既有10测试，适量新增真正覆盖gauge数值呈现的回归测试仅在抽出纯函数有实际必要时做。保存计算/模板未改不重复全API测试；CI仍运行全项目检查。独立check、premium基线18差量和DESIGN lint。图片路径均本地，无运行时生成请求、无私人内容发送。回滚本次提交无需迁移。

用户本轮明确要求使用imagegen；沿用会话已给的Trellis实施、提交与推送授权。
