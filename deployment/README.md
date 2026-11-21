# Server deployment

This installs `git@github.com:ralscha/go-lab.git`, branch `main`, at **https://go-lab.rasc.ch** on a Linux server using systemd, Caddy, and Docker. It can coexist with rust-lab: go-lab uses its own service, release directory, runner images, Caddy site, and loopback port **3002**.

| File                      | Purpose                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `build-and-deploy.sh`     | Clones, builds, activates, and verifies a release.                                             |
| `go-lab.service`          | Runs the Go backend as the `go-lab` system user.                                               |
| `Caddyfile`               | HTTPS site, Basic Auth, and reverse proxy to `127.0.0.1:3002`.                                 |
| `Caddyfile.public`        | Opt-in public HTTPS site without Basic Auth; deployment-gated on gVisor.                       |
| `check-runner-health.mjs` | Validates the running backend's isolation policy and decides whether to smoke-test the runner. |

## Prerequisites

Use a Linux server with systemd and these tools in the **root shell's PATH**:

- Git, curl, and standard GNU/Linux utilities including `flock`.
- A Node.js version supported by `package.json`, pnpm 12.21.0, and Go 1.27.4 or newer.
- Docker Engine with an active `docker.service`, the `docker` group, and `/var/run/docker.sock`.
- Caddy 2.8 or newer with `caddy.service` and the `caddy` CLI.
- SSH access to `git@github.com:ralscha/go-lab.git` from the account running the script. Configure its SSH key and GitHub host key first.

The script does not install these prerequisites. Point the `go-lab.rasc.ch` DNS records at the server and configure the firewall and Caddy certificate challenge as appropriate. Port 3002 remains on loopback. Start Docker before deploying:

```sh
systemctl enable --now docker.service
```

## Runner isolation and access

The backend receives Docker access through `SupplementaryGroups=docker`, which is effectively host-administrator access. Use a dedicated host or VM for untrusted execution. Install gVisor's `runsc` executable and register it as a Docker runtime, then create `/etc/go-lab/runner-runtime.env`:

```text
RUNNER_RUNTIME=runsc
```

The systemd service reads this administrator-managed file and deployments preserve it. Systemd handles quoted values and duplicate assignments; the last assignment wins. Deployment reads the effective runner settings from the backend's health response, then smoke-tests enabled runners.

Caddy uses Basic Auth by default. Public access is an explicit deployment option:

```sh
PUBLIC_ACCESS=true /opt/go-lab/deploy-go-lab
```

On first installation, use `PUBLIC_ACCESS=true bash ./build-and-deploy.sh` instead. Set the option on each deployment that should remain public. Deployment verifies the `runsc` executable, the Docker runtime registration, the backend's effective runner settings, and a successful runner job before reloading Caddy with the public template. Public deployment also requires the runner to be enabled.

Each public release stores `RUNNER_REQUIRE_GVISOR=true` in its mandatory `runner.env`, loaded after the optional administrator-managed settings. The backend refuses to start unless the effective `RUNNER_RUNTIME` is `runsc`, including after restarts if the administrator-managed file disappears or its runtime setting is cleared. An unavailable runtime causes jobs to fail without falling back to Docker's default runtime.

Without `PUBLIC_ACCESS=true`, deployment installs the authenticated template and applies it to an already-running Caddy before starting the new backend. This protects the transition from public access even if the new backend uses Docker's default runtime.

The runner can be disabled immediately without stopping static pages or health checks:

```sh
install -d -m 0755 /etc/go-lab
install -m 0644 /dev/null /etc/go-lab/runner-disabled
```

The marker blocks new runner requests; a job already in progress may finish. Remove it to re-enable jobs. `RUNNER_ENABLED=false` in `/etc/go-lab/runner-runtime.env` disables runner work when the service starts. Authenticated deployments skip runner smoke tests when the backend reports that runner work is disabled; public deployments reject that configuration.

## Access credentials

Authenticated mode uses Caddy Basic Auth. Password hashes are kept only on the server in `/etc/caddy/auth/go-lab.users`, which the deployment script never overwrites. Create it before an authenticated deployment; `caddy hash-password` prompts for the password:

```sh
install -d -m 0750 -o root -g caddy /etc/caddy/auth
printf '%s %s\n' alice "$(caddy hash-password)" > /etc/caddy/auth/go-lab.users
chown root:caddy /etc/caddy/auth/go-lab.users
chmod 0640 /etc/caddy/auth/go-lab.users
```

Each line has the form `username bcrypt-hash`. Append lines for more users. To use the same accounts as rust-lab, make this file a symlink to `/etc/caddy/auth/rust-lab.users`. After editing the file outside a deployment, run `systemctl reload caddy.service`. Authenticated deployment refuses to proceed if the file is missing, has no user lines, or is unreadable by the `caddy` user.

## First installation

First commit and push the deployment files to the selected branch: the script installs its service and Caddy templates from the cloned repository. Copy `build-and-deploy.sh` to the server and run it in a root shell:

```sh
bash ./build-and-deploy.sh
```

The script clones the selected branch, checks for pnpm 12.21.0, runs `pnpm install --frozen-lockfile`, builds the frontend and Go backend, and builds a release-specific Docker runner image. It stages the release under `/opt/go-lab`, installs a system user and unit, and adds the selected Caddy template without replacing existing sites. It then switches the release, verifies the frontend and health endpoint, checks the expected Go compiler version and a small execution when the runner is enabled, and reloads or starts Caddy as needed.

If `go-lab.rasc.ch` is already configured elsewhere in Caddy, move that site to `/etc/caddy/sites/go-lab.caddy` before the first deployment. The script manages that file and reuses an existing import that includes it. Validate any other Caddy changes before deploying. Avoid simultaneous go-lab and rust-lab deployments because they both update the Caddy configuration.

## Updates and rollback

Push changes to `main`, then run as root:

```sh
/opt/go-lab/deploy-go-lab
```

To select a different branch or clone URL:

```sh
BRANCH=staging /opt/go-lab/deploy-go-lab
REPO_URL=https://github.com/ralscha/go-lab.git /opt/go-lab/deploy-go-lab
```

The current service stays up while the next release builds; activation requires a short restart. A lock prevents concurrent go-lab deployments. If activation or verification fails, the script restores the previous release and configuration and restarts the previously running service. Build failures leave the active release untouched. Successful deployments refresh the installed update command; make persistent service or Caddy changes in the repository templates.

Each release retains its own runner image tag and gVisor requirement, so rollback uses the matching image and isolation policy. Old release directories and images are not automatically pruned. Verify the current release before removing any older ones.

## Installed paths

```text
/opt/go-lab/current                       -> active release
/opt/go-lab/releases/<timestamp>-<commit>.<id>/
  bin/go-lab-server
  frontend/
  runner.env                              release-specific Docker image and isolation requirement
  REVISION                                full Git commit
/opt/go-lab/cache/go-build/               reusable Go build cache
/opt/go-lab/deploy-go-lab                 install/update command
/var/lib/go-lab/                          systemd-managed runtime state
/etc/systemd/system/go-lab.service
/etc/caddy/sites/go-lab.caddy
/etc/caddy/auth/go-lab.users              Basic Auth users (administrator-managed)
/etc/go-lab/runner-runtime.env            runtime settings (administrator-managed)
/etc/go-lab/runner-disabled               emergency runner-disable switch (optional)
```

## Status and troubleshooting

```sh
systemctl status go-lab.service caddy.service
journalctl -u go-lab.service -n 100 --no-pager
journalctl -u caddy.service -n 100 --no-pager
curl --fail http://127.0.0.1:3002/api/health
curl --fail http://127.0.0.1:3002/api/version
cat /opt/go-lab/current/REVISION
```

The deployment checks use local HTTP; separately verify DNS, certificate issuance, and the HTTPS site. If port 3002 is occupied, stop the other process before deploying.

Run the deployment policy regression tests with `node --test deployment/check-runner-health.test.mjs` and backend tests with `go test ./...`.

The backend allows 30 requests per minute per client IP, one active runner job per IP, four active jobs in total, and 120 jobs per rolling hour across all clients. Health checks are exempt; cached compiler metadata does not consume job quota. These in-memory limits reset on restart. The service sets `TRUST_FORWARDED_FOR=true`, so for connections from loopback the backend uses the rightmost `X-Forwarded-For` entry, which Caddy sets to the real client address. Other connections and other entries in the header are ignored, so clients cannot choose their rate-limit identity. Use upstream network controls and monitoring for public access as well.

For manual Caddy changes, validate before reloading:

```sh
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy.service
```
