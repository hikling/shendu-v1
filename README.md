<div align="center">

# 慎独 · Shendu v1

**言寡尤，行寡悔 · 慎独存诚**

给自己用的个人成长复盘系统。记录事实，调整行动，回来验证。

[![构建检查](https://github.com/hikling/shendu-v1/actions/workflows/verify.yml/badge.svg)](https://github.com/hikling/shendu-v1/actions/workflows/verify.yml)

[快速部署](#debian-1213-服务器部署) · [本地运行](#本地运行) · [完整部署指南](docs/deployment.md) · [迁移旧站](UPGRADING.md)

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

- **安静地写**：逐题填写、手动保存草稿；完成后锁定，保留当时的判断。
- **按时回来**：行动验证保留原计划、预期日期、实际结果与下一次调整。
- **慢慢回看**：历史复盘可搜索和筛选；概览沿弧线轮播已经验证的记录。
- **看见积累**：阶段与日历汇总每日足迹、农历节气、阶段目标和待验证行动。
- **自己保管**：自托管 SQLite、账户隔离、数据加密，以及个人、整站和外部备份。

桌面与手机共用纸感界面、宋体和六类插画配色，并支持减少动态效果。插画、装饰字体和前端资源随仓库提供，中文字体使用本机字体回退；**运行时不需要图像 API 密钥或外部生成服务**。

## Debian 12/13 服务器部署

**一条命令，填写域名后自动部署。** 准备 Debian 12/13 服务器，将域名指向服务器，开放 TCP 80、443；HTTP/3 可另开 UDP 443。登录服务器后进入 **root shell**（普通账户先执行 `su -`），运行：

```sh
curl -fsSL https://raw.githubusercontent.com/hikling/shendu-v1/main/install.sh -o shendu-install.sh && sh shendu-install.sh
```

按提示输入域名，例如 `review.example.com`，不带 `https://`。脚本自动下载到 `/opt/shendu-v1`、安装缺少的依赖、生成密钥、构建并启动 **Docker Compose + Caddy**，最后检查应用与前端资源并显示访问地址。已有 Docker 和配置会被沿用，宿主机无需安装 Node.js，也无需手动修改 `.env`。

如果提示找不到 `curl`，先执行一次 `apt-get update && apt-get install -y curl`，再运行上面的命令。首次构建需要等待；HTTPS 证书由 Caddy 自动申请，取决于域名解析和端口连通。

完成后打开显示的 HTTPS 地址。第一个注册账户会成为超级管理员，随后自动关闭公开注册。

安装中断可重跑同一命令，已有配置、密钥和数据不会被覆盖。**已运行的站点升级使用下面的更新命令**；旧 `Shendu` 或 ZIP 部署先看[迁移指南](UPGRADING.md)。自定义目录、配置与排错见[完整部署指南](docs/deployment.md)。

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

在 root shell 执行：

```sh
sh /opt/shendu-v1/shendu/scripts/update.sh /opt/shendu-v1
```

脚本会询问是否先创建整站加密快照，建议输入 `y`；然后拉取 `origin/main`、重新构建并检查容器健康。它要求部署目录是无本地代码改动的 `main` 分支 Git 克隆，并保留现有 `.env`。完整过程见[更新与检查](docs/deployment.md#更新与检查)。

## 数据与备份

数据库与原主密钥需要一起保管。重建容器会保留挂载的数据目录；不要在升级时删除 `.env`、`data/` 或 Caddy 卷。

| 需要保存什么 | 使用方式 |
| --- | --- |
| 个人资料 | 在「数据备份」导出加密的 `.shendu` 文件 |
| 整个站点 | 超级管理员导出 `.shendu-site`，或在服务器生成 `.shendu-db` 快照 |
| 另一处副本 | 连接 WebDAV / S3，手动、每天或每周备份 |

[数据目录、密钥与恢复说明](docs/deployment.md#数据与备份) · [旧 Shendu / ZIP 部署迁移与回退](UPGRADING.md)

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

| 使用与维护 | 设计与实现 |
| --- | --- |
| [完整部署指南](docs/deployment.md) | [产品方向](PRODUCT.md) · [设计约定](DESIGN.md) |
| [迁移与回退](UPGRADING.md) | [交互契约](UX-CONTRACT.md) · [组件接入](docs/shadcn-adoption.md) |
| [构建与容器检查](.github/workflows/verify.yml) | [插画与素材来源](art/record-library/README.md) · [第三方声明](THIRD-PARTY-NOTICES.md) |

代码公开，运行中的账户、复盘资料、数据库与密钥由部署者自行保管。服务器管理员持有运行时解密能力，相关边界见[加密与账户归属](docs/deployment.md#加密与账户归属)。
