# 部署与维护

本页说明慎独的服务器配置、更新、备份和故障处理。全新 Debian 安装可先按 [README 的一条命令部署](../README.md#debian-1213-服务器部署)操作；从旧 `Shendu` 仓库或 ZIP 目录迁移，请先读[迁移与回退](../UPGRADING.md)。

## 部署前准备

推荐 Debian 12/13、Docker Engine、Compose v2 和仓库自带的 Caddy。安装脚本使用 [Docker 官方 Debian 软件源](https://docs.docker.com/engine/install/debian/)。

- 准备指向服务器公网 IP 的域名；如设置了 AAAA 记录，也需保证对应 IPv6 能访问服务器。
- 在主机和云厂商防火墙开放 TCP 80、443；HTTP/3 另需 UDP 443。
- 确认没有其他服务占用 80、443，安装与更新命令在 root shell 中执行；普通账户先运行 `su -`。
- 下文默认仓库位于 `/opt/shendu-v1`，应用目录为 `/opt/shendu-v1/shendu`。自定义路径时同步调整命令。

## 自动安装

在 root shell 执行：

```sh
curl -fsSL https://raw.githubusercontent.com/hikling/shendu-v1/main/install.sh -o shendu-install.sh && sh shendu-install.sh
```

只需按提示填写域名。脚本依次浅克隆当前代码、补齐依赖、生成 `.env`、下载并校验 CI 预构建镜像、等待容器健康、检查实际 JS/CSS，再显示访问地址。服务器默认不安装 npm 依赖、不编译前端、不构建应用镜像。下载失败时不会执行安装入口脚本。若服务器缺少 `curl`，先运行 `apt-get update && apt-get install -y curl`。

也可直接提供域名与安装路径，省去提问：

```sh
sh shendu-install.sh review.example.com /srv/shendu-v1
```

省略路径时默认 `/opt/shendu-v1`。已经手动克隆了本仓库，也可以直接运行应用目录中的安装器：

```sh
sh /opt/shendu-v1/shendu/scripts/install.sh review.example.com
```

安装器会复用可用的 Docker Engine 和 Compose v2；没有 Docker 时使用官方 Debian 软件源安装。已存在但不完整的 Docker 安装会给出修复提示，不会擅自卸载现有软件。镜像下载、校验或加载失败时，不替换正在运行的旧容器，也不自动转为耗时的本机编译。

当前版本安装中断后可重跑原命令：已有 `.env` 保持原样，原密钥、数据、备份和 Caddy 卷保留；若目录中有数据却缺少 `.env`，会停止并要求恢复配置。域名参数与已有配置冲突时也会停止。不要通过删除配置或数据“重新安装”。旧版本中断请按下一节先更新脚本。

安装入口不会拉取已有目录的新版本。正常升级使用[更新命令](#更新与检查)；已有目录必须是本仓库无本地代码改动的 `main` 分支克隆，ZIP 目录或其他同名文件夹不会被覆盖。

## 旧版构建中断与重新搭建

适用于本仓库无本地代码修改的 `main` 分支克隆。还在运行旧版 `npm ci`、Vite 或 Docker 构建时，先按 **Ctrl+C** 停止旧流程，然后在 root shell 执行：

```sh
cd /opt/shendu-v1 && git -c core.fileMode=false pull --ff-only && sh shendu/scripts/install.sh
```

自定义路径时替换 `/opt/shendu-v1`。下载最新根安装入口并重跑，并不会更新现有克隆中的旧脚本；上面的命令先快进更新代码，再启动新的镜像下载流程。`&&` 保证目录切换或更新失败时不会继续执行旧安装器。Git 提示代码修改或分支冲突时，先另存并处理修改，不要强制重置。

已有 `.env`、完整 `data/`、原主密钥、备份和 Caddy 卷都需保留。安装器会复用配置，不需要再次清空或克隆目录。已正常运行的站点应使用[最新更新器](#更新与检查)，可选择先创建整站加密快照，并在新镜像准备期间继续保留旧应用运行。

默认步骤为下载、校验、加载预构建镜像和健康检查，不执行服务器上的 npm/Vite/应用镜像编译。相同源码和架构的本机镜像可直接复用；网络慢仍会影响首次 Docker 与镜像下载。若提示对应镜像尚未发布，等待 [Actions](https://github.com/hikling/shendu-v1/actions/workflows/verify.yml) 成功后重试。

## 环境配置

安装脚本首次从 `.env.example` 创建权限为 `600` 的 `.env`，写入所填域名与随机主密钥，并创建 `data/`、`tmp/` 和 `backups/`。通常无需手动编辑。已有 `.env` 不会被覆盖。

| 变量 | 自带 Compose 的设置 | 作用 |
| --- | --- | --- |
| `SHENDU_DOMAIN` | 你的实际域名 | 只写域名，例如 `review.example.com`；Caddy 用它申请 HTTPS 证书 |
| `SHENDU_PORT` | `3000` | 应用的容器内端口；自带 Caddy 上游与健康检查均使用 3000，保持此值 |
| `SHENDU_MASTER_KEY` | 安装脚本生成的 64 位十六进制值 | 服务器内部数据与备份凭据的加密密钥 |
| `SHENDU_MASTER_KEY_PATH` | `/app/data/backup-master.key` | 容器内持久化的原主密钥路径 |
| `SHENDU_SECURE_COOKIE` | `true` | 自带 Caddy 提供 HTTPS 时保持开启；仅本机 HTTP 调试使用 `false` |
| `SHENDU_TRUST_PROXY` | Compose 明确设为 `true` | 允许从可信代理的 `X-Forwarded-For` 读取限流地址；直接 Node.js 运行默认关闭，勿在端口公开时开启 |
| `SHENDU_DATA_DIR` | `/app/data` | 容器内数据库目录，挂载到宿主机 `./data` |

快照工具固定使用容器内 `/app/tmp`，挂载到宿主机 `./tmp`；旧版 `.env` 中的 `SHENDU_TMP_DIR` 已不再使用，保留该旧变量不会影响升级。

自动安装已完成配置校验和启动。只有手动维护配置后，才需要在应用目录重新检查并启动：

```sh
cd /opt/shendu-v1/shendu
chmod 600 .env
docker compose config >/dev/null
sh scripts/prepare-image.sh
docker compose up -d
docker compose ps
```

`docker compose config` 不加重定向会输出展开后的环境配置，可能包含密钥；不要把完整输出粘贴到公开问题中。

### HTTPS 与服务结构

[compose.yaml](../shendu/compose.yaml)包含应用 `shendu` 和反向代理 `caddy`；应用不直接映射宿主机端口，Caddy 通过内部网络访问 `shendu:3000`。

只有应用容器接收数据加密配置，Caddy 仅接收域名。自带 Compose 在封闭的应用网络中开启可信代理模式；自行使用 Node.js 或修改端口映射时，默认保持 `SHENDU_TRUST_PROXY=false`，避免客户端伪造转发地址绕过限流。

[Caddyfile](../shendu/Caddyfile)会为符合条件的公网域名[自动申请 HTTPS 证书](https://caddyserver.com/docs/automatic-https)。证书和配置保存在 Docker 的 `caddy_data`、`caddy_config` 命名卷中。DNS 未指向服务器或端口被阻断时，证书无法正常签发。

[Dockerfile](../shendu/Dockerfile)由 GitHub Actions 在原生 amd64/arm64 机器上构建并测试，独立构建阶段执行 `npm ci` 和 `npm run build`，复用 BuildKit 缓存。运行镜像使用 Node.js 24，包含服务端、静态资源和编译产物；宿主机无需安装 Node.js。入口脚本为挂载目录校正权限后，以普通 `node` 用户运行应用。

### 预构建镜像与本机缓存

`prepare-image.sh` 按 `git rev-parse HEAD:shendu` 的应用目录版本和 Docker 平台选择镜像，从公开 GitHub Release `deploy-<应用目录版本>` 下载压缩镜像和 SHA-256 校验文件；无需登录镜像仓库。只有两种平台的测试和镜像检查都通过后才发布。下载后校验 SHA-256、镜像源码标签和平台，再写入安装器管理的 `compose.override.yaml`。该文件不包含密钥，不进入 Git 或镜像；`.env` 不会被改写。普通 Compose 和快照命令自动使用同一镜像。

相同版本的本机镜像通过检查后直接复用，不下载、不编译。仅 README、Trellis 记录等应用目录外的变化会复用同一版本。`compose.override.yaml` 或 `.yml` 如有自行维护的配置，安装器会停止，需先自行合并/保存配置，不能直接覆盖。

默认部署耗时主要是首次 Docker/Caddy/应用镜像下载与启动；网络慢仍可能等待，但不再受服务器编译能力限制。如果提示镜像尚未发布，先查看 [Actions](https://github.com/hikling/shendu-v1/actions/workflows/verify.yml)，等待成功后重试，不要换成随机版本。

需要自行编译时可明确执行 `SHENDU_BUILD_FROM_SOURCE=1 sh scripts/prepare-image.sh`，再 `docker compose up -d`；这是可选的源码路径。基于源码的 Docker 构建仍需联网和足够内存，耗时不会由预构建路径保证。

## 首次启动与检查

安装器会检查容器内应用健康与前端资源；公网 HTTPS 还取决于 DNS、防火墙和 Caddy 证书申请。需要核对外网访问时执行：

```sh
cd /opt/shendu-v1/shendu
docker compose ps
shendu_domain=$(sed -n 's/^SHENDU_DOMAIN=//p' .env)
curl -fsS "https://$shendu_domain/healthz"
```

健康检查应返回含 `"ok":true` 的 JSON。打开域名，注册第一个账户：它会成为超级管理员，并自动关闭公开注册。之后由管理员创建成员，或由超级管理员决定是否重新开放注册。

应用默认按北京时间处理复盘日期。插画、装饰字体与组件资源由本站提供，中文字体使用本机字体回退；运行时不需要图像 API 密钥、Python 或图像生成服务。

## 更新与检查

在 root shell 执行：

```sh
shendu_updater=$(mktemp)
curl -fsSL https://raw.githubusercontent.com/hikling/shendu-v1/main/shendu/scripts/update.sh -o "$shendu_updater" && sh "$shendu_updater" /opt/shendu-v1
rm -f "$shendu_updater"
```

更新脚本要求：

- 目录是本仓库的 `main` 分支 Git 克隆；ZIP 解压目录不适用。
- 受版本控制的文件没有本地内容修改，已有 `.env` 存在。
- Docker Engine 和 Compose v2 可用。

脚本首先校验配置，再询问是否创建更新前整站加密快照。**建议输入 `y`；直接回车或非交互运行默认跳过备份。** 已选择备份却生成失败时，更新会停止。

下载最新更新器可让仍在使用旧版脚本的服务器直接采用快速部署。旧更新器会把自己复制后执行，单纯在其运行中拉取新代码不能改变已经运行的旧流程。

随后脚本快进更新 `origin/main`、拉取 Caddy、下载/复用准确版本的应用镜像，再启动应用等待健康与前端资源检查。镜像准备期间旧应用继续运行；应用通过检查后再启动完整服务。核对：

```sh
cd /opt/shendu-v1/shendu
docker compose ps
docker compose logs --tail=100 shendu
shendu_domain=$(sed -n 's/^SHENDU_DOMAIN=//p' .env)
curl -fsS "https://$shendu_domain/healthz"
```

保留 `.env`、完整 `data/`、`data/backup-master.key` 和 Caddy 卷。不要为“刷新版本”删除数据库或主密钥。GitHub 的 `main` 或 CI 已更新，不代表现有服务器容器自动更新；需要运行更新器准备并切换镜像。

## 数据与备份

以下路径均相对于 `shendu/`：

| 路径 | 用途 |
| --- | --- |
| `data/shendu.db` | SQLite 数据库；运行时可能同时存在 `-wal`、`-shm` 文件 |
| `data/backup-master.key` | 原服务器内部主密钥；与数据库配套保管 |
| `data/server-backup.password` | 创建服务器整站快照时使用的恢复密码文件 |
| `backups/*.shendu-db` | 服务器整站加密快照 |
| `tmp/` | 导入与备份过程中的临时文件 |
| `.env` | 域名、密钥与容器环境配置 |
| `compose.override.yaml` | 安装器选择的已校验本机镜像，不含密钥 |

`data/` 和 `tmp/` 是宿主机挂载目录，重建容器不会删除它们。这些运行资料、`.env` 和备份文件不会作为项目代码提交到 Git。

### 三种导出方式

| 格式 | 从哪里生成 | 使用场景 |
| --- | --- | --- |
| `.shendu` | 应用内「数据备份」 | 个人资料的加密导出与恢复 |
| `.shendu-site` | 超级管理员的整站备份功能 | 通过网页备份与恢复整个站点 |
| `.shendu-db` | 服务器备份脚本 | 数据库和原主密钥的加密快照 |

应用还支持最多 8 个 S3 / WebDAV 目标，可手动、每天或每周执行外部备份。外部服务收到加密备份包，不接收明文复盘正文。

### 服务器整站快照

在已部署的应用目录运行：

```sh
cd /opt/shendu-v1/shendu
sh scripts/site-backup.sh
```

快照默认写到 `backups/`；首次需要时生成 `data/server-backup.password`，权限为 `600`。备份包和恢复密码应分别另存到服务器之外。脚本会优先使用运行中的容器，失败时尝试临时容器；输出文件只有生成成功后才会保存。

更新前备份和手动快照共用同一份密码文件；并发首次备份也不会覆盖已生成的密码。现有密码文件会按原字节使用，不会删除其中的空格或换行。不要把快照输出设置为数据库、SQLite 的 `-wal`/`-shm` 文件、主密钥或密码文件；CLI 会拒绝这类覆盖。

服务器快照恢复由 `scripts/admin-cli.mjs restore` 执行，需使用对应密码文件；应先停应用并在隔离环境演练，确保配置、数据库和主密钥作为一组恢复。个人与网页整站恢复使用应用内各自入口，不要仅凭文件扩展名互换工具。

从旧 `Shendu` 或 ZIP 部署切换时，请按 [UPGRADING.md](../UPGRADING.md) 保留旧站完整副本。旧版个人加密备份保持兼容；旧版整站包不作为跨仓库直接恢复的兼容承诺。

## 加密与账户归属

复盘正文、设置和外部备份凭据使用服务器内部主密钥加密后落盘。**数据库与原主密钥需配套保存，丢失原密钥会导致原数据无法解密。** 普通管理员可管理账户状态，应用不向其提供其他成员的复盘正文；服务器管理员持有运行时解密能力，仍需保护主机、`.env`、数据库与密钥。

个人备份整包使用 PBKDF2-HMAC-SHA-256（600,000 次）与 AES-256-GCM 加密。备份密码与登录密码、服务器主密钥用途不同。

新版个人备份在密文中记录所属用户名。跨账户恢复时，需要再次输入原用户名和该文件的备份密码；旧版加密包会尽量读取原 profile 进行归属校验。代码仓库公开不代表运行中的账户、资料或密钥公开。

## 本地 Node.js 运行

需要 Git 和 Node.js 22.13+，推荐 Node.js 24。先按 [README](../README.md#本地运行)安装依赖并启动，默认访问 `http://localhost:3000`。

Node 启动读取进程环境变量，不会自动加载 Compose 的 `.env`。未设置时，数据库与临时目录分别默认为当前工作目录的 `./data`、`./tmp`，内部密钥路径默认为数据目录中的 `backup-master.key`；首次启动自动创建。HTTP 本地运行默认不使用 Secure Cookie。

临时更改端口示例：

```sh
# Linux / macOS，在 shendu/ 中
SHENDU_PORT=3100 npm start
```

```powershell
# Windows PowerShell，在 shendu/ 中
$env:SHENDU_PORT='3100'
npm start
```

本地开发与测试使用独立目录，避免指向生产数据库。`npm test` 使用隔离的临时数据环境；修改 `ui/` 后重新运行 `npm run build` 并刷新页面。服务启动后，在同一应用目录可检查静态资源：

```sh
npm run smoke:ui -- http://127.0.0.1:3000
```

## 故障处理

### HTTPS 无法访问

检查域名的 A / AAAA 记录、防火墙和 80/443 端口占用，然后查看 Caddy 日志：

```sh
cd /opt/shendu-v1/shendu
docker compose logs --tail=200 caddy
```

确认 `.env` 的 `SHENDU_DOMAIN` 仅含域名，`SHENDU_PORT` 为 `3000`。

### 容器退出或健康检查失败

```sh
cd /opt/shendu-v1/shendu
docker compose ps
docker compose logs --tail=200 shendu
```

按日志检查镜像准备、数据目录权限与原主密钥是否匹配。`/healthz` 为 503 且提示 `data_key_unavailable` 时，应恢复原密钥与对应配置；不要随机生成新密钥替换旧站密钥。

### 更新后仍是旧界面

先确认已执行最新更新脚本并切换到对应镜像，再用 Windows `Ctrl+F5` 强制刷新。手机可清除本站缓存后重开。仅执行 `git pull` 不会更新正在运行的镜像。

### 服务器存在本地代码修改

更新脚本会列出修改并停止。在仓库目录先用 `git status --short`、`git diff` 核对；保存或迁移自己需要的改动后再继续。不要直接覆盖未知改动，也不要删除 `.env` 或运行数据来让 Git 变干净。脚本会忽略单纯的可执行权限位变化。

### ZIP 旧部署迁移

ZIP 目录没有 Git 历史，不能直接运行更新脚本。先保留原目录、数据库、主密钥和配置，再按[迁移指南](../UPGRADING.md)克隆新目录并迁移；新旧部署不要同时占用相同容器名与域名端口。

## 构建与维护资料

- [Linux CI](../.github/workflows/verify.yml)：安装锁定依赖、构建组件、检查脚本和测试、验证 Compose、构建镜像，再启动容器检查健康与实际 JS/CSS。
- [组件接入说明](shadcn-adoption.md)：本地维护的 shadcn/ui、React 与 Radix UI 组件及原生业务边界。
- [产品方向](../PRODUCT.md)、[设计约定](../DESIGN.md)、[交互契约](../UX-CONTRACT.md)和 `.trellis/`：产品与开发规范。
- [第三方声明](../THIRD-PARTY-NOTICES.md)及[插画来源](../art/record-library/README.md)：组件和素材来源。
