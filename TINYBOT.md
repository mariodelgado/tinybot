# TinyBot and the TinyFish products

TinyBot is the desktop shell, not a twelfth usage product. The Tiny* repos stay independent apps — **linked service dependencies**, not imported packages. TinyBot iframes board UIs and calls product backends. Do not vendor, submodule, or npm/pip-install those trees into this repo.

`scripts/tinyfish/start-products.ts` takes **latest** product code on each restart: wrap each product's own compose after a sibling checkout or a clone/fetch into gitignored `.tinyfish-siblings/`. The default branch is used when it has `TINYBOT.md`; otherwise the open consume-contract PR branch. Fallback is a git-context build from GitHub (`docker-compose.tinyfish.yml`), which lists all 15 products. Product files are never copied into TinyBot.

New board repos may still be README-only. Cards may show Unreachable. Do not fail start when a sibling has no compose or Dockerfile yet. TinyPipe remains required locally (auth socket).

## Board (start-page cards + empty-state agents)

TinyPing is first (funnel). These 11 board products are start-page cards and package-provided default agents. The four platform products follow them on the same roster (see below).

| slug | usage | compose service | native port | host port | UI | health |
| --- | --- | --- | --- | --- | --- | --- |
| tinyping | tiny-ping | tinyping | 8080 | 18101 | /ui | GET /health |
| tinytrigger | tiny-trigger | engine | 8080 | 18081 | / | GET /health |
| tinyreg | tiny-reg | tinyreg | 8080 | 18102 | /ui | GET /health |
| tinyscout | tiny-scout | tinyscout | 8080 | 18103 | /ui | GET /health |
| tinybrief | tiny-brief | tinybrief | 8080 | 18104 | /ui | GET /health |
| tinydeed | tiny-deed | tinydeed | 8080 | 18105 | /ui | GET /health |
| tinyfeed | tiny-feed | feed | 8080 | 18082 | /ui | GET /health |
| tinyfoundry | tiny-foundry | tinyfoundry | 8080 | 18106 | /ui | GET /health |
| tinymargin | tiny-margin | tinymargin | 8080 | 18107 | /ui | GET /health |
| tinyatlas | tiny-atlas | tinyatlas | 8080 | 18108 | /ui | GET /health |
| tinyprior | tiny-prior | tinyprior | 8080 | 18109 | /ui | GET /health |

TinyTrigger keeps host port 18081 (was `tf-01-trigger-rules`). TinyFeed keeps 18082 (was `js-02-physical-events`). New slugs use 18101+. Extra host publishes (TinyFeed 8081/8090, TinyTrigger webhook 8081) stay unpublished on the host so wrap does not pick webhook or postgres.

## Platform (start-page primitives; `kind` stays platform-capability)

These keep `kind: "platform"` in the stack catalog. They are still TinyBot primitives: start-page cards, empty-state agents, and start/proxy backends. Card order is after TinyPrior: TinyPipe, TinyTail, TinyWeb, TinyKit. Boot order is unchanged (TinyPipe first).

| slug | usage | compose service | native port | host port | UI | health |
| --- | --- | --- | --- | --- | --- | --- |
| tinypipe | tf-03 | tinyfish-web | 3712 | 3712 | /ui | GET /health |
| tinytail | js-01 | ltdf | 8765 | 18765 | /ui | GET /health |
| tinyweb | js-03 | tinyfish-web | 8765 | 18766 | /ui | GET /health |
| tinykit | tf-02 | gallery | 8080 | 18083 | / | GET /health |

TinyPipe remains first in `start-products`. Platform usage ids stay `js-01`, `js-03`, `tf-02`, `tf-03`. Sibling repos are `mariodelgado/tiny-pipe`, `tiny-tail`, `tiny-web`, and `tiny-kit`.

Each product honors `PORT` and answers `GET /health` with `{ok, product, usage_id}`. Cards and `start.sh` probe that path on the remapped host port, not the UI path.

## One start, TinyPipe first

`bash scripts/start.sh` starts TinyPipe first (`http://127.0.0.1:3712/mcp`, fixture issuer `https://issuer.fixtures.tinyfish.test`), then the other products, then TinyBot.

Preferred bring-up wraps each product's own compose (sibling checkout or a gitignored `.tinyfish-siblings/` clone of the latest ref) and remaps only the named compose service onto `127.0.0.1:<hostPort>:<nativePort>`. `docker-compose.tinyfish.yml` is the git-context fallback for all 15 products. Do not vendor product repos into this checkout.

Sign-in accepts a TinyFish API key (`tf_…` from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys)) or an OAuth MCP token for `https://agent.tinyfish.ai/mcp`, presented as `X-API-Key` or `Authorization: Bearer`. That header is forwarded unchanged to TinyPipe and to product backends. TinyBot does not log the secret.

Local CI still uses opaque fixtures `tfk.alice` / `tfk.exhausted`. Fixture issuer is `https://issuer.fixtures.tinyfish.test`. A live key creates a user the same way `tfk.alice` does (upsert by `tinyfish_user_id`).

## Fly Machines (optional URL override)

When `TINYFISH_<SLUG>_URL` or `VITE_TINYFISH_<USAGE>_URL` is set, cards and `/api/products/:slug/*` use that origin instead of the localhost remap. Unset keeps `scripts/start.sh` on remapped loopback. A missing or down Fly URL must not fail TinyBot; cards show Unreachable.

| slug | env | Fly app | URL |
| --- | --- | --- | --- |
| tinypipe | `TINYFISH_TINYPIPE_URL` / `VITE_TINYFISH_TF_03_URL` | tf-tinypipe | https://tf-tinypipe.fly.dev |
| tinytail | `TINYFISH_TINYTAIL_URL` / `VITE_TINYFISH_JS_01_URL` | tf-tinytail | https://tf-tinytail.fly.dev |
| tinyweb | `TINYFISH_TINYWEB_URL` / `VITE_TINYFISH_JS_03_URL` | tf-tinyweb | https://tf-tinyweb.fly.dev |
| tinykit | `TINYFISH_TINYKIT_URL` / `VITE_TINYFISH_TF_02_URL` | tf-tinykit | https://tf-tinykit.fly.dev |
| tinyping | `TINYFISH_TINYPING_URL` / `VITE_TINYFISH_TINY_PING_URL` | tf-tinyping | https://tf-tinyping.fly.dev |
| tinytrigger | `TINYFISH_TINYTRIGGER_URL` / `VITE_TINYFISH_TINY_TRIGGER_URL` | tf-tinytrigger | https://tf-tinytrigger.fly.dev |
| tinyreg | `TINYFISH_TINYREG_URL` / `VITE_TINYFISH_TINY_REG_URL` | tf-tinyreg | https://tf-tinyreg.fly.dev |
| tinyscout | `TINYFISH_TINYSCOUT_URL` / `VITE_TINYFISH_TINY_SCOUT_URL` | tf-tinyscout | https://tf-tinyscout.fly.dev |
| tinybrief | `TINYFISH_TINYBRIEF_URL` / `VITE_TINYFISH_TINY_BRIEF_URL` | tf-tinybrief | https://tf-tinybrief.fly.dev |
| tinydeed | `TINYFISH_TINYDEED_URL` / `VITE_TINYFISH_TINY_DEED_URL` | tf-tinydeed | https://tf-tinydeed.fly.dev |
| tinyfeed | `TINYFISH_TINYFEED_URL` / `VITE_TINYFISH_TINY_FEED_URL` | tf-tinyfeed | https://tf-tinyfeed.fly.dev |
| tinyfoundry | `TINYFISH_TINYFOUNDRY_URL` / `VITE_TINYFISH_TINY_FOUNDRY_URL` | tf-tinyfoundry | https://tf-tinyfoundry.fly.dev |
| tinymargin | `TINYFISH_TINYMARGIN_URL` / `VITE_TINYFISH_TINY_MARGIN_URL` | tf-tinymargin | https://tf-tinymargin.fly.dev |
| tinyatlas | `TINYFISH_TINYATLAS_URL` / `VITE_TINYFISH_TINY_ATLAS_URL` | tf-tinyatlas | https://tf-tinyatlas.fly.dev |
| tinyprior | `TINYFISH_TINYPRIOR_URL` / `VITE_TINYFISH_TINY_PRIOR_URL` | tf-tinyprior | https://tf-tinyprior.fly.dev |

TinyPipe MCP on Fly: `TINYFISH_MCP_URL=https://tf-tinypipe.fly.dev/mcp` or `http://tf-tinypipe.internal:8080/mcp`. These machines are one each in `sjc` (`--ha=false`). They may not be live yet; do not treat an unreachable Fly URL as a TinyBot failure.

Nine board apps are not deployed on Fly yet. Set `TINYFISH_<SLUG>_URL` when a machine exists; unset keeps the localhost remap. A missing or down Fly URL must not fail TinyBot (cards show Unreachable):

| slug | env |
| --- | --- |
| tinyping | `TINYFISH_TINYPING_URL` |
| tinyreg | `TINYFISH_TINYREG_URL` |
| tinyscout | `TINYFISH_TINYSCOUT_URL` |
| tinybrief | `TINYFISH_TINYBRIEF_URL` |
| tinydeed | `TINYFISH_TINYDEED_URL` |
| tinyfoundry | `TINYFISH_TINYFOUNDRY_URL` |
| tinymargin | `TINYFISH_TINYMARGIN_URL` |
| tinyatlas | `TINYFISH_TINYATLAS_URL` |
| tinyprior | `TINYFISH_TINYPRIOR_URL` |

## Consume path (no Sprite)

TinyBot agents and the signed-in session reach a product backend at:

```
/api/products/<slug>/*
```

That hop forwards to `127.0.0.1:<hostPort>` (or the Fly/env origin) with the signed-in TinyFish Bearer (`tfk.*`). Unknown slugs are 404. Hop-by-hop headers match the Sprite proxy. An unreachable origin is 502.

Defaults empty-state / platform agents use (no invented product routes):

- TinyPipe: `POST /api/products/tinypipe/mcp`
- TinyTail: `GET /api/products/tinytail/v1/as-of`
- Other slugs: pass the path through `/api/products/<slug>/…`

Sprite path stays `/api/sprite/apps/<slug>/*` when a per-user Fly Sprite is assigned. Local compose wrap plus `/api/products` is the path for “TinyBot uses the backend.” Sprite `run/<slug>.sh` may stay bootstrap-only if the image is not on the Sprite; do not pretend a product is running.

## Gates stay in the product repos

Read-only Tail, no facility mint, deny-list wins, T1 required, failed evals cannot instantiate, fixture CIMD only. TinyBot does not re-implement those gates and does not `record_usage`.
