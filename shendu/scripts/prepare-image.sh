#!/bin/sh
# Install a verified CI image; never silently compile on the deployment host.
set -eu
umask 077
fail() { printf '镜像准备失败：%s\n' "$*" >&2; exit 1; }
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
app_dir="$(CDPATH= cd -- "$script_dir/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$app_dir/.." && pwd)"
cd "$app_dir"
git_app() { git -c safe.directory="$repo_dir" -c core.fileMode=false -C "$repo_dir" "$@"; }
git_app diff --quiet HEAD -- shendu || fail '应用源码存在本地修改，请保存修改后再部署。'
source_tree="$(git_app rev-parse HEAD:shendu)" || fail '无法确定当前应用版本，请使用完整 Git 克隆。'
[ "${#source_tree}" -eq 40 ] || fail '应用版本编号不正确。'
case "$source_tree" in *[!0-9a-f]*) fail '应用版本编号不正确。' ;; esac
platform="$(docker info --format '{{.OSType}} {{.Architecture}}')" || fail '无法读取 Docker 平台。'
case "$platform" in
  'linux x86_64'|'linux amd64') arch=amd64 ;;
  'linux aarch64'|'linux arm64') arch=arm64 ;;
  *) fail "预构建镜像支持 Linux amd64/arm64，当前为 $platform。" ;;
esac
image="shendu-deploy:$source_tree-$arch"
marker='# Managed by Shendu prepare-image.sh. Do not edit.'
override="$app_dir/compose.override.yaml"
check_override() {
  [ ! -e "$app_dir/compose.override.yml" ] && [ ! -L "$app_dir/compose.override.yml" ] || fail '存在自定义 compose.override.yml，请先按部署指南处理。'
  [ ! -L "$override" ] || fail 'Compose 镜像配置不能是符号链接。'
  if [ -e "$override" ]; then
    [ -f "$override" ] && [ "$(head -n 1 "$override")" = "$marker" ] || fail '已有 compose.override.yaml 不是安装器生成的文件，未覆盖。'
  fi
}
check_override
temporary=''
override_temporary=''
cleanup() {
  [ -z "$temporary" ] || rm -rf -- "$temporary"
  [ -z "$override_temporary" ] || rm -f -- "$override_temporary"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
image_matches() {
  metadata="$(docker image inspect --format '{{index .Config.Labels "io.shendu.source-tree"}} {{.Os}} {{.Architecture}}' "$image" 2>/dev/null)" || return 1
  [ "$metadata" = "$source_tree linux $arch" ]
}
if image_matches; then
  echo "复用本机已验证镜像：$image"
else
  case "${SHENDU_BUILD_FROM_SOURCE:-0}" in
    1)
      echo '已明确选择源码构建；服务器将安装依赖并编译，耗时取决于配置与网络。'
      docker build --build-arg "SHENDU_SOURCE_TREE=$source_tree" -t "$image" . || fail '源码构建失败，原容器未替换。'
      ;;
    0)
      command -v curl >/dev/null 2>&1 || fail '需要 curl 下载预构建镜像。'
      command -v sha256sum >/dev/null 2>&1 || fail '需要 sha256sum 校验镜像。'
      mkdir -p "$app_dir/tmp"
      temporary="$(mktemp -d "$app_dir/tmp/.deploy-image.XXXXXX")"
      archive="shendu-linux-$arch.tar.gz"
      url="https://github.com/hikling/shendu-v1/releases/download/deploy-$source_tree/$archive"
      printf '获取已通过 CI 的 %s 镜像（无需 npm 安装或前端编译）：%.8s\n' "$arch" "$source_tree"
      if ! curl -fL --retry 2 --connect-timeout 10 --max-time 60 --silent --show-error "$url.sha256" -o "$temporary/checksum"; then
        fail '该版本镜像尚未发布或 GitHub 无法访问。请确认 GitHub Actions 发布成功后重试；不会自动切回耗时的本机编译。'
      fi
      expected="$(awk 'NR==1 {print $1}' "$temporary/checksum")"
      [ "${#expected}" -eq 64 ] || fail '镜像校验文件不正确。'
      case "$expected" in *[!0-9a-f]*) fail '镜像校验文件不正确。' ;; esac
      curl -fL --retry 2 --connect-timeout 10 --max-time 600 --speed-limit 1024 --speed-time 45 --progress-bar "$url" -o "$temporary/$archive" || fail '镜像下载失败；原容器、配置和数据未替换。'
      actual="$(sha256sum "$temporary/$archive")"
      [ "${actual%% *}" = "$expected" ] || fail '镜像 SHA-256 校验失败，未加载，也未替换原容器。'
      docker load --input "$temporary/$archive" || fail '镜像加载失败；原容器未替换。'
      ;;
    *) fail 'SHENDU_BUILD_FROM_SOURCE 只接受 0 或 1。' ;;
  esac
  image_matches || fail '镜像版本标签或平台不匹配，未更改 Compose 配置。'
fi
# Keep .env and secrets byte-for-byte intact. Publish selection only after the
# correct image exists locally; Compose run/exec/backup then share this image.
override_temporary="$(mktemp "$app_dir/.deploy-image.override.XXXXXX")"
printf '%s\nservices:\n  shendu:\n    image: %s\n    pull_policy: never\n' "$marker" "$image" > "$override_temporary"
check_override
mv -f -- "$override_temporary" "$override"
override_temporary=''
echo "部署镜像已就绪：$image"
