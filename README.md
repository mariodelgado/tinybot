<div align="center">

# TinyBot

**The TinyFish desktop shell.** TinyBot is based on [OpenBot](https://github.com/CopilotKit/openbot) by CopilotKit — AG-UI coworkers, a policy gateway, and governed computers — and keeps that architecture, the MIT license, and the CopilotKit attribution.

[**copilotkit.ai/openbot**](https://copilotkit.ai/openbot) · [**Quick start**](#quick-start) · [**TinyFish products**](#tinyfish-products) · [**Features**](#features) · [**Bring your own agent**](#bring-your-own-agent) · [**Architecture**](#architecture) · [**Docs**](docs/README.md)

[![CI](https://github.com/CopilotKit/openbot/actions/workflows/ci.yml/badge.svg)](https://github.com/CopilotKit/openbot/actions/workflows/ci.yml)
[![security](https://github.com/CopilotKit/openbot/actions/workflows/security_zizmor.yml/badge.svg)](https://github.com/CopilotKit/openbot/actions/workflows/security_zizmor.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Alpha](https://img.shields.io/badge/status-alpha-orange.svg)

</div>

https://github.com/user-attachments/assets/535ef7ee-1631-4a69-b839-564c56cf90b4

<div align="center">

Bring any AG-UI agent, written on a framework or by hand, and it arrives as a
coworker with a channel of its own. Watch it work on its own screen, take the
wheel when it reaches something it should not do alone, then hand it back. It
answers with components rather than only prose, and the whole thing runs on
your own machine.

</div>

> **Alpha, and under active development.** TinyBot is early. Expect rough edges and bugs, and expect things to move. Issues and pull requests are welcome.

> **Runs on your machine.** Everything below is written for a laptop. After `bash scripts/start.sh`, TinyPipe is up and TinyFish sign-in is required (`tfk.alice` at `/sign`). `OPENBOT_DEV_NO_AUTH` remains an escape hatch only when TinyPipe is not configured. [Google sign-in](#sign-in-with-google) can be wired up instead.

## What it is

TinyBot is the TinyFish desktop shell: every TinyX product is a start-page primitive (iframe their UIs, call their backends), plus the OpenBot coworker platform underneath. Docker Compose brings up every part of it, the data sits in your PostgreSQL, and chat goes through OpenRouter: Ox Alpha (`stealth/ox-alpha`) by default, with one retry on Grok 4.6 (`x-ai/grok-4.6`) if that call fails. The key is `OPENROUTER_API_KEY`, encrypted at rest when stored, and never logged.

Fifteen TinyFish products ship as the package-provided default agents, TinyPing first, then the rest of the board, then **TinyPipe**, **TinyTail**, **TinyWeb**, and **TinyKit** after TinyPrior: **TinyPing**, **TinyTrigger**, **TinyReg**, **TinyScout**, **TinyBrief**, **TinyDeed**, **TinyFeed**, **TinyFoundry**, **TinyMargin**, **TinyAtlas**, **TinyPrior**, **TinyPipe**, **TinyTail**, **TinyWeb**, and **TinyKit**. They are configuration rather than code, public and ownerless, and show up on a fresh roster. Add your own by editing `agents.yaml` or from `/agents` in the UI.

Anything a Bot does to a computer, a file, an MCP server or a component goes through one gateway that decides and records it. That is the difference between an agent that can use your tools and an agent you can let near them.

More at [copilotkit.ai/openbot](https://copilotkit.ai/openbot).

## Built on AG-UI

A Bot is any endpoint speaking [AG-UI](https://github.com/ag-ui-protocol/ag-ui), the open protocol for agent-to-user interaction, so OpenBot is not tied to a framework and neither are you. Agents built with LangGraph, Mastra, CrewAI, Pydantic AI, Google ADK or written by hand all arrive the same way, and the governance rides the protocol rather than the framework.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/architecture-dark.svg">
  <img src="assets/architecture-light.svg" alt="You talk to the server, which sends the turn to a Bot over AG-UI. Every tool call the Bot makes comes back through the gateway, which resolves the target, decides it against your policy, records an audit row, and only then acts, or refuses and names the rule. Allowed browser and file actions reach that Bot's own computer, one container each with its own Chromium, logins and workspace, built by the supervisor. Decisions land in PostgreSQL and threads in CopilotKit Intelligence.">
</picture>

## Requirements

- Docker, for PostgreSQL, browser computers, the supervisor, and the shipped Bots.
- [Bun](https://bun.sh) 1.3+, for the app and API server.
- A CopilotKit Intelligence project and license. A free plan is available, and Intelligence can be self-hosted.
- An OpenRouter key (`OPENROUTER_API_KEY`). TinyBot chats via OpenRouter: Ox Alpha by default, Grok 4.6 as a one-shot fallback. Without that key, the existing local OpenAI-compatible gateway path still works and TinyBot does not call openrouter.ai.

## Quick start

1. Create `.env`:

   ```sh
   cp .env.example .env
   ```

2. Get CopilotKit Intelligence credentials:

   ```sh
   npx --yes copilotkit@latest login
   npx --yes copilotkit@latest project select
   npx --yes copilotkit@latest license --write
   ```

   Put the `cpk-...` runtime key from `project select` in `.env` as
   `INTELLIGENCE_API_KEY`. `license --write` writes
   `COPILOTKIT_LICENSE_TOKEN` into the existing `.env`.

3. Fill the remaining required values:

   - `OPENROUTER_API_KEY`

   Keep the managed Intelligence URLs from `.env.example` unless you run Intelligence yourself. The example `KEY_ENCRYPTION_KEY` is public and fine locally; generate your own with:

   ```sh
   openssl rand -base64 32
   ```

4. Install and run the full stack (TinyBot + TinyFish products):

   ```sh
   bun install
   bash scripts/start.sh
   ```

5. Open <http://localhost:3010/sign>, paste `tfk.alice`, then open <http://localhost:3010/>.

`scripts/start.sh` starts TinyPipe first (auth on `http://127.0.0.1:3712/mcp`), then the other products on unique host ports, then TinyBot Docker services, migrations, the API server on port 3001, and the app on port 3010. TinyPipe must be healthy before sign-in and the start-page cards work.

The start page at <http://localhost:3010/> leads with fifteen TinyFish primitive cards (TinyPing first; Pipe, Tail, Web, Kit after Prior). Click a card to open that product's live UI inside TinyBot (an in-app iframe at `/apps/<product>`), not a new browser window. README-only siblings may show Unreachable.

## Sign in with TinyFish

TinyPipe (`tf-03`) is the local auth + metering surface. TinyBot also accepts an official TinyFish API key (`tf_…` from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys)) or an OAuth MCP token for `https://agent.tinyfish.ai/mcp`, as `X-API-Key` or `Authorization: Bearer`. That header is forwarded unchanged to TinyPipe and `/api/products/:slug/*`. TinyBot does not log the secret.

`bash scripts/start.sh` starts TinyPipe first and writes these localhost values into `.env` when they are missing:

```sh
TINYFISH_MCP_URL=http://127.0.0.1:3712/mcp
TINYFISH_ISSUER=https://issuer.fixtures.tinyfish.test
```

When `TINYFISH_MCP_URL` is set, this is the real sign-in. Fixture `/sign` needs TinyPipe healthy. `OPENBOT_DEV_NO_AUTH` stays an escape hatch only if TinyPipe is not configured.

Open <http://localhost:3010/sign> and paste a credential:

   - `tf_…` API key or MCP token → upserts a user the same way `tfk.alice` does
   - `tfk.alice` → profile `tfu_alice` (`iss` = `https://issuer.fixtures.tinyfish.test`, `client_id` = `https://cimd.fixtures.tinyfish.test/client.json`)
   - `tfk.exhausted` → profile `tfu_exhausted` (valid login; 0 credits is a credit gate, not an auth gate)
   - unknown / rejected credential → 401

A second sign-in with the same credential reuses that profile. The session cookie binds to it. TinyBot does not write TinyPipe credits or call `record_usage` for sign-in. Settings shows `tinyfish_user_id`. Local CI keeps `tfk.*` fixtures.

## TinyFish products

The products are linked services, not packages. Catalog defaults live in `app/src/lib/tinyfish/stack.ts` (host ports TinyBot publishes) and stay on localhost unless `TINYFISH_<SLUG>_URL` or `VITE_TINYFISH_<USAGE>_URL` points at Fly. Product repos keep their native binds; TinyBot remaps the host side onto the named compose service after fetching latest product code into a gitignored sibling clone. Cards probe `GET /health` and may show **Unreachable** if that service is down or README-only; they still open the shell route.

When there is no Sprite, TinyBot consumes each backend at `/api/products/<slug>/*` (TinyPipe `POST /mcp` first, TinyTail `/v1/as-of`, other slugs pass the path through). See [TINYBOT.md](TINYBOT.md).

Start-page cards (TinyPing first; Pipe, Tail, Web, Kit after Prior):

| Product     | One-line                         | Start-page route        | Live UI after `start.sh`         | Usage id       |
| ----------- | -------------------------------- | ----------------------- | -------------------------------- | -------------- |
| TinyPing    | Funnel — first                   | `/apps/tinyping`        | `http://127.0.0.1:18101/ui`      | `tiny-ping`    |
| TinyTrigger | Watch / When / Do — T1 required  | `/apps/tinytrigger`     | `http://127.0.0.1:18081/`        | `tiny-trigger` |
| TinyReg     | Registry                         | `/apps/tinyreg`         | `http://127.0.0.1:18102/ui`      | `tiny-reg`     |
| TinyScout   | Scout                            | `/apps/tinyscout`       | `http://127.0.0.1:18103/ui`      | `tiny-scout`   |
| TinyBrief   | Brief                            | `/apps/tinybrief`       | `http://127.0.0.1:18104/ui`      | `tiny-brief`   |
| TinyDeed    | Deed                             | `/apps/tinydeed`        | `http://127.0.0.1:18105/ui`      | `tiny-deed`    |
| TinyFeed    | Event feed — graph is read-only  | `/apps/tinyfeed`        | `http://127.0.0.1:18082/ui`      | `tiny-feed`    |
| TinyFoundry | Foundry                          | `/apps/tinyfoundry`     | `http://127.0.0.1:18106/ui`      | `tiny-foundry` |
| TinyMargin  | Margin                           | `/apps/tinymargin`      | `http://127.0.0.1:18107/ui`      | `tiny-margin`  |
| TinyAtlas   | Atlas                            | `/apps/tinyatlas`       | `http://127.0.0.1:18108/ui`      | `tiny-atlas`   |
| TinyPrior   | Prior                            | `/apps/tinyprior`       | `http://127.0.0.1:18109/ui`      | `tiny-prior`   |
| TinyPipe    | Auth + usage — fixture CIMD      | `/apps/tinypipe`        | `http://127.0.0.1:3712/ui`       | `tf-03`        |
| TinyTail    | As-of store — read-only          | `/apps/tinytail`        | `http://127.0.0.1:18765/ui`      | `js-01`        |
| TinyWeb     | Governed fetch — deny-list wins  | `/apps/tinyweb`         | `http://127.0.0.1:18766/ui`      | `js-03`        |
| TinyKit     | Recipe gallery                   | `/apps/tinykit`         | `http://127.0.0.1:18083/`        | `tf-02`        |

`bash scripts/start.sh` wraps each product's own compose when a sibling checkout (or a gitignored `.tinyfish-siblings/` clone) is available, remapping only host ports. If those checkouts are missing, it falls back to git-context builds in `docker-compose.tinyfish.yml` when the overlay lists the slug. README-only board repos are not a start failure. Product source is not vendored into TinyBot. Gates stay in the product repos (TinyTail stays read-only, TinyFeed cannot mint facilities, TinyTrigger cannot bypass T1, TinyKit failed evals cannot instantiate, TinyWeb deny-list wins, TinyPipe fixture tokens are `tfk.*` not JWTs).

Set `OPENBOT_SKIP_TINYFISH_PRODUCTS=1` to start TinyBot without the products.

### Fly Sprites (per-user production)

Localhost compose is the default. Set `SPRITES_TOKEN` or `SPRITE_TOKEN` (same Fly token, two env names) to provision **one Sprite per TinyFish user** on first sign-in. The Sprite URL stays `url_settings.auth = "sprite"` (never public). Start-page cards then iframe through TinyBot's session-authenticated proxy (`/api/sprite/apps/<slug>/...`) so the browser never holds the Fly token. TinyPipe still starts first inside that Sprite; products listen on the same remapped ports as localhost, behind one Caddy `http_port` on 8080.

CI is fixture-only. Tests mock the Sprites HTTP API and never call `api.sprites.dev`.

## Try it

- Open `/bot` and ask: `Open news.ycombinator.com and tell me the top story.`
- Ask the Bot to fill out <https://httpbin.org/forms/post>, then inspect `/admin/audit`.
- Open `/admin/boundaries`, add a deny rule or preset, and retry the same browser action.
- Create a coworker from `/agents`, give it a standing role, and start a channel with it.

## Main surfaces

| Route                | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `/`                  | TinyFish product cards, then start and browse channels.            |
| `/apps/:product`     | Embed one TinyFish product UI inside the TinyBot shell.            |
| `/agents`            | Create, edit, duplicate, hide, delete, and launch coworkers.       |
| `/channel/:id`       | Converse with one coworker and view its live screen/profile panel. |
| `/bot`               | Direct chat with a Bot; `?agent=<id>` selects one.                 |
| `/skills`            | Create and enable personal skills.                                 |
| `/sign`              | TinyFish fixture-desk sign-in (and Google, when configured).       |
| `/settings`          | User preferences and TinyFish profile (`tinyfish_user_id`).        |
| `/admin/connectors`  | Configure deployment knowledge sources.                            |
| `/admin/credentials` | Store write-only encrypted credentials.                            |
| `/admin/computers`   | View, stop, and reset Bot computers.                               |
| `/admin/boundaries`  | Configure browser/file/MCP action policy.                          |
| `/admin/components`  | Publish components and govern which Bots may use them.             |
| `/admin/playground`  | Draft and publish sandboxed components in the browser.             |
| `/admin/plugins`     | Configure MCP servers, MCP grants, and deployment skills.          |
| `/admin/audit`       | Review permitted, refused, and failed actions.                     |

## Features

- **A computer per Bot**: the supervisor gives each Bot its own container, its own `/workspace` volume and its own browser profile. Set `COMPUTER_RUNTIME=runsc` to run them under gVisor where the host supports it.
- **The gateway is the only way in**: it resolves the target from a server-held snapshot, evaluates the policy, writes the audit row, and only then calls the computer. There is no path that acts without the record existing first.
- **CEL policy, fail closed**: rules can inspect `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url`, `page.host`, `element.*`, `key`, `file.*` and `mcp.*`. Deny is evaluated before allow, a missing policy permits nothing, and a broken rule refuses rather than opens.
- **Take the wheel**: a Bot that hits a login wall or a 2FA prompt asks for help. Control is handed over in the same panel and recorded as `computer.help_requested`, `computer.control_taken` and `computer.control_released`. While a person is driving, Bot actions are refused rather than queued.
- **Secrets never enter the transcript**: the trail records that a secret was requested and how long it was, not what it said.
- **Bring your own agent**: any AG-UI endpoint is a Bot, on a framework or hand written. Endpoints are validated with the same target checks used for browser navigation, and an auth header is stored write-only.
- **Components instead of prose**: compiled React components live in `app/src/components/gallery/`, sandboxed ones are authored in `/admin/playground` and published with no deployment. Every call asks the server whether the component exists, is published, and is not withheld from that Bot. Data functions are granted per component.
- **Governed MCP**: a curated catalogue ships for Atlassian, Box, Slack, Salesforce and ServiceNow. Custom servers must pass URL checks, and any tool not positively classified as a read is treated as a write.
- **Skills are instructions, not capabilities**: personal skills attach only to Bots their author owns, deployment skills are admin-owned, and both are invoked with `/` in the composer.
- **An audit trail you can read**: `/admin/audit` lists what was permitted, what was refused and what failed, and every refusal carries the rule that caused it.
- **Credentials encrypted at rest**: stored through `/admin/credentials`, never returned by an API, and redacted from audit events.
- **Loopback by default**: computers bind to `127.0.0.1` and require a per-container token, so nothing reaches a logged-in browser by knowing its port.
- **Durable threads and memory**: conversations survive restarts through CopilotKit Intelligence, and each deployment stamps the threads it owns.

## Bring your own agent

Any AG-UI endpoint can be a Bot.

From `/agents`, create a coworker with:

- name, title, and role description;
- private or public visibility;
- optional AG-UI endpoint;
- optional write-only authorization header.

The server validates agent endpoints with the same target checks used for browser navigation. If no custom endpoint is set, product-created coworkers use `MANAGED_AGENT_AG_UI_URL`.

Tenant package agents are declared in `agents.yaml` as either:

- `built-in`, with a system prompt; or
- `remote-ag-ui`, with an endpoint.

See [docs/configuration.md](docs/configuration.md) and [docs/coworkers.md](docs/coworkers.md).

## Configuration

`.env.example` is the source template. The API server refuses to start without:

- `DATABASE_URL`
- `KEY_ENCRYPTION_KEY`
- `MANAGED_AGENT_AG_UI_URL`
- `INTELLIGENCE_API_URL`
- `INTELLIGENCE_GATEWAY_WS_URL`
- `INTELLIGENCE_API_KEY`
- `COPILOTKIT_LICENSE_TOKEN`

Settings worth knowing:

| Variable                             | Use                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `OPENBOT_DEV_NO_AUTH`                | Admits every request as one administrator. How TinyBot runs today.        |
| `OPENROUTER_API_KEY`                 | TinyBot inference key. OpenRouter Ox Alpha, then one Grok 4.6 retry. Never commit a real key. |
| `OPENAI_BASE_URL`                    | OpenAI-compatible endpoint. Defaults to `https://openrouter.ai/api/v1` when the OpenRouter key is set. |
| `ANTHROPIC_BASE_URL`, `GOOGLE_GENERATIVE_AI_BASE_URL` | The same, for those two APIs.            |
| `COMPUTER_TOKEN`                     | Secret every Bot computer request must present. `start.sh` sets one.      |
| `SUPERVISOR_TOKEN`                   | Secret the supervisor requires. `start.sh` sets one.                      |
| `COMPUTER_SUPERVISOR_URL`            | Gives each Bot a computer of its own instead of one shared computer.      |
| `COMPUTER_RUNTIME`                   | Set to `runsc` to run computers under gVisor, where the host has it.      |
| `AGENT_COMPUTER_POLICY`              | JSON action policy. Malformed JSON stops server startup.                  |
| `AGENT_COMPUTER_ALLOW_PRIVATE_HOSTS` | Lets a Bot reach this machine's own services.                             |
| `TENANT_PACKAGE_DIR`                 | Directory containing tenant YAML. Defaults to `../examples/fintech`.      |
| `DEPLOYMENT_ID`                      | Names this deployment when two share one Intelligence project.            |

Full reference: [docs/configuration.md](docs/configuration.md).

## Architecture

| Service                  | Port                       | Purpose                                                                                          |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `app`                    | 3010                       | React/Vite UI.                                                                                   |
| `server`                 | 3001                       | Hono API, CopilotKit runtime, auth, policy, audit, plugins, components, coworkers, and channels. |
| `agent-computer`         | 4100                       | Chromium plus `/workspace` and browser profile.                                                  |
| `agent-bot`              | 4200                       | Proof-of-concept AG-UI Bot.                                                                          |
| `agent-langgraph`        | 4201                       | LangGraph AG-UI Bot.                                                                             |
| `supervisor`             | 4500 host / 4300 container | Creates and manages one computer per Bot.                                                        |
| PostgreSQL with pgvector | 5432                       | Product data, policy, audit, credentials, grants, channels, knowledge, and component metadata.   |
| TinyPipe                 | 3712                       | Auth + usage console and MCP (`/mcp`). Must be up before TinyFish sign-in.                       |
| TinyTail                 | 18765                      | Long-tail as-of store (platform backend).                                                        |
| TinyWeb                  | 18766                      | Governed fetch (platform backend).                                                               |
| TinyKit                  | 18083                      | Recipe gallery (platform backend).                                                               |
| TinyPing                 | 18101                      | Funnel — first start-page card.                                                                  |
| TinyTrigger              | 18081                      | Watch / When / Do.                                                                               |
| TinyReg                  | 18102                      | Registry.                                                                                        |
| TinyScout                | 18103                      | Scout.                                                                                           |
| TinyBrief                | 18104                      | Brief.                                                                                           |
| TinyDeed                 | 18105                      | Deed.                                                                                            |
| TinyFeed                 | 18082                      | Event feed UI.                                                                                   |
| TinyFoundry              | 18106                      | Foundry.                                                                                         |
| TinyMargin               | 18107                      | Margin.                                                                                          |
| TinyAtlas                | 18108                      | Atlas.                                                                                           |
| TinyPrior                | 18109                      | Prior.                                                                                           |
| CopilotKit Intelligence  | external                   | Durable threads and memory.                                                                      |

The server gateway is the product/API path for Bot browser and file tool calls.
It resolves the target, evaluates policy, writes an audit row, and then calls
`agent-computer`. The computer also exposes lower-level token-protected service
endpoints; keep them private and do not use them to bypass the gateway.

More detail: [docs/architecture.md](docs/architecture.md).

## Sign in with Google

`OPENBOT_DEV_NO_AUTH` is the default because it needs no OAuth credentials and no consent screen. To sign in for real instead, create a Google OAuth client and set all four of these together:

```sh
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=        # openssl rand -base64 32, at least 32 characters
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

Then set the two that decide who gets in and from where:

- `TRUSTED_ORIGINS` — where the app is served from, `http://localhost:3010` locally. It defaults to `http://localhost:3000`, which is not where `start.sh` serves the app.
- `INITIAL_ADMIN_EMAILS` — comma separated. An address listed here becomes an administrator the first time it signs in; everybody else becomes a user.

Remove `OPENBOT_DEV_NO_AUTH`, then restart: the sign-in button is written into the app's generated config at startup, so it appears only once all four settings are present. Accounts, sessions and roles are stored in the same PostgreSQL database as everything else.

A partial set is refused rather than ignored: the server will not start with `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL` but no client credentials, or with a secret shorter than 32 characters.

## Keeping it to your machine

- `agent-computer` drives a browser holding real logins. `docker-compose.yml` binds it to loopback; leave it there.
- Store credentials through `/admin/credentials`, which encrypts them. Do not put credential values in tenant YAML or in committed files.
- `AGENT_COMPUTER_ALLOW_PRIVATE_HOSTS` lets a Bot reach services on this machine. Unset it if you would rather it could not.

## Development

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

After changing the Drizzle schema:

```sh
bun run --filter server db:generate
bun run --filter server db:migrate
```

Use `bash scripts/start.sh` for the whole stack. Use `bun run dev` only when you want the app and server without the Docker Bots and computers.

## Documentation

- [copilotkit.ai/openbot](https://copilotkit.ai/openbot)
- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/configuration.md](docs/configuration.md)
- [docs/development.md](docs/development.md)
- [docs/coworkers.md](docs/coworkers.md)

## Contributing

- Open an issue or coordinate before starting substantial work.
- Keep changes focused and update docs when setup, configuration, architecture, or user behavior changes.
- Keep secrets, service-account JSON, customer data, and local transcripts out of the repository.
- Run the checks in [Development](#development) before opening a pull request.

## License

[MIT](./LICENSE) © CopilotKit. TinyBot is a branded fork of [CopilotKit/OpenBot](https://github.com/CopilotKit/openbot).
