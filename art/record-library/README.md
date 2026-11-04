# 历史与行动验证插画

**65张新插画已于2026-11-04真实生成并逐图审阅。** 使用已授权的原始 imagegen CLI，通过用户指定的 Sub2API 兼容服务请求 `gpt-image-2`；没有创建自定义 API runner。每幅独立生成，人物和线条对照真实概览图标修正，初版偏几何肖像的样图已拒绝，不计入成品。

| 类别 | 已生成数 | 配色 |
| --- | ---: | --- |
| [每日预览](../../output/imagegen/record-library/contact-daily.png) | 30 | 青绿 `#15584E / #1E8F83` |
| [每周预览](../../output/imagegen/record-library/contact-weekly.png) | 7 | 珊瑚 `#8F4335 / #DB7B61` |
| [每月预览](../../output/imagegen/record-library/contact-monthly.png) | 12 | 琥珀 `#875B21 / #D79A34` |
| [每季预览](../../output/imagegen/record-library/contact-quarterly.png) | 4 | 蓝 `#345585 / #5C82C5` |
| [每年预览](../../output/imagegen/record-library/contact-yearly.png) | 6 | 紫 `#624782 / #9A73BD` |
| [重大决策预览](../../output/imagegen/record-library/contact-decision.png) | 6 | 橄榄绿 `#455F34 / #759D58` |

共65个独立场景。每日／月／季／年数量来自用户要求；周和决策沿用已说明的7和6张。主题、最终提示词、配色、关键词和输出文件名见 [generation-plan.json](generation-plan.json)，每个场景对应 [jobs.jsonl](jobs.jsonl) 的一项，未用同一图片换色或复制充数。[完整图册](../../output/imagegen/record-library/gallery.html)可在本地浏览器直接打开，点击每幅缩略图可查看原始PNG。

## 当前运行中的素材

`shendu/public/record-art.js` 仅引用65张已通过审阅的本地WebP，分类数与上表一致。历史和行动验证均从全量记录计算配图，再筛选显示；同类先用完图池再循环，关键词在未用候选中优先匹配，未命中使用记录ID的稳定散列分配。不会把正文发送给图像服务，不会在数据库保存图片字段。概览和六类填写画布继续使用原素材。

65张原始RGB PNG保存于 `output/imagegen/record-library/`。请求为1024平方，服务实际返回1254平方。`prepare-assets.py` 本地提取与外缘相连的暖白背景，保留封闭纸形和人物内部，统一类别调色板后缩放留边，输出640平方透明WebP；透明并非模型原生Alpha。发布图合计约3.6MiB。源图与发布图均有65个不同SHA256；[逐图审阅记录](visual-review.json)绑定两者哈希，[发布清单](../../shendu/public/assets/records/manifest.json)记载真实尺寸、来源、关键词与处理参数。

## 维护与复现

网站部署与运行直接使用已提交的图片，**不需要API密钥、Python或图像服务**。只有维护者生成新素材时，才在本机配置 `OPENAI_API_KEY` 和可选的兼容服务 `OPENAI_BASE_URL`；两者不写入客户端、复盘数据库或公开仓库。生成依赖为技能要求的openai包，本地处理使用Pillow。

```powershell
$imagegenCli = Join-Path $env:USERPROFILE '.codex/skills/.system/imagegen/scripts/image_gen.py'
# 先检查请求与输出，不调用API，也不需要密钥。
python $imagegenCli generate-batch --input art/record-library/jobs.jsonl --out-dir output/imagegen/record-library --no-augment --dry-run
# 新生成时执行；既有文件默认拒绝覆盖，重试清单只保留缺失作业。
python $imagegenCli generate-batch --input art/record-library/jobs.jsonl --out-dir output/imagegen/record-library --no-augment --concurrency 3
# 本地处理和联系图预览，不调用API。改处理规则后可加 --reprocess。
python art/record-library/prepare-assets.py
# 审阅联系图并更新visual-review.json中每幅的源/发布哈希后，方可发布。
python art/record-library/prepare-assets.py --publish
```

CLI 使用 `gpt-image-2`、请求1024×1024、medium质量和暖白背景，未切换模型。实际源文件尺寸单独记载。默认拒绝覆盖已有图片，重试时仅选择未成功的独立作业，保留有效结果。维护者更换图片后需重新审阅并更新哈希与缓存版本；脚本会拒绝发布审阅后发生变化的图像。

## 接入验收契约

1. 对照六张概览 SVG 的真实外观逐图检查：细轮廓、平面人物、同类别主色；65张须有不同姿态、道具与构图，不能只凭提示词或文件名判定完成。
2. 所有实际生成的PNG保存在 `output/imagegen/record-library/`，选定图转换为本地WebP缩略图，记录生成方式、尺寸、提示词和SHA256；只有存在且验收合格的图片可进入运行目录和 `RECORD_ART`。
3. 更新分类图池，保留每张图的语义关键词；不得提前写入尚不存在的路径。历史、行动验证共用该图池，概览和沉浸填写插画不随之替换。
4. 浏览器核对全部图片加载、配色、完整构图、同类分散与筛选稳定性，并检查历史／行动验证的桌面和窄屏表现。密钥永不进入客户端或提交。
