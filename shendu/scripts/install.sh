#!/bin/sh
set -eu
umask 077

fail() { printf '安装失败：%s\n' "$*" >&2; exit 1; }
case "${1:-}" in
  -h|--help) echo '用法：sh scripts/install.sh [域名]'; exit 0 ;;
esac
[ "$#" -le 1 ] || fail '参数过多。用法：sh scripts/install.sh [域名]'
[ "$(id -u)" -eq 0 ] || fail '请先执行 su - 进入 root 账户，再运行本脚本。'

os_release=$(cat /etc/os-release) || fail '无法读取操作系统版本。'
os_id=$(printf '%s\n' "$os_release" | sed -n 's/^ID=//p' | tr -d '"')
os_version=$(printf '%s\n' "$os_release" | sed -n 's/^VERSION_ID=//p' | tr -d '"')
os_codename=$(printf '%s\n' "$os_release" | sed -n 's/^VERSION_CODENAME=//p' | tr -d '"')
[ "$os_id" = debian ] || fail '自动安装支持 Debian 12/13；其他系统请按部署指南手动部署。'
case "$os_version:$os_codename" in 12:bookworm|13:trixie) ;; *) fail '自动安装支持 Debian 12/13。' ;; esac

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
repo_dir=$(CDPATH= cd -- "$app_dir/.." && pwd)
cd "$app_dir"
[ -f .env.example ] && [ -f compose.yaml ] && [ -f scripts/smoke-ui.mjs ] || fail '项目不完整，请重新拉取完整项目。'

normalize_domain() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}
valid_domain() {
  [ "${#1}" -le 253 ] || return 1
  case "$1" in
    ''|*[!a-z0-9.-]*|*..*|.*|*.|example.com|*.example.com|example.org|*.example.org|example.net|*.example.net|*.localhost|*.local) return 1 ;;
  esac
  printf '%s\n' "$1" | LC_ALL=C awk -F. '
    NF < 2 { exit 1 }
    { for (i=1; i<=NF; i++) if (length($i)>63 || $i !~ /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/) exit 1 }
    $NF ~ /^[0-9]+$/ { exit 1 }
  '
}

# Read only scalar values; never execute a deployment .env as shell code.
env_value() {
  LC_ALL=C awk -v key="$1" '
    $0 ~ "^[ \t]*" key "[ \t]*=" {
      count++
      value=$0; sub(/^[^=]*=[ \t]*/, "", value); sub(/\r$/, "", value)
      sub(/[ \t]+$/, "", value)
      first=substr(value,1,1)
      if (first == "\"" || first == sprintf("%c",39)) {
        if (substr(value,length(value),1) != first) exit 2
        value=substr(value,2,length(value)-2)
      } else { sub(/[ \t]+#.*/, "", value); sub(/[ \t]+$/, "", value) }
      result=value
    }
    END { if (count != 1) exit 1; print result }
  ' .env
}
valid_key() {
  [ "${#1}" -eq 64 ] || return 1
  case "$1" in *[!a-fA-F0-9]*) return 1 ;; esac
}

requested_domain=$(normalize_domain "${1:-}")
[ ! -L .env ] || fail '.env 是符号链接；请按部署指南手动核对配置，安装器未修改它。'
if [ -e .env ]; then
  [ -f .env ] || fail '.env 不是普通配置文件。'
  domain=$(env_value SHENDU_DOMAIN) || fail '.env 中的 SHENDU_DOMAIN 缺失、重复或格式不支持，请手动核对。'
  domain=$(normalize_domain "$domain")
  valid_domain "$domain" || fail '.env 的域名无效。请填写实际域名，不带协议、路径或端口。'
  [ -z "$requested_domain" ] || [ "$requested_domain" = "$domain" ] || fail '指定域名与已有 .env 不同；为保护配置，未覆盖。修改域名请手动维护原 .env。'
  port=$(env_value SHENDU_PORT) || fail '.env 中需要明确设置 SHENDU_PORT=3000。'
  [ "$port" = 3000 ] || fail '自带 Caddy 与健康检查使用容器端口 3000，请先核对原配置。'
  key=$(env_value SHENDU_MASTER_KEY) || fail '.env 中的 SHENDU_MASTER_KEY 缺失、重复或格式不支持；请恢复原配置。'
  if ! valid_key "$key"; then
    [ -z "$key" ] && [ -f data/backup-master.key ] || fail '原主密钥配置无效；请恢复原密钥，不要生成新密钥覆盖旧数据。'
    persisted_key=$(tr -d '\r\n' < data/backup-master.key)
    valid_key "$persisted_key" || fail '持久化主密钥无效，请恢复原密钥。'
  fi
  echo '保留已有域名与主密钥配置。'
else
  [ ! -L data ] || fail 'data 是符号链接且缺少 .env；请先恢复原配置与密钥，安装器不会生成替代密钥。'
  if [ -d data ] && [ -n "$(find data -mindepth 1 -print -quit)" ]; then
    fail '已有 data 内容但缺少 .env；请先恢复原配置与密钥，安装器不会生成替代密钥。'
  fi
  domain=$requested_domain
  if [ -z "$domain" ]; then
    printf '请输入指向本机的域名（不带 https://）：'
    if [ -t 0 ]; then
      IFS= read -r domain || fail '未读取到域名。'
    elif ( : </dev/tty ) 2>/dev/null; then
      IFS= read -r domain </dev/tty || fail '未读取到域名。'
    else
      fail '当前没有交互终端，请把域名作为参数传入：sh install.sh 你的域名'
    fi
    domain=$(normalize_domain "$domain")
  fi
  valid_domain "$domain" || fail '域名无效。请输入实际域名，不带协议、路径或端口，也不要使用示例域名。'
fi

lock_dir="$app_dir/tmp/.update.lock"
temp_env=''
lock_acquired=0
cleanup() {
  [ -z "$temp_env" ] || rm -f -- "$temp_env"
  if [ "$lock_acquired" -eq 1 ]; then rmdir -- "$lock_dir" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
mkdir -p tmp
mkdir "$lock_dir" 2>/dev/null || fail '另一个安装或更新任务正在运行；请等待它结束后重试。'
lock_acquired=1

packages=''
command -v openssl >/dev/null 2>&1 || packages="$packages openssl"
command -v curl >/dev/null 2>&1 || packages="$packages curl"
if ! command -v docker >/dev/null 2>&1; then
  packages="$packages ca-certificates"
fi
if [ -n "$packages" ]; then
  echo '正在安装缺少的系统依赖……'
  apt-get update || fail '无法更新系统软件源。'
  # Intentional splitting: packages contains only the fixed names above.
  apt-get install -y $packages || fail '无法安装系统依赖。'
fi

if ! command -v docker >/dev/null 2>&1; then
  echo '正在从 Docker 官方源安装 Engine 与 Compose……'
  install -m 0755 -d /etc/apt/keyrings /etc/apt/sources.list.d
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc || fail '无法下载 Docker 官方签名密钥。'
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' "$(dpkg --print-architecture)" "$os_codename" > /etc/apt/sources.list.d/docker.list
  apt-get update || fail '无法更新 Docker 软件源。'
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || fail '无法安装 Docker；已有冲突软件包需按 Docker 官方指南处理，安装器不会自动删除它们。'
fi
docker compose version >/dev/null 2>&1 || fail '已有 Docker 缺少 Compose v2 插件，请按 Docker 官方指南安装 docker-compose-plugin 后重试。'
if ! docker info >/dev/null 2>&1; then
  command -v systemctl >/dev/null 2>&1 || fail 'Docker 未运行，请先启动 Docker 服务后重试。'
  systemctl enable --now docker || fail '无法启动 Docker 服务。'
  docker info >/dev/null 2>&1 || fail 'Docker 服务仍不可用，请先检查 Docker 日志。'
fi

if [ ! -f .env ]; then
  key=$(openssl rand -hex 32) || fail '无法生成随机主密钥。'
  valid_key "$key" || fail '随机主密钥生成失败。'
  temp_env=$(mktemp "$app_dir/.env.install.XXXXXX")
  sed -e "s/^SHENDU_DOMAIN=.*/SHENDU_DOMAIN=$domain/" -e "s/replace_with_64_hex_characters/$key/" .env.example > "$temp_env"
  chmod 600 "$temp_env"
  # Atomic publication without overwriting a concurrently created configuration.
  ln -T -- "$temp_env" .env || fail '.env 已被其他进程创建；请核对原配置后重试。'
  rm -f -- "$temp_env"
  temp_env=''
  echo '已生成域名配置与随机主密钥（权限 600）。'
fi
chmod 600 .env
mkdir -p data tmp backups

echo '[1/4] 校验部署配置……'
docker compose config >/dev/null || fail 'Compose 配置无效，请核对原 .env；配置未被覆盖。'
echo '[2/4] 准备预构建应用镜像并获取 Caddy……'
sh "$script_dir/prepare-image.sh" || fail '应用镜像准备失败；已保留配置和数据，可重新运行安装命令。'
docker compose pull caddy || fail 'Caddy 镜像下载失败；可检查网络后重试。'
echo '[3/4] 启动服务并等待健康检查……'
if ! docker compose up -d --wait --wait-timeout 180; then
  docker compose ps >&2 || true
  fail "服务未通过启动检查。请在 $app_dir 执行 docker compose logs --tail=100 检查；配置与数据已保留。"
fi
echo '[4/4] 检查应用与前端资源……'
docker compose exec -T shendu node scripts/smoke-ui.mjs http://127.0.0.1:3000 || fail '应用或前端资源检查未通过；请查看容器日志后重试。'
docker compose ps
printf '\n安装完成，访问：https://%s\n' "$domain"
echo 'Caddy 会自动申请 HTTPS 证书；若暂时无法访问，请检查域名解析和 TCP 80/443 端口。'
printf '以后更新：sh %s/shendu/scripts/update.sh %s\n' "$repo_dir" "$repo_dir"
