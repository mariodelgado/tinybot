# TinyBot and the six TinyFish products

TinyBot is the desktop shell, not a seventh usage product. The six Tiny* repos stay independent apps — **linked service dependencies**, not imported packages. TinyBot iframes their UIs and calls their backends. Do not vendor, submodule, or npm/pip-install those trees into this repo.

`scripts/tinyfish/start-products.ts` takes **latest** product code on each restart: wrap each product's own compose after a sibling checkout or a clone/fetch into gitignored `.tinyfish-siblings/`. The default branch is used when it has `TINYBOT.md`; otherwise the open consume-contract PR branch. Fallback is a git-context build from GitHub (`docker-compose.tinyfish.yml`). Product files are never copied into TinyBot.

## Six independent apps

| slug | usage | compose service | native port | host port | UI | health |
| --- | --- | --- | --- | --- | --- | --- |
| tinypipe | tf-03 | tinyfish-web | 3712 | 3712 | /ui | GET /health |
| tinytail | js-01 | ltdf | 8765 | 18765 | /ui | GET /health |
| tinypulse | js-02 | feed | 8080 | 18082 | /ui | GET /health |
| tinyweb | js-03 | tinyfish-web | 8765 | 18766 | /ui | GET /health |
| tinywatch | tf-01 | engine | 8080 | 18081 | / | GET /health |
| tinykit | tf-02 | gallery | 8080 | 18083 | / | GET /health |

Usage ids stay `js-01`…`tf-03`. Extra host publishes (TinyPulse 8081/8090, TinyWatch webhook 8081) stay unpublished on the host so wrap does not pick webhook or postgres.

Each product honors `PORT` and answers `GET /health` with `{ok, product, usage_id}`. Cards and `start.sh` probe that path on the remapped host port, not the UI path.

## One start, TinyPipe first

`bash scripts/start.sh` starts TinyPipe first (`http://127.0.0.1:3712/mcp`, fixture issuer `https://issuer.fixtures.tinyfish.test`), then the five siblings, then TinyBot.

Preferred bring-up wraps each product's own compose (sibling checkout or a gitignored `.tinyfish-siblings/` clone of the latest ref) and remaps only the named compose service onto `127.0.0.1:<hostPort>:<nativePort>`. `docker-compose.tinyfish.yml` is the git-context fallback. Do not vendor the six private repos into this checkout.

Sign-in tokens are opaque `tfk.alice` / `tfk.exhausted`. Fixture issuer is `https://issuer.fixtures.tinyfish.test`.

## Fly Machines (optional URL override)

When `TINYFISH_<SLUG>_URL` or `VITE_TINYFISH_<USAGE>_URL` is set, cards and `/api/products/:slug/*` use that origin instead of the localhost remap. Unset keeps `scripts/start.sh` on remapped loopback. A missing or down Fly URL must not fail TinyBot; cards show Unreachable.

| slug | env | Fly app | URL |
| --- | --- | --- | --- |
| tinypipe | `TINYFISH_TINYPIPE_URL` / `VITE_TINYFISH_TF_03_URL` | tf-tinypipe | https://tf-tinypipe.fly.dev |
| tinytail | `TINYFISH_TINYTAIL_URL` / `VITE_TINYFISH_JS_01_URL` | tf-tinytail | https://tf-tinytail.fly.dev |
| tinypulse | `TINYFISH_TINYPULSE_URL` / `VITE_TINYFISH_JS_02_URL` | tf-tinypulse | https://tf-tinypulse.fly.dev |
| tinyweb | `TINYFISH_TINYWEB_URL` / `VITE_TINYFISH_JS_03_URL` | tf-tinyweb | https://tf-tinyweb.fly.dev |
| tinywatch | `TINYFISH_TINYWATCH_URL` / `VITE_TINYFISH_TF_01_URL` | tf-tinywatch | https://tf-tinywatch.fly.dev |
| tinykit | `TINYFISH_TINYKIT_URL` / `VITE_TINYFISH_TF_02_URL` | tf-tinykit | https://tf-tinykit.fly.dev |

TinyPipe MCP on Fly: `TINYFISH_MCP_URL=https://tf-tinypipe.fly.dev/mcp` or `http://tf-tinypipe.internal:8080/mcp`. These machines are one each in `sjc` (`--ha=false`). They may not be live yet; do not treat an unreachable Fly URL as a TinyBot failure.

## Consume path (no Sprite)

TinyBot agents and the signed-in session reach a product backend at:

```
/api/products/<slug>/*
```

That hop forwards to `127.0.0.1:<hostPort>` (or the Fly/env origin) with the signed-in TinyFish Bearer (`tfk.*`). Unknown slugs are 404. Hop-by-hop headers match the Sprite proxy. An unreachable origin is 502.

Defaults the empty-state agents use (no invented product routes):

- TinyPipe: `POST /api/products/tinypipe/mcp`
- TinyTail: `GET /api/products/tinytail/v1/as-of`
- TinyPulse / TinyWeb / TinyWatch / TinyKit: pass the path through `/api/products/<slug>/…`

Sprite path stays `/api/sprite/apps/<slug>/*` when a per-user Fly Sprite is assigned. Local compose wrap plus `/api/products` is the path for “TinyBot uses the backend.” Sprite `run/<slug>.sh` may stay bootstrap-only if the image is not on the Sprite; do not pretend a product is running.

## Gates stay in the product repos

Read-only Tail, no facility mint, deny-list wins, T1 required, failed evals cannot instantiate, fixture CIMD only. TinyBot does not re-implement those gates and does not `record_usage`.
