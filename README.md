<div align="center">

# 慎独 · Shendu v1

**言寡尤，行寡悔 · 慎独存诚**

给自己用的个人成长复盘系统。记录事实，调整行动，回来验证。

[快速部署](#debian-1213-服务器部署) · [更新现有部署](#更新现有-shendu-v1-部署) · [本地运行](#本地运行) · [完整部署指南](docs/deployment.md)

</div>

## 从记录，到行动，再到验证

六种时间尺度，共同组成一份持续积累的个人成长记录。

| 复盘 | 关注什么 |
| --- | --- |
| 每日复盘 | 留下事实，找到明天最重要的一件事 |
| 每周复盘 | 回看进展，辨认反复出现的规律 |
| 每月复盘 | 调整目标与系统，尝试一个小实验 |
| 90 天复盘 | 校准方向，为下一阶段作出取舍 |
| 年度复盘 | 回看人生坐标，确定新一年的主题 |
| 重大决策 | 记录依据、预期和选择，等待结果检验 |

- **安静地写**：逐题填写，按钮与滚轮切题都有柔和过渡；滚轮带阻尼，可在设置关闭，动效遵循“减少动态效果”偏好；手动保存草稿，草稿可在复盘最后一页删除，提交后永久锁定、不能删除。
- **按自己的问题写**：六类复盘可增删普通问题、恢复默认及设置必填；行动、应对和验证日期等核心内容保留，旧完成记录按当时模板阅读。
- **按时回来**：行动验证保留原计划、预期日期、实际结果与下一次调整。
- **慢慢回看**：历史复盘可按关键词、类型和年月筛选；已保存记录的开场文案固定，概览沿弧线轮播已经验证的记录。
- **看见积累**：阶段与日历汇总每日足迹、农历节气、阶段目标和待验证行动。
- **记清收支**：花销区可先按行写 `60 打车`、`50 吃饭`，自动合计、按用途归类，再用唯一的「上传截图」入口匹配凭证；也可留空直接上传识别，核对后入账。收入记账只填日期、金额、来源和备注；退款从原支出登记。明细可切换整月／单日，月度与每日分类环形图展示花销，点击「查看截图」才加载图片。截图在设备压缩与识别，私有S3保存压缩图。[使用与存储配置](docs/finance.md)
- **自己保管**：自托管 SQLite、账户隔离、数据加密，以及个人、整站和外部备份。
- **查看使用记录**：设置中的「使用日志」按北京时间列出操作人、时间与行为；管理员看全站操作，普通成员只看本人，不记录复盘正文或密码。

90天复盘始终可用，无需额外启用。复盘提交后可直接前往历史或行动验证；各类复盘有各自的最早验证日期，预计日期与实际提交时间分别保留。使用日志从功能启用后开始，不补造过去的操作。

桌面与手机共用纸感界面、宋体和六类插画配色，并支持减少动态效果。插画、装饰字体和前端资源随仓库提供；手机标题另附本地中文宋体，按需加载，不依赖手机安装字体或外部字体服务，桌面维持原有字体；**运行时不需要图像 API 密钥或外部生成服务**。

## Debian 12/13 服务器部署

**一条命令，填写域名后自动部署。** 准备 Debian 12/13 服务器，将域名指向服务器，开放 TCP 80、443；HTTP/3 可另开 UDP 443。登录服务器后进入 **root shell**（普通账户先执行 `su -`），运行：

```sh
curl -fsSL https://raw.githubusercontent.com/hikling/shendu-v1/main/install.sh -o shendu-install.sh && sh shendu-install.sh
```

按提示输入域名，例如 `review.example.com`，不带 `https://`。脚本自动下载到 `/opt/shendu-v1`、安装缺少的依赖、生成密钥，下载并校验 GitHub Actions 已构建好的镜像，再启动 **Docker Compose + Caddy**。最后检查应用与前端资源并显示访问地址。已有 Docker 和配置会被沿用，宿主机无需安装 Node.js，也无需手动修改 `.env`。

**默认不在服务器执行 `npm ci`、前端编译或应用镜像构建。** 支持 Linux amd64/arm64；相同版本已有镜像时直接复用。首次部署仍需下载镜像并可能安装 Docker，耗时取决于网络。镜像必须与应用源码版本一致，缺失或校验失败会停止，不能换用不对应的下载包。

如果提示找不到 `curl`，先执行一次 `apt-get update && apt-get install -y curl`。HTTPS 证书由 Caddy 自动申请，取决于域名解析和端口连通。

完成后打开显示的 HTTPS 地址。第一个注册账户会成为超级管理员，随后自动关闭公开注册。

**首次安装**用上面的命令；**旧版安装卡在构建或需要重新搭建**用下面的重试步骤；**已经运行的站点**用[更新命令](#更新现有-shendu-v1-部署)。旧 `Shendu` 或 ZIP 部署先看[迁移指南](UPGRADING.md)。自定义目录与排错见[完整部署指南](docs/deployment.md)。

## 旧版安装卡住或中断后重试

适用于本仓库无本地代码修改的 `main` 分支克隆。如果终端还停在 `npm ci`、Vite 或 Docker `build`，先按 **Ctrl+C** 停止旧流程，再执行以下命令（自定义安装目录请替换路径）：

```sh
cd /opt/shendu-v1 && git -c core.fileMode=false pull --ff-only && sh shendu/scripts/install.sh
```

这会先更新安装脚本，再采用预构建镜像。仅重新下载一键安装入口不会更新已经存在的代码目录，可能仍运行旧构建脚本。当前版本安装中断后，也可用这条命令重试；已有配置、密钥、数据和备份会保留。不要删除 `.env`、`data/` 或 Docker 卷来重新搭建。若 Git 提示本地代码修改或分支冲突，先保留并处理修改，不要强制重置。

正常情况下终端应进入预构建镜像的下载、校验、加载和健康检查，不应再出现本机 `npm ci` / Vite 编译。首次 Docker 安装和镜像下载仍受网络影响；下载异常时核对 [Releases](https://github.com/hikling/shendu-v1/releases) 和服务器网络后重试。

## 本地运行

需要 **Git、Node.js 22.13+**，推荐与容器一致的 Node.js 24。

```sh
git clone https://github.com/hikling/shendu-v1.git
cd shendu-v1/shendu
npm ci
npm start
```

打开 <http://localhost:3000>。`npm start` 会先构建前端，再启动服务；首次运行自动生成 `shendu/data/` 中的数据库和内部主密钥。自定义端口与目录见[本地环境说明](docs/deployment.md#本地-nodejs-运行)。

## 更新现有 shendu-v1 部署

已部署且正在使用的站点，在服务器上先执行 `su -` 进入 root shell，再整段复制下面的命令。默认项目目录为 `/opt/shendu-v1`；自定义安装位置时替换最后的路径。

```sh
(
  set -eu
  shendu_updater="$(mktemp)"
  trap 'rm -f "$shendu_updater"' EXIT
  curl -fsSL https://raw.githubusercontent.com/hikling/shendu-v1/main/shendu/scripts/update.sh -o "$shendu_updater"
  SHENDU_BACKUP_BEFORE_UPDATE=y sh "$shendu_updater" /opt/shendu-v1
)
```

命令先下载最新更新器；下载失败不会执行脚本，并清理临时文件。更新器确认官方仓库、`main` 分支和代码无本地修改，再创建整站加密快照；备份失败立即停止。随后快进 `origin/main`，下载／复用与源码完全一致的预构建镜像，启动并检查健康和前端资源。准备镜像期间旧应用继续运行；`.env`、完整 `data/`、原主密钥、备份及 Caddy 卷保留。

成功后检查容器和日志：

```sh
cd /opt/shendu-v1/shendu
docker compose ps
docker compose logs --tail=60 shendu
```

终端显示「更新完成」后刷新网页；电脑可用 Ctrl+F5，手机关闭本站页面再重新打开。GitHub 同步不等于服务器已更新，无需重新安装、注册账户或清空数据。更新前快照位于 `shendu/backups/`，恢复密码文件为 `shendu/data/server-backup.password`；请分别另存到服务器之外。R2/S3中的截图不在数据库快照内，仍须保留原存储和配置。

如果此前输入 `y` 却提示“备份选项无效”，可直接重跑上面的命令：该错误发生在拉取代码、替换容器之前。新版会忽略选择前后的空格或回车符，终端输入有误时会重新询问。完整过程见[更新与检查](docs/deployment.md#更新与检查)。

若新容器启动后的健康或前端资源检查失败，更新器会停止并输出日志，不会自动回滚容器或数据库。请保留更新前快照，按[迁移与回退说明](UPGRADING.md)核对后恢复。

## 数据与备份

数据库与原主密钥需要一起保管。重建容器会保留挂载的数据目录；不要在升级时删除 `.env`、`data/` 或 Caddy 卷。

| 需要保存什么 | 使用方式 |
| --- | --- |
| 个人资料 | 在「数据备份」导出加密的 `.shendu` 文件 |
| 整个站点 | 超级管理员导出 `.shendu-site`，或在服务器生成 `.shendu-db` 快照 |
| 另一处副本 | 连接 WebDAV / S3，手动备份或按明确的北京时间／星期定时备份 |

[数据目录、密钥与恢复说明](docs/deployment.md#数据与备份) · [旧 Shendu / ZIP 部署迁移与回退](UPGRADING.md)

外部备份的最近运行记录显示目标名称、存储类型、执行方式及结果，只保留含今天在内的十个北京时间自然日；连接测试不计入。它与设置中的使用日志分开，后者不按十天清理。

Releases 保留按发布时间最新的四个完整版本。更早下载包不再提供，Git 标签和源码保留；需要长期回退某版时，请提前另存镜像与校验文件，并单独备份数据库、原主密钥和配置。已在本机加载的对应镜像仍可复用；从更早源码部署需明确选择源码构建，操作前先阅读迁移与回退说明。

最终版完成构建、双架构容器及公开下载检查后，`.agents/skills`、`.codex`、`.github/workflows` 和 `.trellis` 只在维护者本地保留，不再跟踪到 GitHub；应用运行不依赖这些目录。公开仓库不再自动构建后续推送，现有安装／更新仍使用与应用目录版本对应的已验证 Release。以后若更改 `shendu/`，须另行构建并发布对应镜像，或明确选择源码构建。

[安全、备份与部署检查记录](docs/security-audit.md)

## 开发与检查

在 `shendu/` 中执行：

```sh
npm ci
npm run check
npm test
```

`npm test` 会先构建前端，再运行隔离测试；`npm run build` 可单独构建，`npm run dev` 监视服务端文件。修改 `ui/` 后需重新构建并刷新页面。启动后可运行 `npm run smoke:ui -- http://127.0.0.1:3000` 检查健康状态和实际静态资源。

技术栈：**Node.js · SQLite · 原生 JavaScript · React · shadcn/ui · Radix UI · Tailwind CSS · Vite**。浏览器使用本地构建资源，不加载远程组件 CDN。

## 项目文档

交给新维护者时，直接使用 [GitHub `main`](https://github.com/hikling/shendu-v1/tree/main) 获取应用源码、插画、测试和公开文档，并阅读[开发与交接手册](HANDOVER.md)。本地开发工具与任务记录需另行交接。需要随附入口文件时，使用 **Python 3.11+ 和 Git**，在已提交并同步到 GitHub 的干净仓库根目录生成轻量包：

```sh
python scripts/package-handover.py --output-dir ../交接包
```

ZIP **小于 20 KiB**，只含 `shendu-v1-handover/` 下的简短 `README.md` 链接说明、`VERSION.json` 与 `HANDOVER-MANIFEST.json`，旁边附 `.zip.sha256`。应用代码和全部素材留在 GitHub，不重复打包；接手者克隆仓库后运行与维护。只做校验不需要 Git，详细命令见手册。现有站点的数据、密钥和备份不在本次交接范围。

| 使用与维护 | 设计与实现 |
| --- | --- |
| [完整部署指南](docs/deployment.md) | [产品方向](PRODUCT.md) · [设计约定](DESIGN.md) |
| [迁移与回退](UPGRADING.md) | [交互契约](UX-CONTRACT.md) · [组件接入](docs/shadcn-adoption.md) |
| [最终审查与发布记录](docs/security-audit.md) | [插画与素材来源](art/record-library/README.md) · [第三方声明](THIRD-PARTY-NOTICES.md) |

代码公开，运行中的账户、复盘资料、数据库与密钥由部署者自行保管。服务器管理员持有运行时解密能力，相关边界见[加密与账户归属](docs/deployment.md#加密与账户归属)。
