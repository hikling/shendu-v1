# 历史与行动验证插画生成清单

本目录是生成准备，**尚未生成新图片**。用户已允许使用 imagegen CLI/API，并因本机没有 `OPENAI_API_KEY` 选择先完成界面、稍后配置密钥。

| 类别 | 计划新图数 | 配色 |
| --- | ---: | --- |
| 每日 | 30 | 青绿 `#15584E / #1E8F83` |
| 每周 | 7 | 珊瑚 `#8F4335 / #DB7B61` |
| 每月 | 12 | 琥珀 `#875B21 / #D79A34` |
| 每季 | 4 | 蓝 `#345585 / #5C82C5` |
| 每年 | 6 | 紫 `#624782 / #9A73BD` |
| 重大决策 | 6 | 橄榄绿 `#455F34 / #759D58` |

共65个独立场景。每日／月／季／年数量来自用户要求；周和决策是暂定数。主题、最终提示词、颜色和输出文件名见 [generation-plan.json](generation-plan.json)，每个场景对应 [jobs.jsonl](jobs.jsonl) 的一项，使用独立提示词，不用同一图片换色或复制充数。

## 当前运行中的素材

`shendu/public/record-art.js` 只引用已存在的24张本地图片：每日8、周3、月3、季3、年3、决策4。历史和行动验证均从全量记录计算配图，再筛选显示；同类先用完图池再循环，关键词在未用候选中优先匹配，未命中使用记录ID的稳定散列分配。不会把正文发送给图像服务，不会在数据库保存图片字段。当前过渡素材不算65张新图的一部分。

## 配置密钥后生成

在仓库根目录，通过已安装 imagegen 技能的原始 CLI 执行，不创建自定义 API runner。`OPENAI_API_KEY` 只在本机环境中设置，不写入本目录、复盘数据库或公开仓库。

```powershell
$imagegenCli = Join-Path $env:USERPROFILE '.codex/skills/.system/imagegen/scripts/image_gen.py'
# 先检查请求与输出，不调用API，也不需要密钥。
python $imagegenCli generate-batch --input art/record-library/jobs.jsonl --out-dir output/imagegen/record-library --no-augment --dry-run
# 密钥已配置且用户要求继续生成时执行。
python $imagegenCli generate-batch --input art/record-library/jobs.jsonl --out-dir output/imagegen/record-library --no-augment --concurrency 3
```

CLI 使用 `gpt-image-2`、1024×1024、medium质量和暖白背景。未选择不透明参数不支持的透明模式，也未切换模型。若环境缺少 openai Python 包，按技能文档安装依赖后再执行。默认拒绝覆盖已有图片，重试时仅选择未成功的独立作业，保留有效结果。

## 生成后的接入验收

1. 对照六张概览 SVG 的真实外观逐图检查：细轮廓、平面人物、同类别主色；65张须有不同姿态、道具与构图，不能只凭提示词或文件名判定完成。
2. 所有实际生成的PNG保存在 `output/imagegen/record-library/`，选定图转换为本地WebP缩略图，记录生成方式、尺寸、提示词和SHA256；只有存在且验收合格的图片可进入运行目录和 `RECORD_ART`。
3. 更新分类图池，保留每张图的语义关键词；不得提前写入尚不存在的路径。历史、行动验证共用该图池，概览和沉浸填写插画不随之替换。
4. 浏览器核对图片加载、配色、完整构图、同类分散与筛选稳定性，重新拍截图，再更新此目录的状态及README。密钥永不进入客户端或提交。
