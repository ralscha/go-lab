#!/usr/bin/env bash
set -euo pipefail
umask 022

REPO_URL="${REPO_URL:-git@github.com:ralscha/go-lab.git}"
BRANCH="${BRANCH:-main}"
readonly APP_ROOT=/opt/go-lab
readonly SERVICE=go-lab.service
readonly SERVICE_FILE=/etc/systemd/system/go-lab.service
readonly CADDY_MAIN=/etc/caddy/Caddyfile
readonly CADDY_SITE=/etc/caddy/sites/go-lab.caddy
readonly CADDY_USERS=/etc/caddy/auth/go-lab.users
readonly SITE=go-lab.rasc.ch

work_dir=
previous_release=
activation_started=false
service_was_running=false
service_was_enabled=false
caddy_was_running=false
caddy_was_enabled=false
caddy_start_attempted=false

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] %s\n' "$*" >&2; exit 1; }
docker_local() { docker --host unix:///var/run/docker.sock "$@"; }

backup_file() {
  if [[ -e "$1" ]]; then
    cp -pL -- "$1" "$work_dir/$2"
  fi
}

restore_file() {
  if [[ -f "$work_dir/$2" ]]; then
    cat "$work_dir/$2" > "$1"
  else
    rm -f -- "$1"
  fi
}

install_config() {
  # Preserve existing symlinks and permissions for rollback.
  if [[ -e "$2" ]]; then
    cat "$1" > "$2"
  else
    install -m 0644 "$1" "$2"
  fi
}

switch_release() {
  ln -s -- "$1" "$work_dir/current"
  mv -Tf -- "$work_dir/current" "$APP_ROOT/current"
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ $status -ne 0 && "$activation_started" == true ]]; then
    log 'Deployment failed; restoring the previous release and configuration.'
    set +e
    systemctl stop "$SERVICE"
    if [[ -n "$previous_release" ]]; then
      switch_release "$previous_release"
    else
      rm -f -- "$APP_ROOT/current"
    fi
    if [[ "$service_was_enabled" == false ]]; then
      systemctl disable "$SERVICE"
    fi
    restore_file "$SERVICE_FILE" service.previous
    restore_file "$CADDY_MAIN" caddy-main.previous
    restore_file "$CADDY_SITE" caddy-site.previous
    systemctl daemon-reload
    if [[ "$service_was_running" == true ]]; then
      systemctl start "$SERVICE" || log 'Previous service could not restart; inspect journalctl.'
    fi
    if [[ "$caddy_was_running" == true ]]; then
      systemctl reload caddy.service || log 'Caddy reload failed; inspect its journal.'
    elif [[ "$caddy_start_attempted" == true ]]; then
      systemctl stop caddy.service
      if [[ "$caddy_was_enabled" == false ]]; then
        systemctl disable caddy.service
      fi
    fi
  fi
  if [[ -n "$work_dir" && "$work_dir" == "$APP_ROOT"/.build.* ]]; then
    rm -rf -- "$work_dir"
  fi
  exit "$status"
}

check_caddy_users() {
  [[ -f "$CADDY_USERS" ]] || die "Create $CADDY_USERS with Basic Auth users first (see deployment/README.md)."
  grep -Eq '^[[:space:]]*[^#[:space:]]+[[:space:]]+\$2[aby]\$' "$CADDY_USERS" || \
    die "$CADDY_USERS must contain at least one 'username bcrypt-hash' line."
  if id -u caddy >/dev/null 2>&1; then
    runuser -u caddy -- test -r "$CADDY_USERS" || die "The caddy user cannot read $CADDY_USERS."
  fi
}

caddy_has_site() {
  node - "$work_dir/caddy.json" "$SITE" <<'NODE'
const fs = require('node:fs');
const [file, host] = process.argv.slice(2);
function includesHost(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value.host) && value.host.includes(host)) return true;
  return Object.values(value).some(includesHost);
}
process.exit(includesHost(JSON.parse(fs.readFileSync(file, 'utf8'))) ? 0 : 1);
NODE
}

[[ $(uname -s) == Linux ]] || die 'Run this script on the Linux deployment server.'
[[ $EUID -eq 0 ]] || die 'Run this script as root (with the build tools available in PATH).'
[[ -n "$REPO_URL" && -n "$BRANCH" ]] || die 'REPO_URL and BRANCH must not be empty.'
for command_name in git node npm go docker systemctl systemd-analyze caddy curl \
  install flock mktemp readlink ln mv cp cat rm chmod find getent groupadd useradd id basename date sleep \
  grep runuser; do
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
done

exec 9>/run/lock/go-lab-deploy.lock
flock -n 9 || die 'Another go-lab deployment is running.'
[[ ! -L "$APP_ROOT" ]] || die "$APP_ROOT must be a real directory, not a symlink."
install -d -m 0755 "$APP_ROOT" "$APP_ROOT/releases" "$APP_ROOT/cache/go-build"
if [[ -L "$APP_ROOT/current" ]]; then
  previous_release=$(readlink -e -- "$APP_ROOT/current") || die 'The current release link is broken.'
  [[ "$previous_release" == "$APP_ROOT"/releases/* ]] || die 'The current release is outside the releases directory.'
elif [[ -e "$APP_ROOT/current" ]]; then
  die "$APP_ROOT/current must be a release symlink."
fi

work_dir=$(mktemp -d "$APP_ROOT/.build.XXXXXXXX")
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
systemctl is-active --quiet "$SERVICE" && service_was_running=true
systemctl is-enabled --quiet "$SERVICE" && service_was_enabled=true
systemctl is-active --quiet caddy.service && caddy_was_running=true
systemctl is-enabled --quiet caddy.service && caddy_was_enabled=true
systemctl is-active --quiet docker.service || die 'Start Docker first: systemctl enable --now docker'
[[ $(docker_local info --format '{{.OSType}}') == linux ]] || die 'The local Docker daemon must run Linux containers.'
getent group docker >/dev/null || die 'The Docker installation must provide the docker group.'
for config_file in "$SERVICE_FILE" "$CADDY_MAIN" "$CADDY_SITE"; do
  [[ ! -L "$config_file" || -e "$config_file" ]] || die "$config_file is a broken symlink."
done
check_caddy_users

if [[ -s "$CADDY_MAIN" ]]; then
  caddy adapt --config "$CADDY_MAIN" --adapter caddyfile > "$work_dir/caddy.json"
  if caddy_has_site && [[ ! -f "$CADDY_SITE" ]]; then
    die "$SITE is already configured elsewhere. Move that site to $CADDY_SITE before deploying."
  fi
fi

log "Cloning $REPO_URL ($BRANCH)"
git clone --depth 1 --single-branch --branch "$BRANCH" -- "$REPO_URL" "$work_dir/source"
source_dir="$work_dir/source"
revision=$(git -C "$source_dir" rev-parse --short=12 HEAD)
release_name="$(date -u +%Y%m%dT%H%M%SZ)-$revision"
release_dir=$(mktemp -d "$APP_ROOT/releases/$release_name.XXXXXX")
runner_image="go-lab-runner:$(basename "$release_dir")"

log 'Building the frontend and backend'
(
  cd "$source_dir"
  CI=true npm ci --include=dev --engine-strict
  npm run build:client
  GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off CGO_ENABLED=0 \
    GOCACHE="$APP_ROOT/cache/go-build" go build -trimpath -o "$work_dir/go-lab-server" ./server
)
[[ -x "$work_dir/go-lab-server" ]] || die 'Backend binary is missing.'
[[ -f "$source_dir/dist/go-lab/browser/index.html" ]] || die 'Frontend build is missing.'

log "Building the Go runner: $runner_image"
docker_local build --tag "$runner_image" "$source_dir/runner"

log "Staging release $(basename "$release_dir")"
chmod 0755 "$release_dir"
install -d -m 0755 "$release_dir/bin" "$release_dir/frontend"
install -m 0755 "$work_dir/go-lab-server" "$release_dir/bin/go-lab-server"
cp -R -- "$source_dir/dist/go-lab/browser/." "$release_dir/frontend/"
find "$release_dir/frontend" -type d -exec chmod 0755 {} +
find "$release_dir/frontend" -type f -exec chmod 0644 {} +
printf 'RUNNER_IMAGE=%s\n' "$runner_image" > "$release_dir/runner.env"
git -C "$source_dir" rev-parse HEAD > "$release_dir/REVISION"

if ! getent group go-lab >/dev/null; then
  groupadd --system go-lab
fi
if ! getent passwd go-lab >/dev/null; then
  useradd --system --gid go-lab --home-dir /var/lib/go-lab --no-create-home \
    --shell /usr/sbin/nologin go-lab
fi
[[ $(id -u go-lab) -ne 0 ]] || die 'The go-lab service account must not be root.'

backup_file "$SERVICE_FILE" service.previous
backup_file "$CADDY_MAIN" caddy-main.previous
backup_file "$CADDY_SITE" caddy-site.previous
activation_started=true
install -d -m 0755 /etc/caddy/sites
install_config "$source_dir/deployment/Caddyfile" "$CADDY_SITE"
if [[ ! -e "$CADDY_MAIN" ]]; then
  install -m 0644 /dev/null "$CADDY_MAIN"
fi
if [[ ! -s "$CADDY_MAIN" ]]; then
  printf '\nimport %s\n' "$CADDY_SITE" >> "$CADDY_MAIN"
else
  caddy adapt --config "$CADDY_MAIN" --adapter caddyfile > "$work_dir/caddy.json"
  if ! caddy_has_site; then
    printf '\nimport %s\n' "$CADDY_SITE" >> "$CADDY_MAIN"
  fi
fi
caddy validate --config "$CADDY_MAIN" --adapter caddyfile

log 'Activating the new release'
systemctl stop "$SERVICE" 2>/dev/null || [[ "$service_was_running" == false ]]
switch_release "$release_dir"
install_config "$source_dir/deployment/go-lab.service" "$SERVICE_FILE"
systemd-analyze verify --man=no "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl start "$SERVICE"

ready=false
for ((attempt = 1; attempt <= 30; attempt++)); do
  if systemctl is-active --quiet "$SERVICE" && \
    curl --fail --silent --max-time 2 http://127.0.0.1:3002/api/health > /dev/null; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || die 'Backend did not become healthy. Check journalctl -u go-lab.service.'
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3002/ > "$work_dir/index.html"
[[ -s "$work_dir/index.html" ]] || die 'The frontend response is empty.'
curl --fail --silent --show-error --max-time 5 \
  -H "Host: $SITE" -H "Origin: https://$SITE" \
  http://127.0.0.1:3002/api/health > /dev/null
curl --fail --silent --show-error --max-time 45 http://127.0.0.1:3002/api/version > "$work_dir/version.json"
node - "$work_dir/version.json" <<'NODE'
const fs = require('node:fs');
const version = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (typeof version.version !== 'string' || version.version !== version.referenceVersion) {
  console.error('Runner version does not match the backend reference version:', version);
  process.exit(1);
}
NODE
curl --fail --silent --show-error --max-time 50 \
  -H 'Content-Type: application/json' \
  --data '{"code":"package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"deployment ok\")}\n","mode":"run","optimization":"default"}' \
  http://127.0.0.1:3002/api/execute > "$work_dir/execute.json"
node - "$work_dir/execute.json" <<'NODE'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.success !== true || result.stdout.trim() !== 'deployment ok') {
  console.error(result);
  process.exit(1);
}
NODE

if [[ "$caddy_was_running" == true ]]; then
  systemctl reload caddy.service
else
  caddy_start_attempted=true
  systemctl enable --now caddy.service
fi
install -m 0755 "$source_dir/deployment/build-and-deploy.sh" "$APP_ROOT/deploy-go-lab.next"
mv -Tf "$APP_ROOT/deploy-go-lab.next" "$APP_ROOT/deploy-go-lab"
activation_started=false
log "Deployed $revision to https://$SITE"
log "Current release: $release_dir"
if [[ -n "$previous_release" ]]; then
  log "Previous release retained: $previous_release"
fi
