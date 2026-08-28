# Football Score Predictor

A teletext/ceefax-styled Premier League prediction game.

Live site hosted entirely on Cloudflare's free tier (Workers + D1):

https://football-score-predictor.mh96.workers.dev/

## Rules:

Players create an account.

Every gameweek, players are emailed to prompt them to predict the outcome of three randomly selected Premier League fixtures.

Scoring for league table: 
- **+3** for a correct prediction
- **-1** for predicting a win that turns out to be a loss (or vice versa)
- **0** for any other prediction (e.g. predicting a win that ends in a draw)

A summary of their results is emailed to them at the end of the gameweek.

## Tech stack:

**Runtime & language**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - serverless runtime hosting the whole app (API + static assets)
- [TypeScript](https://www.typescriptlang.org/) - `strict` mode, compiled/type-checked via `tsc`
- Node.js 20 - used in CI and for local tooling (the app itself runs on Workers, not Node)

**Data & storage**
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - serverless SQLite database (players, predictions, gameweeks, results)
- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) - scheduled jobs for gameweek sync and deadline reminders

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
| [Brevo](https://www.brevo.com) | Transactional email - deadline reminders, gameweek results, PIN reset links | `BREVO_API_KEY` secret ([email.ts](src/utils/email.ts)) |
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

4. **Start the dev server**

   ```
   npm run dev
   ```

   Opens the Worker locally (including the local D1 instance and the static UI) at the URL
   Wrangler prints.


**N.B. local dev never runs the Cron Triggers by itself** - Miniflare doesn't fire them on a schedule.
To test them locally, call the endpoints below as below:

```
# sync gameweeks (open / lock / score):
curl -X POST "http://127.0.0.1:8787/__scheduled?cron=0+8+*+*+*"

# email anyone missing predictions:
curl -X POST "http://127.0.0.1:8787/__scheduled?cron=*%2F15+*+*+*+*"
```

## Deployment process:

Deploys happen automatically: pushing to `main` triggers
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which type-checks, runs the test
suite, applies the schema migration to the remote database (`npm run db:migrate:remote`), and runs
`wrangler deploy` - all using the `CLOUDFLARE_API_TOKEN` repo secret. 

That token therefore needs D1 edit permission as well as Workers Scripts edit.

Because the migration runs on every deploy, keep `src/db/schema.sql` additive and idempotent -
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT OR IGNORE`. 
Anything destructive (dropping a column, changing a type) needs a real migration tool such as
[`wrangler d1 migrations`](https://developers.cloudflare.com/d1/reference/migrations/).

To deploy manually instead (e.g. before that secret is configured), run:

```
npm run deploy
```

The Cron Triggers in `wrangler.toml` run automatically once deployed; no separate scheduler needed.