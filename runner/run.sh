#!/bin/sh
set -eu
printf 'GO_LAB_RUNNER_READY\n' >&2
operation=${1:-execute}
mode=${2:-run}
build=${3:-default}
case "$operation" in
  version) exec go version ;;
  format) exec gofmt ;;
  execute) ;;
  *) echo 'Unknown operation' >&2; exit 2 ;;
esac
mkdir -p /work/cache
# Symlink warmed entries; new build artifacts remain inside the job tmpfs.
cp -rs /opt/go-cache/. /work/cache/
printf 'module playground\n\ngo 1.27.4\n' > go.mod
case "$mode" in
  run) cat > main.go ;;
  test) cat > main_test.go ;;
  *) echo 'Unknown mode' >&2; exit 2 ;;
esac
case "$build" in
  default) set -- ;;
  race) set -- -race ;;
  *) echo 'Unknown build option' >&2; exit 2 ;;
esac
if [ "$mode" = test ]; then
  exec go test "$@" -count=1 -timeout=20s -v .
fi
go build "$@" -o /work/program .
exec /work/program
