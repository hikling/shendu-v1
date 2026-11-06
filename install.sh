#!/bin/sh
# Standalone bootstrap: sh install.sh [domain] [install-dir]
set -eu
umask 077

fail() { printf '安装失败：%s\n' "$*" >&2; exit 1; }

case "${1:-}" in
  -h|--help) echo '用法：sh install.sh [域名] [安装目录，默认 /opt/shendu-v1]'; exit 0 ;;
esac
[ "$#" -le 2 ] || fail '参数过多。用法：sh install.sh [域名] [安装目录]'
[ "$(id -u)" -eq 0 ] || fail '请先执行 su - 进入 root 账户，再运行安装命令。'

os_release=$(cat /etc/os-release) || fail '无法读取操作系统版本。'
os_id=$(printf '%s\n' "$os_release" | sed -n 's/^ID=//p' | tr -d '"')
os_version=$(printf '%s\n' "$os_release" | sed -n 's/^VERSION_ID=//p' | tr -d '"')
[ "$os_id" = debian ] || fail '自动安装支持 Debian 12/13；其他系统请按部署指南手动安装 Docker。'
case "$os_version" in 12|13) ;; *) fail '自动安装支持 Debian 12/13。' ;; esac

domain=${1:-}
repo_dir=${2:-/opt/shendu-v1}
case "$repo_dir" in /*) ;; *) fail '安装目录必须是绝对路径。' ;; esac
[ "$repo_dir" != / ] || fail '不能把系统根目录用作安装目录。'

if ! command -v git >/dev/null 2>&1 || [ ! -s /etc/ssl/certs/ca-certificates.crt ]; then
  echo '正在安装 Git 与 HTTPS 证书依赖……'
  apt-get update || fail '无法更新系统软件源。'
  apt-get install -y git ca-certificates || fail '无法安装 Git 与证书依赖。'
fi

git_in_repo() {
  git -c safe.directory="$repo_dir" -c core.fileMode=false -C "$repo_dir" "$@"
}

if [ -e "$repo_dir" ]; then
  [ -d "$repo_dir/.git" ] || fail "$repo_dir 已存在且不是项目 Git 克隆；为保护原有文件，未覆盖。"
  origin=$(git_in_repo config --get remote.origin.url) || fail '无法确认现有目录的仓库来源。'
  case "$origin" in
    https://github.com/hikling/shendu-v1|https://github.com/hikling/shendu-v1.git|git@github.com:hikling/shendu-v1.git) ;;
    *) fail '现有目录不是 hikling/shendu-v1 仓库，未执行安装。' ;;
  esac
  branch=$(git_in_repo symbolic-ref --quiet --short HEAD) || fail '现有目录处于游离提交状态。'
  [ "$branch" = main ] || fail '现有目录不是 main 分支，未执行安装。'
  git_in_repo diff --quiet && git_in_repo diff --cached --quiet || fail '现有项目有未提交的代码修改，请先保存修改。'
  echo '复用现有项目目录；不会拉取或覆盖代码。升级现有站点请使用更新脚本。'
else
  echo '正在下载慎独 main 分支……'
  git clone --branch main --single-branch https://github.com/hikling/shendu-v1.git "$repo_dir" || fail '项目下载失败；请检查服务器能否连接 GitHub，再重试。'
fi

[ -f "$repo_dir/shendu/scripts/install.sh" ] && [ -f "$repo_dir/shendu/compose.yaml" ] || fail '项目不完整，缺少安装脚本或 Compose 配置。'
exec sh "$repo_dir/shendu/scripts/install.sh" "$domain"
