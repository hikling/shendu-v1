#!/bin/sh
# Exercise the real installers with isolated files and fake system commands.
# Never installs packages, creates containers, or writes to the host's /etc.
set -eu

test_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_dir="$(CDPATH= cd -- "$test_dir/../.." && pwd)"
suite_dir="$(mktemp -d "${TMPDIR:-/tmp}/shendu-install-test.XXXXXX")"
trap 'rm -rf -- "$suite_dir"' EXIT
trap 'exit 130' HUP INT TERM
real_cat="$(command -v cat)"
setsid_path="$(command -v setsid)"
export real_cat
tools_dir="$suite_dir/tools"
mkdir -p "$tools_dir" "$suite_dir/templates"
# No real apt, Docker, Git, curl or OpenSSL can be reached through the test PATH.
for utility in awk basename chmod cmp cp cut date dirname find grep head install ln mkdir mktemp mv od pwd readlink rm rmdir sed sleep sort stat tail tr wc; do
  utility_path="$(command -v "$utility")"
  ln -s "$utility_path" "$tools_dir/$utility"
done
ln -s /bin/sh "$tools_dir/sh"

cat > "$suite_dir/templates/id" <<'MOCK'
#!/bin/sh
printf '%s\n' "${MOCK_UID:-0}"
MOCK
cat > "$suite_dir/templates/cat" <<'MOCK'
#!/bin/sh
if [ "$#" -eq 1 ] && [ "$1" = /etc/os-release ]; then
  codename=bookworm
  [ "${MOCK_OS_VERSION:-12}" != 13 ] || codename=trixie
  printf 'ID=%s\nVERSION_ID="%s"\nVERSION_CODENAME=%s\n' "${MOCK_OS:-debian}" "${MOCK_OS_VERSION:-12}" "$codename"
else
  exec "$real_cat" "$@"
fi
MOCK
cat > "$suite_dir/templates/apt-get" <<'MOCK'
#!/bin/sh
printf 'apt-get %s\n' "$*" >> "$MOCK_LOG"
[ "${MOCK_APT_FAIL:-0}" != 1 ] || exit 1
case " $* " in
  *' git '*) cp "$MOCK_TEMPLATES/git" "$MOCK_BIN/git" ;;
esac
case " $* " in
  *' openssl '*) cp "$MOCK_TEMPLATES/openssl" "$MOCK_BIN/openssl" ;;
esac
case " $* " in
  *' docker-ce '*) cp "$MOCK_TEMPLATES/docker" "$MOCK_BIN/docker" ;;
esac
MOCK
cat > "$suite_dir/templates/docker" <<'MOCK'
#!/bin/sh
printf 'docker %s\n' "$*" >> "$MOCK_LOG"
case "$*" in
  'compose version'*) [ "${MOCK_COMPOSE_BAD:-0}" != 1 ] ;;
  info*) [ "${MOCK_DAEMON_STOPPED:-0}" != 1 ] || [ -f "$MOCK_CASE/daemon-started" ] ;;
  'compose config'*) [ "${MOCK_CONFIG_FAIL:-0}" != 1 ] ;;
  'compose build'*) [ "${MOCK_BUILD_FAIL:-0}" != 1 ] ;;
  'compose pull'*) [ "${MOCK_PULL_FAIL:-0}" != 1 ] ;;
  'compose up'*) [ "${MOCK_HEALTH_FAIL:-0}" != 1 ] ;;
  'compose exec'*) [ "${MOCK_SMOKE_FAIL:-0}" != 1 ] ;;
  *) exit 0 ;;
esac
MOCK
cat > "$suite_dir/templates/openssl" <<'MOCK'
#!/bin/sh
printf 'openssl %s\n' "$*" >> "$MOCK_LOG"
[ "${MOCK_OPENSSL_FAIL:-0}" != 1 ] || exit 1
printf '%s\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
MOCK
cat > "$suite_dir/templates/curl" <<'MOCK'
#!/bin/sh
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
[ "${MOCK_DOWNLOAD_FAIL:-0}" != 1 ] || exit 22
while [ "$#" -gt 0 ]; do
  if [ "$1" = -o ]; then
    shift
    printf 'mock Docker signing key\n' > "$1"
    exit 0
  fi
  shift
done
exit 1
MOCK
cat > "$suite_dir/templates/git" <<'MOCK'
#!/bin/sh
printf 'git %s\n' "$*" >> "$MOCK_LOG"
case " $* " in
  *' clone '*)
    [ "${MOCK_CLONE_FAIL:-0}" != 1 ] || exit 128
    for destination do :; done
    mkdir -p "$destination/.git"
    cp -R "$MOCK_FIXTURE/shendu" "$destination/shendu"
    ;;
  *' remote.origin.url '*) printf '%s\n' "${MOCK_ORIGIN:-https://github.com/hikling/shendu-v1.git}" ;;
  *' symbolic-ref '*) printf '%s\n' "${MOCK_BRANCH:-main}" ;;
  *' diff '*) [ "${MOCK_DIRTY:-0}" != 1 ] ;;
  *) exit 0 ;;
esac
MOCK
cat > "$suite_dir/templates/systemctl" <<'MOCK'
#!/bin/sh
printf 'systemctl %s\n' "$*" >> "$MOCK_LOG"
touch_marker="$MOCK_CASE/daemon-started"
printf 'started\n' > "$touch_marker"
MOCK
cat > "$suite_dir/templates/dpkg" <<'MOCK'
#!/bin/sh
printf 'amd64\n'
MOCK
chmod 755 "$suite_dir/templates/"*

case_number=0
new_case() {
  case_number=$((case_number + 1))
  MOCK_CASE="$suite_dir/case-$case_number"
  MOCK_BIN="$MOCK_CASE/bin"
  MOCK_LOG="$MOCK_CASE/commands.log"
  MOCK_FIXTURE="$MOCK_CASE/fixture"
  MOCK_TEMPLATES="$suite_dir/templates"
  export MOCK_CASE MOCK_BIN MOCK_LOG MOCK_FIXTURE MOCK_TEMPLATES
  mkdir -p "$MOCK_BIN" "$MOCK_FIXTURE/shendu/scripts" "$MOCK_CASE/etc/apt/keyrings" "$MOCK_CASE/etc/apt/sources.list.d"
  cp "$suite_dir/templates/"* "$MOCK_BIN/"
  : > "$MOCK_LOG"
  unset MOCK_UID MOCK_OS MOCK_OS_VERSION MOCK_APT_FAIL MOCK_COMPOSE_BAD MOCK_DAEMON_STOPPED MOCK_CONFIG_FAIL MOCK_BUILD_FAIL MOCK_PULL_FAIL MOCK_HEALTH_FAIL MOCK_SMOKE_FAIL MOCK_OPENSSL_FAIL MOCK_DOWNLOAD_FAIL MOCK_CLONE_FAIL MOCK_ORIGIN MOCK_BRANCH MOCK_DIRTY
  # Redirect only system package-source paths in the copied scripts; OS detection
  # is supplied by the fake cat command. All actual installer logic stays intact.
  sed "s|/etc/apt/|$MOCK_CASE/etc/apt/|g" "$repo_dir/install.sh" > "$MOCK_CASE/install.sh"
  sed "s|/etc/apt/|$MOCK_CASE/etc/apt/|g" "$repo_dir/shendu/scripts/install.sh" > "$MOCK_FIXTURE/shendu/scripts/install.sh"
  cp "$repo_dir/shendu/.env.example" "$MOCK_FIXTURE/shendu/.env.example"
  cp "$repo_dir/shendu/compose.yaml" "$MOCK_FIXTURE/shendu/compose.yaml"
  cp "$repo_dir/shendu/scripts/smoke-ui.mjs" "$MOCK_FIXTURE/shendu/scripts/smoke-ui.mjs"
  # The test fixture is a complete deployment source boundary, not real app data.
  : > "$MOCK_FIXTURE/shendu/Dockerfile"
  : > "$MOCK_FIXTURE/shendu/Caddyfile"
  : > "$MOCK_FIXTURE/shendu/scripts/update.sh"
  app_dir="$MOCK_FIXTURE/shendu"
  output="$MOCK_CASE/output.log"
}

run_app() {
  PATH="$MOCK_BIN:$tools_dir" /bin/sh "$app_dir/scripts/install.sh" "$@" > "$output" 2>&1 < /dev/null
}
run_bootstrap() {
  PATH="$MOCK_BIN:$tools_dir" /bin/sh "$MOCK_CASE/install.sh" "$@" > "$output" 2>&1 < /dev/null
}
fail() {
  printf 'FAILED case %s: %s\n' "$case_number" "$*" >&2
  "$real_cat" "$output" >&2
  "$real_cat" "$MOCK_LOG" >&2
  exit 1
}
assert_logged() { grep -F -- "$1" "$MOCK_LOG" >/dev/null || fail "command missing: $1"; }
assert_not_logged() { if grep -F -- "$1" "$MOCK_LOG" >/dev/null; then fail "unexpected command: $1"; fi; }
assert_output() { grep -F -- "$1" "$output" >/dev/null || fail "output missing: $1"; }
expect_app_failure() { if run_app "$@"; then fail 'installer unexpectedly succeeded'; fi; }
expect_bootstrap_failure() { if run_bootstrap "$@"; then fail 'bootstrap unexpectedly succeeded'; fi; }
existing_env() {
  printf '# preserved comment\nSHENDU_DOMAIN=reviews.acme.org\nSHENDU_PORT=3000\nSHENDU_MASTER_KEY=%s\nSHENDU_SECURE_COOKIE=true\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb > "$app_dir/.env"
  cp "$app_dir/.env" "$MOCK_CASE/env-before"
}
pass() { printf 'ok %s - %s\n' "$case_number" "$*"; }

new_case
run_app reviews.acme.org || fail 'fresh install failed'
grep -Fx 'SHENDU_DOMAIN=reviews.acme.org' "$app_dir/.env" >/dev/null || fail 'domain was not configured'
grep -Fx 'SHENDU_MASTER_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$app_dir/.env" >/dev/null || fail 'fresh key was not configured'
[ "$(stat -c %a "$app_dir/.env")" = 600 ] || fail '.env permissions are not 600'
assert_logged 'compose build'
assert_logged '--wait-timeout'
assert_logged 'node scripts/smoke-ui.mjs http://127.0.0.1:3000'
assert_not_logged 'apt-get'
pass 'fresh setup configures domain/key, reuses Docker, waits and checks real UI resources'

new_case
run_app REVIEWS.ACME.ORG || fail 'uppercase domain was rejected'
grep -Fx 'SHENDU_DOMAIN=reviews.acme.org' "$app_dir/.env" >/dev/null || fail 'domain was not normalized'
pass 'domain arguments are normalized before writing fresh configuration'

new_case
MOCK_OS_VERSION=13; export MOCK_OS_VERSION
run_app reviews.acme.org || fail 'Debian 13 install failed'
assert_logged 'compose build'
pass 'Debian 13 is supported as well as Debian 12'

new_case
if PATH="$MOCK_BIN:$tools_dir" "$setsid_path" /bin/sh "$app_dir/scripts/install.sh" > "$output" 2>&1 < /dev/null; then
  fail 'noninteractive install without domain unexpectedly succeeded'
fi
[ ! -e "$app_dir/.env" ] || fail 'missing domain created configuration'
assert_not_logged 'apt-get'
assert_not_logged 'compose build'
pass 'noninteractive fresh install requires an explicit domain'

new_case
existing_env
mkdir -p "$app_dir/data" "$app_dir/backups"
printf 'unchanged database\n' > "$app_dir/data/shendu.db"
printf '%s\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb > "$app_dir/data/backup-master.key"
printf 'unchanged backup\n' > "$app_dir/backups/old.shendu-db"
run_app || fail 'existing install rerun failed'
cmp "$app_dir/.env" "$MOCK_CASE/env-before" || fail '.env was rewritten'
grep -Fx 'unchanged database' "$app_dir/data/shendu.db" >/dev/null || fail 'database changed'
grep -Fx 'unchanged backup' "$app_dir/backups/old.shendu-db" >/dev/null || fail 'backup changed'
grep -Fx bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb "$app_dir/data/backup-master.key" >/dev/null || fail 'original key changed'
assert_not_logged 'openssl'
assert_not_logged 'compose down'
assert_not_logged '--volumes'
pass 'rerun preserves exact configuration, database, original key, backups and volumes'

new_case
printf 'SHENDU_DOMAIN="reviews.acme.org"\nSHENDU_PORT=\0473000\047\nSHENDU_MASTER_KEY="%s"\nSHENDU_SECURE_COOKIE=true\n' bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb > "$app_dir/.env"
printf 'SHENDU_UNUSED=$(printf executed > "%s")\n' "$MOCK_CASE/env-executed" >> "$app_dir/.env"
cp "$app_dir/.env" "$MOCK_CASE/env-before"
run_app reviews.acme.org || fail 'quoted existing values were rejected'
cmp "$app_dir/.env" "$MOCK_CASE/env-before" || fail 'quoted configuration was rewritten'
[ ! -e "$MOCK_CASE/env-executed" ] || fail '.env was executed as shell code'
assert_not_logged 'openssl'
pass 'quoted configuration is read as values without executing shell expressions'

new_case
existing_env
expect_app_failure other.acme.org
cmp "$app_dir/.env" "$MOCK_CASE/env-before" || fail 'conflicting domain changed .env'
assert_not_logged 'compose build'
assert_not_logged 'openssl'
pass 'conflicting domain stops without changing existing configuration'

for bad_domain in 'https://reviews.acme.org' 'reviews.acme.org/path' 'reviews.acme.org:443' '*.acme.org' 'shendu.example.com' '-bad.acme.org' 'reviews.acme.org;echo-bad'; do
  new_case
  expect_app_failure "$bad_domain"
  [ ! -e "$app_dir/.env" ] || fail 'invalid domain created .env'
  assert_not_logged 'compose build'
  pass "rejects invalid domain $bad_domain"
done

new_case
mkdir -p "$app_dir/data"
: > "$app_dir/data/shendu.db"
expect_app_failure reviews.acme.org
[ ! -e "$app_dir/.env" ] || fail 'old data got replacement .env'
assert_not_logged 'openssl'
pass 'missing .env with existing data cannot regenerate a key'

new_case
mkdir -p "$MOCK_CASE/original-data"
printf 'original encrypted database\n' > "$MOCK_CASE/original-data/shendu.db"
ln -s "$MOCK_CASE/original-data" "$app_dir/data"
expect_app_failure reviews.acme.org
[ ! -e "$app_dir/.env" ] || fail 'linked old data got replacement .env'
grep -Fx 'original encrypted database' "$MOCK_CASE/original-data/shendu.db" >/dev/null || fail 'linked old database changed'
assert_not_logged 'openssl'
assert_not_logged 'compose build'
pass 'missing .env with linked data cannot regenerate a key or modify its target'

new_case
ln -s "$MOCK_CASE/missing-data" "$app_dir/data"
expect_app_failure reviews.acme.org
[ ! -e "$app_dir/.env" ] || fail 'dangling data link got replacement .env'
assert_not_logged 'openssl'
assert_not_logged 'compose build'
pass 'dangling data link with missing configuration stops before key generation'

new_case
existing_env
sed 's/SHENDU_PORT=3000/SHENDU_PORT=3100/' "$app_dir/.env" > "$MOCK_CASE/invalid-env"
mv "$MOCK_CASE/invalid-env" "$app_dir/.env"
expect_app_failure
assert_not_logged 'compose build'
pass 'incompatible container port stops instead of silently rewriting config'

new_case
existing_env
sed 's/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/replace_with_64_hex_characters/' "$app_dir/.env" > "$MOCK_CASE/invalid-env"
mv "$MOCK_CASE/invalid-env" "$app_dir/.env"
expect_app_failure
assert_not_logged 'compose build'
assert_not_logged 'openssl'
pass 'invalid existing key is rejected instead of regenerated'

for failing_stage in BUILD HEALTH SMOKE; do
  new_case
  eval "MOCK_${failing_stage}_FAIL=1; export MOCK_${failing_stage}_FAIL"
  expect_app_failure reviews.acme.org
  [ -f "$app_dir/.env" ] || fail 'failure removed generated config'
  if [ "$failing_stage" = BUILD ]; then assert_not_logged 'compose up'; fi
  pass "$failing_stage failure returns nonzero and preserves configuration for retry"
done

new_case
MOCK_COMPOSE_BAD=1; export MOCK_COMPOSE_BAD
expect_app_failure reviews.acme.org
assert_not_logged 'docker-ce'
assert_not_logged 'compose build'
pass 'partial Docker installation is not replaced'

new_case
MOCK_DAEMON_STOPPED=1; export MOCK_DAEMON_STOPPED
run_app reviews.acme.org || fail 'stopped Docker daemon could not be started'
assert_logged 'systemctl enable --now docker'
pass 'installed Docker daemon starts without reinstalling Docker'

new_case
rm "$MOCK_BIN/docker"
run_app reviews.acme.org || fail 'missing Docker could not be installed'
assert_logged 'docker-ce'
assert_logged 'https://download.docker.com/linux/debian/gpg'
[ -s "$MOCK_CASE/etc/apt/keyrings/docker.asc" ] || fail 'Docker source key was not downloaded'
pass 'missing Docker is installed using the official Debian source'

new_case
rm "$MOCK_BIN/openssl"
run_app reviews.acme.org || fail 'missing OpenSSL dependency was not installed'
assert_logged 'apt-get install -y openssl'
assert_logged 'openssl rand -hex 32'
pass 'fresh install automatically prepares the random-key dependency'

new_case
rm "$MOCK_BIN/docker"
MOCK_DOWNLOAD_FAIL=1; export MOCK_DOWNLOAD_FAIL
expect_app_failure reviews.acme.org
assert_not_logged 'docker-ce'
assert_not_logged 'compose build'
pass 'failed Docker signing-key download stops before Docker installation'

new_case
run_bootstrap reviews.acme.org "$MOCK_CASE/deployment" || fail 'bootstrap clone/delegate failed'
[ -f "$MOCK_CASE/deployment/shendu/.env" ] || fail 'bootstrap did not delegate configuration'
assert_logged 'clone'
assert_logged 'https://github.com/hikling/shendu-v1.git'
pass 'standalone bootstrap clones main then delegates full installation'

new_case
rm "$MOCK_BIN/git"
run_bootstrap reviews.acme.org "$MOCK_CASE/deployment" || fail 'missing Git dependency was not installed'
assert_logged 'apt-get install -y git ca-certificates'
assert_logged 'clone'
pass 'standalone bootstrap automatically prepares Git before download'

new_case
MOCK_CLONE_FAIL=1; export MOCK_CLONE_FAIL
expect_bootstrap_failure reviews.acme.org "$MOCK_CASE/deployment"
assert_not_logged 'compose build'
pass 'failed clone does not run an incomplete installation'

new_case
mkdir -p "$MOCK_CASE/deployment"
printf 'keep me\n' > "$MOCK_CASE/deployment/unrelated.txt"
expect_bootstrap_failure reviews.acme.org "$MOCK_CASE/deployment"
grep -Fx 'keep me' "$MOCK_CASE/deployment/unrelated.txt" >/dev/null || fail 'unrelated folder changed'
assert_not_logged 'clone'
pass 'existing non-repository folder is never overwritten'

new_case
mkdir -p "$MOCK_FIXTURE/.git"
existing_env
run_bootstrap reviews.acme.org "$MOCK_FIXTURE" || fail 'valid checkout rerun failed'
cmp "$app_dir/.env" "$MOCK_CASE/env-before" || fail 'bootstrap rerun rewrote .env'
assert_not_logged 'clone'
if grep -E '^git .* (fetch|pull|reset)( |$)' "$MOCK_LOG" >/dev/null; then
  fail 'bootstrap must not update or reset existing Git code'
fi
pass 'existing valid checkout reruns without fetching, resetting or changing config'

for invalid_checkout in origin branch dirty; do
  new_case
  mkdir -p "$MOCK_FIXTURE/.git"
  case "$invalid_checkout" in
    origin) MOCK_ORIGIN=https://github.com/other/repository.git; export MOCK_ORIGIN ;;
    branch) MOCK_BRANCH=experimental; export MOCK_BRANCH ;;
    dirty) MOCK_DIRTY=1; export MOCK_DIRTY ;;
  esac
  expect_bootstrap_failure reviews.acme.org "$MOCK_FIXTURE"
  assert_not_logged 'compose build'
  pass "bootstrap rejects incompatible checkout: $invalid_checkout"
done

new_case
MOCK_UID=1000; export MOCK_UID
expect_bootstrap_failure reviews.acme.org "$MOCK_CASE/deployment"
expect_app_failure reviews.acme.org
assert_not_logged 'apt-get'
assert_not_logged 'compose build'
pass 'both entry points require root before modifying the server'

new_case
MOCK_OS=ubuntu; export MOCK_OS
expect_bootstrap_failure reviews.acme.org "$MOCK_CASE/deployment"
expect_app_failure reviews.acme.org
assert_not_logged 'apt-get'
assert_not_logged 'compose build'
pass 'unsupported OS stops before server changes'

printf 'Passed %s isolated installation scenarios.\n' "$case_number"
