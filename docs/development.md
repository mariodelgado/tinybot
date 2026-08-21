# Development

## Setup

Install Docker, [Bun](https://bun.sh) 1.3+, `lsof`, `python3`, and `curl`.

```sh
cp .env.example .env
bun install
```

Provision CopilotKit Intelligence after `.env` exists:

```sh
npx --yes copilotkit@latest login
npx --yes copilotkit@latest project select
npx --yes copilotkit@latest license --write
```

Put the `cpk-...` runtime key from `project select` in `.env` as
`INTELLIGENCE_API_KEY`. `license --write` writes `COPILOTKIT_LICENSE_TOKEN`.
Then add `OPENROUTER_API_KEY`. TinyBot chats via OpenRouter (Ox Alpha, then one Grok 4.6 retry). Without that key, the existing local OpenAI-compatible path still works and does not call openrouter.ai.

Start the stack:

```sh
bash scripts/start.sh
```

## Running services

Use `bash scripts/start.sh` for the full local stack. It starts TinyPipe first, then the other TinyFish products on unique host ports (latest product compose or the 15-product git-context overlay, not vendored source), then TinyBot Docker services, migrations, the API server and app, and verifies health routes. TinyPipe must be healthy before TinyFish sign-in and the start-page cards work. Leave `SPRITES_TOKEN` / `SPRITE_TOKEN` unset for this path. Set `TINYFISH_<SLUG>_URL` / `VITE_TINYFISH_<USAGE>_URL` to point cards and `/api/products` at Fly Machines instead of localhost remap. Nine board apps are not on Fly yet (`TINYFISH_TINYPING_URL`, `TINYFISH_TINYREG_URL`, `TINYFISH_TINYSCOUT_URL`, `TINYFISH_TINYBRIEF_URL`, `TINYFISH_TINYDEED_URL`, `TINYFISH_TINYFOUNDRY_URL`, `TINYFISH_TINYMARGIN_URL`, `TINYFISH_TINYATLAS_URL`, `TINYFISH_TINYPRIOR_URL`).

Use `bun run dev` only when you want the app and API server without starting the Docker Bots and computers.

| Service           | Port                       |
| ----------------- | -------------------------- |
| `app`             | 3010                       |
| `server`          | 3001                       |
| `agent-computer`  | 4100                       |
| `agent-bot`       | 4200                       |
| `agent-langgraph` | 4201                       |
| `supervisor`      | 4500 host / 4300 container |
| PostgreSQL        | 5432                       |
| TinyPipe          | 3712                       |
| TinyTail          | 18765                      |
| TinyWeb           | 18766                      |
| TinyKit           | 18083                      |
| TinyPing          | 18101                      |
| TinyTrigger       | 18081                      |
| TinyReg           | 18102                      |
| TinyScout         | 18103                      |
| TinyBrief         | 18104                      |
| TinyDeed          | 18105                      |
| TinyFeed          | 18082                      |
| TinyFoundry       | 18106                      |
| TinyMargin        | 18107                      |
| TinyAtlas         | 18108                      |
| TinyPrior         | 18109                      |

`start.sh` leaves existing matching services alone and reports when a port is held by another process.

## Migrations

After changing the Drizzle schema:

```sh
bun run --filter server db:generate
bun run --filter server db:migrate
```

Review generated migration files before sharing them. `start.sh` applies existing migrations when it starts the stack.

## Quality checks

Run these before opening a pull request:

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Integration tests expect a PostgreSQL database with pgvector. Use `start.sh` or point `DATABASE_URL` at a compatible database.

They write to whichever database `DATABASE_URL` names and leave their rows behind, so running
them against a deployment you are using puts test Bots in its audit trail and its activity
reports. Point `DATABASE_URL` at a database of their own to keep the two apart.

CI uses `bun run test:ci` to verify the expected test count in addition to normal tests.

`bun run test:smoke` is separate and needs a deployment that is up:

```sh
bash scripts/start.sh
bun run test:smoke
```

It drives one journey over HTTP against the running stack, so it covers the joins the rest of the
suite cannot reach: server to supervisor to computer, the gateway deciding before the browser acts,
and the audit row landing. Point it elsewhere with `OPENBOT_API_URL`. Without a deployment it is
skipped by `bun run test` and says what to start when asked for by name.

## Contribution checklist

- Keep changes focused.
- Keep credentials, service-account JSON, customer data, and transcripts out of source control.
- Put sensitive behavior on the server, not only in the browser.
- Update [configuration](configuration.md), [architecture](architecture.md), or the root [README](../README.md) when behavior changes.
- Run the quality checks above and include the results in the pull request.
