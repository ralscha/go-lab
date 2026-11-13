# Server deployment

This installs `git@github.com:ralscha/go-lab.git`, branch `main`, at **https://go-lab.rasc.ch** on a Linux server using systemd, Caddy, and Docker. It can coexist with rust-lab: go-lab uses its own service, release directory, runner images, Caddy site, and loopback port **3002**.

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `build-and-deploy.sh` | Clones, builds, activates, and verifies a release. |
| `go-lab.service`      | Runs the Go backend as the `go-lab` system user.   |
| `Caddyfile`           | HTTPS site and reverse proxy to `127.0.0.1:3002`.  |

**Trust boundary:** This configuration does not provide authentication. The runner executes submitted code in containers that share the host kernel, and the backend's Docker access is effectively host-administrator access. Restrict access to trusted users, for example through a VPN or an independently configured access-controlled proxy. Do not treat this deployment as a sandbox for untrusted public users.

## Prerequisites

Use a Linux server with systemd and these tools in the **root shell's PATH**:

- Git, curl, and standard GNU/Linux utilities including `flock`.
- A Node.js version supported by `package.json`, npm, and Go 1.27.4 or newer.
- Docker Engine with an active `docker.service`, the `docker` group, and `/var/run/docker.sock`.
- Caddy with `caddy.service` and the `caddy` CLI.
- SSH access to `git@github.com:ralscha/go-lab.git` from the account running the script. Configure its SSH key and GitHub host key first.

The script does not install these prerequisites. Point the `go-lab.rasc.ch` DNS records at the server and configure the firewall and Caddy certificate challenge as appropriate. Port 3002 remains on loopback. Start Docker before deploying:

```sh
systemctl enable --now docker.service
```

## First installation

First commit and push the deployment files to the selected branch: the script installs its service and Caddy templates from the cloned repository. Copy `build-and-deploy.sh` to the server and run it in a root shell:

```sh
bash ./build-and-deploy.sh
```

The script clones the selected branch, runs `npm ci` with the lockfile, builds the frontend and Go backend, and builds a release-specific Docker runner image. It stages the release under `/opt/go-lab`, installs a system user and unit, and adds a managed Caddy site without replacing existing sites. It then switches the release, verifies the frontend, health endpoint, expected Go compiler version, and a small execution, and reloads or starts Caddy.

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

Each release retains its own runner image tag, so rollback uses the matching image. Old release directories and images are not automatically pruned. Verify the current release before removing any older ones.

## Installed paths

```text
/opt/go-lab/current                       -> active release
/opt/go-lab/releases/<timestamp>-<commit>.<id>/
  bin/go-lab-server
  frontend/
  runner.env                              release-specific Docker image
  REVISION                                full Git commit
/opt/go-lab/cache/go-build/               reusable Go build cache
/opt/go-lab/deploy-go-lab                 install/update command
/var/lib/go-lab/                          systemd-managed runtime state
/etc/systemd/system/go-lab.service
/etc/caddy/sites/go-lab.caddy
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

The backend rate limit is 30 runner requests per minute per connection-source IP. Behind Caddy, visitors share the loopback address and therefore share that limit; health checks are exempt. This deployment does not change that behavior.

For manual Caddy changes, validate before reloading:

```sh
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy.service
```
