# Football Predictor

A teletext/ceefax-styled Premier League prediction game.

Live site hosted entirely on Cloudflare's free tier (Workers + D1):

https://football-score-predictor.mh96.workers.dev/

## Rules:

Players create an account with a PIN.

Every gameweek, players are prompted to predict the outcome of three randomly selected Premier League fixtures.

The league table is then scored as follows:
- **+3** for a correct prediction
- **-1** for predicting a win that turns out to be a loss (or vice versa)
- **0** for any other prediction (e.g. predicting a win that ends in a draw)

## Tech stack:

**Runtime & language**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - serverless runtime hosting the whole app (API + static assets)
- [TypeScript](https://www.typescriptlang.org/) - `strict` mode, compiled/type-checked via `tsc`
- Node.js 20 - used in CI and for local tooling (the app itself runs on Workers, not Node)

**Data & storage**
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - serverless SQLite database (players, predictions, gameweeks, results)
- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) - a daily gameweek-sync, deadline reminders, and weekly housekeeping

**Frontend**
- Static HTML/CSS/vanilla JavaScript (no framework/build step) served via [Cloudflare Workers Assets](https://developers.cloudflare.com/workers/static-assets/), styled to look like a Ceefax/teletext service

**Tooling & testing**
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - CLI for local dev, D1 migrations/seeding, and deployment
- [Vitest](https://vitest.dev/) + [`@cloudflare/vitest-pool-workers`](https://developers.cloudflare.com/workers/testing/vitest-integration/) - test runner, executed inside a real `workerd` environment
- [GitHub Actions](https://github.com/features/actions) - CI/CD, type-checks + tests + `wrangler deploy` on every push to `main`

## Third-party dependencies:

| Service | Used for | Config |
|---|---|---|
| [Cloudflare](https://dash.cloudflare.com) | Hosting (Workers, D1, static assets, cron) | Account login (`wrangler login`) + `CLOUDFLARE_API_TOKEN` repo secret |
| [football-data.org](https://www.football-data.org/) | Football data sAPI for fixtures, results, and standings | `FOOTBALL_DATA_TOKEN` secret ([client.ts](src/football-data/client.ts)) |
| [Brevo](https://www.brevo.com) | Transactional email - deadline reminders, season summary, PIN reset links | `BREVO_API_KEY` secret ([email.ts](src/utils/email.ts)) |
| [GitHub Actions](https://github.com/features/actions) | CI/CD on push to `main` | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |

No other external APIs or paid services are used - the whole app runs on Cloudflare's free tier plus free tiers of football-data.org and Brevo.


## Local development:

1. **Install dependencies**

   ```
   npm install
   ```

2. **Create a local D1 database and run the schema migration**

   ```
   npm run db:migrate:local
   ```

   This creates tables in a local SQLite file (managed by Wrangler/Miniflare) and seeds the "CPU"
   system account. 
   
   If you ever want a clean slate, just delete `.wrangler/state` and re-run this
   command.

3. **Create a `.dev.vars` file** in the project root (gitignored - never commit it) with your own
   tokens:

   ```
   FOOTBALL_DATA_TOKEN=your-football-data-org-token
   BREVO_API_KEY=your-brevo-api-key
   EMAIL_FROM=your-verified-brevo-sender@example.com
   ```

   To run without any real football-data.org token, add `USE_MOCK_FOOTBALL_DATA=true` - see
   [Local testing with the mock football-data API](#local-testing-with-the-mock-football-data-api)
   below. With the mock on, `FOOTBALL_DATA_TOKEN` is unused and the Brevo values can be dummies
   (email sends just fail and are logged).

4. **Start the dev server**

   ```
   npm run dev
   ```

   Opens the Worker locally (including the local D1 instance and the static UI) at the URL
   Wrangler prints.


The gameweek sync normally runs on demand - just load the UI, or call it directly:

```
# syncGameweek (lock past deadlines, score finished fixtures, open the next gameweek).
# No-ops if a sync ran in the last 15 minutes:

curl -X POST "http://127.0.0.1:8787/api/sync"
```

**N.B. local dev never runs the Cron Triggers by itself** - Miniflare doesn't fire them on a schedule.
To test them locally, call the endpoints below::

```
# daily at 6am - syncGameweek (same work as POST /api/sync, but unconditional):

curl -X POST "http://127.0.0.1:8787/__scheduled?cron=0+6+*+*+*"
```
```
# daily at 8am checkAndSendReminders (email anyone still missing predictions if the deadline is within 36h):

curl -X POST "http://127.0.0.1:8787/__scheduled?cron=0+8+*+*+*"
```
```
# weekly - cleanupUsers (deactivate inactive accounts, send the season summary):

curl -X POST "http://127.0.0.1:8787/__scheduled?cron=0+9+*+*+1"
```

## Local testing with the mock football-data API

Set `USE_MOCK_FOOTBALL_DATA=true` in `.dev.vars`.

This swaps the real football-data.org client
for [`MockFootballDataClient`](src/football-data/mock-client.ts), which serves three Gameweeks of fixtures and results ([`src/football-data/mock-data.ts`](src/football-data/mock-data.ts)).

Progress is stepped forward by hand via three test endpoints outlined further down. Each step also runs the sync job, so the app reacts in the same call.

Setup (one-off, alongside the normal steps above):

```
npm run db:migrate:mock:local   # creates the mock_football_state table locally
```

Then, after  `npm run dev`, run:

```
npm run mock:reset     
# This wipes gameweeks and opens a fresh 'Gameweek 1'
# Then you can open the UI, sign up, predict all 3 fixtures

npm run mock:advance
# This locks the gameweek (simulating the deadline passing)

npm run mock:advance   
# fixture 1 finishes and is scored

npm run mock:advance   
# fixture 2 finishes and is scored

npm run mock:advance   
# fixture 3 finishes -> gameweek ends -> matchday 2 opens

npm run mock:state     # inspect current gameweek, per-fixture results, and what the next advance does
```

Repeat the four `mock:advance` calls to roll through Gameweeks 2 and 3. After Gameweek 3 is
scored there are no more mock fixtures, so no further gameweek opens. 

`npm run mock:reset`
starts the loop over.

## Deployment process:

Deployments happen automatically: pushing to `main` triggers
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which type-checks, runs the test
suite, applies the schema migration to the remote database (`npm run db:migrate:remote`), and runs
`wrangler deploy` - all using the `CLOUDFLARE_API_TOKEN` repo secret. 

That token therefore needs D1 edit permission as well as Workers Scripts edit.

Because the migration runs on every deploy, keep `src/db/schema.sql` additive and idempotent -
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT OR IGNORE`. 
Anything destructive (dropping a column, changing a type) needs a real migration tool such as
[`wrangler d1 migrations`](https://developers.cloudflare.com/d1/reference/migrations/).

To deploy manually instead, run:

```
npm run deploy
```

The Cron Triggers in `wrangler.toml` run automatically once deployed; no separate scheduler needed.