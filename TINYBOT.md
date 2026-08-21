# TinyBot and the six TinyFish products

TinyBot is the desktop shell, not a seventh usage product. The six Tiny* repos stay independent apps. TinyBot iframes their UIs on the start page and calls their backends through a local proxy. Product source is never vendored here.

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

Preferred bring-up wraps each product's own compose (sibling checkout or a gitignored `.tinyfish-siblings/` clone) and remaps only the named compose service onto `127.0.0.1:<hostPort>:<nativePort>`. `docker-compose.tinyfish.yml` is the git-context fallback. Do not clone the six private repos into this checkout to develop TinyBot.

Sign-in tokens are opaque `tfk.alice` / `tfk.exhausted`. No production TinyFish URLs.

## Consume path (no Sprite)

TinyBot agents and the signed-in session reach a product backend at:

```
/api/products/<slug>/*
```

That hop forwards to `127.0.0.1:<hostPort>` with the signed-in TinyFish Bearer (`tfk.*`). Unknown slugs are 404. Hop-by-hop headers match the Sprite proxy.

Defaults the empty-state agents use (no invented product routes):

- TinyPipe: `POST /api/products/tinypipe/mcp`
- TinyTail: `GET /api/products/tinytail/v1/as-of`
- TinyPulse / TinyWeb / TinyWatch / TinyKit: pass the path through `/api/products/<slug>/…`

Sprite path stays `/api/sprite/apps/<slug>/*` when a per-user Fly Sprite is assigned. Local compose wrap plus `/api/products` is the path for “TinyBot uses the backend.” Sprite `run/<slug>.sh` may stay bootstrap-only if the image is not on the Sprite; do not pretend a product is running.

## Gates stay in the product repos

Read-only Tail, no facility mint, deny-list wins, T1 required, failed evals cannot instantiate, fixture CIMD only. TinyBot does not re-implement those gates and does not `record_usage`.
