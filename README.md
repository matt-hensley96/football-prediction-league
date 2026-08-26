# Football Score Predictor

A teletext/ceefax-styled Premier League prediction game.
Hosted entirely on Cloudflare's free tier (Workers + D1).

Players create an account with a PIN to log in with.

Every gameweek, players are emailed to prompt them to predict the outcome (home win / draw / away win) of 3 fixtures:
- Manchester United's game
- Leeds United's game
- The current top-of-the-table team's game (or the next-highest team if Man Utd or Leeds
  themselves are top)

Scoring for league table: 
- **+3** for a correct prediction
- **-1** for predicting a win that turns out to be a loss (or vice versa)
- **0** for any other prediction (e.g. predicting a win that ends in a draw)

A summary of their results is emailed to them at the end of the gameweek.

## Setting up your own league

1. **Fork this repo** on GitHub - you'll push to your fork's `main` branch to deploy.

2. **football-data.org token** - register a free account at
   [football-data.org/client/register](https://www.football-data.org/client/register) and copy
   your API token.

3. **Cloudflare account** - sign up at [dash.cloudflare.com](https://dash.cloudflare.com) if you
   don't already have one (the free tier covers this app).

4. **Create the D1 database**

   ```
   npx wrangler login
   npx wrangler d1 create football-score-predictor
   ```

   Copy the `database_id` it prints into `wrangler.toml` (replacing
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

5. **Set up emailing** - this is used for "forgot PIN" links and gameweek results) - sent via
   [Resend](https://resend.com). Register a free account, verify a sending domain, and copy an API
   key.

   Update `EMAIL_FROM` in `wrangler.toml` to an address on your verified Resend domain (e.g.
   `predictor@yourdomain.com`) - this isn't a secret, so it lives directly in `wrangler.toml`.

   Also update `APP_URL` in `wrangler.toml` to your Worker's URL once you know it (its
   `*.workers.dev` URL, or a custom domain) - reminder emails link back to it so players can go
   make their picks.

6. **Run the schema migration against the remote database**

   ```
   npm run db:migrate:remote
   ```

   This creates the tables and seeds the "CPU" system account.

7. **Deploy once manually**, to create the Worker and set its secrets:

   ```
   npx wrangler deploy
   npx wrangler secret put FOOTBALL_DATA_TOKEN
   npx wrangler secret put RESEND_API_KEY
   ```

8. **Set up automatic deploys via GitHub Actions** - add a repo secret named
   `CLOUDFLARE_API_TOKEN` (Settings → Secrets and variables → Actions) with a
   [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) that has Workers Scripts
   edit and D1 edit permissions. From then on, every push to `main` runs
   [.github/workflows/deploy.yml](.github/workflows/deploy.yml) and redeploys automatically.

## Local development

1. **Install dependencies**

   ```
   npm install
   ```

2. **Create a local D1 database and run the schema migration**

   ```
   npm run db:migrate:local
   ```

   This creates tables in a local SQLite file (managed by Wrangler/Miniflare) and seeds the "CPU"
   system account. If you ever want a clean slate, just delete `.wrangler/state` and re-run this
   command.

3. **Create a `.dev.vars` file** in the project root (gitignored - never commit it) with your own
   tokens:

   ```
   FOOTBALL_DATA_TOKEN=your-football-data-org-token
   RESEND_API_KEY=your-resend-api-key
   ```

4. **Start the dev server**

   ```
   npm run dev
   ```

   Opens the Worker locally (including the local D1 instance and the static UI) at the URL
   Wrangler prints.

**Local dev never runs the Cron Triggers by itself** - Miniflare doesn't fire them on a schedule;
that only happens for real once deployed. To test locally, POST to the special endpoint
`npm run dev` exposes. 

There are two schedules (see `wrangler.toml`), so pass `?cron=` to pick which
one fires - omitting it runs whichever is first in the `crons` array (the daily job):

```
# Daily job: open/lock/score gameweeks (against live football-data.org data)
curl -X POST http://127.0.0.1:8787/__scheduled

# Reminder check: email anyone missing predictions, if the 24h/3h-before window has been reached
curl -X POST "http://127.0.0.1:8787/__scheduled?cron=*%2F15+*+*+*+*"
```

## Deploy

Deploys happen automatically: pushing to `main` triggers
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which type-checks, runs the test
suite, and runs `wrangler deploy` using the `CLOUDFLARE_API_TOKEN` repo secret set up above.

To deploy manually instead (e.g. before that secret is configured), run:

```
npm run deploy
```

The Cron Triggers in `wrangler.toml` run automatically once deployed; no separate scheduler needed.