# Football Score Predictor

A teletext/Ceefax-styled Premier League prediction game.
Hosted entirely on Cloudflare's free tier (Workers + D1).

Every gameweek, each player predicts the outcome (home win / draw / away win) of 3 fixtures:

- Manchester United's game
- Leeds United's game
- The current top-of-the-table team's game (or the next-highest team if Man Utd or Leeds
  themselves are top)

Scoring: 
- **+3** for a correct prediction
- **-1** for predicting a win that turns out to be a loss (or vice versa)
- **0** for any other prediction (e.g. predicting a win that ends in a draw)

A daily scheduled job (Cloudflare Cron Trigger) opens each new gameweek as soon as the previous
one is fully settled, locks predictions once the earliest of its 3 kickoffs passes, and scores
everything once all 3 results are in — using the free
[football-data.org](https://www.football-data.org/) API. See
[How the "gameweek" is decided](#how-the-gameweek-is-decided) below for the exact rule.

There's also a permanent **CPU** account in the league (a nod to the real Ceefax/Grandstand
"SuperComputer" feature) that always predicts a home win for every fixture — no login possible, it
just quietly racks up points alongside everyone else.

Players don't need to be pre-seeded — anyone can sign up for their own name/PIN from the
Predictions page.

## One-time setup

1. **football-data.org token** — register a free account at
   [football-data.org/client/register](https://www.football-data.org/client/register) and copy
   your API token.

2. **Install dependencies**

   ```
   npm install
   ```

3. **Cloudflare login**

   ```
   npx wrangler login
   ```

4. **Create the D1 database**

   ```
   npx wrangler d1 create football-score-predictor
   ```

   Copy the `database_id` it prints into `wrangler.toml` (replacing
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

5. **Set the API token as a secret** (used by the Worker, never sent to the browser)

   ```
   npx wrangler secret put FOOTBALL_DATA_TOKEN
   ```

   This only sets the secret for the **deployed** Worker. For local `wrangler dev`, also create a
   `.dev.vars` file in the project root (already gitignored — never commit it) containing:

   ```
   FOOTBALL_DATA_TOKEN=your-token-here
   ```

6. **Set up email (used for "forgot PIN" links and gameweek results)** — sent via
   [Resend](https://resend.com). Register a free account, verify a sending domain, and copy an API
   key.

   ```
   npx wrangler secret put RESEND_API_KEY
   ```

   Also add it to `.dev.vars` for local dev:

   ```
   RESEND_API_KEY=your-resend-api-key
   ```

   Update `EMAIL_FROM` in `wrangler.toml` to an address on your verified Resend domain (e.g.
   `predictor@yourdomain.com`) — this one isn't a secret, so it lives directly in `wrangler.toml`.

7. **Run the schema migration**

   ```
   npm run db:migrate:local    # for local dev
   npm run db:migrate:remote   # once you're ready to deploy for real
   ```

   This also seeds the CPU account automatically. If your database already existed *before* the
   CPU/signup feature was added, run this one-off patch instead (safe to run once only —
   re-running it will error with "duplicate column name"):

   ```
   npm run db:migrate-add-is-system:local
   npm run db:migrate-add-is-system:remote
   ```

   Likewise, if your database already existed *before* the email/PIN-recovery feature was added,
   run this one-off patch (also safe to run once only):

   ```
   npm run db:migrate-add-email:local
   npm run db:migrate-add-email:remote
   ```

8. **(Optional) Pre-seed some players** — anyone can also just sign up for themselves from the
   Predictions page in the app, so this step is only useful if you'd rather set PINs for people up
   front. Edit the `players` list in `scripts/generate-seed.mjs` with each person's name and a
   PIN, then run **all three** of these, in order:

   ```
   node scripts/generate-seed.mjs > scripts/seed-users.sql
   npm run db:seed:local
   npm run db:seed:remote
   ```

   If you add/rename/remove players later, repeat all three commands. They only *insert* — they
   won't remove players you've since deleted from the list, so drop stale ones by name if needed:

   ```
   npx wrangler d1 execute football-score-predictor --local --command "DELETE FROM users WHERE name = 'Alice'"
   ```

   (add `--remote` once you've deployed, to do the same against the live database).

## Local development

```
npm run dev
```

Opens the Worker locally (including a local D1 instance and the static UI) at the URL Wrangler
prints.

**Local dev never opens a gameweek by itself** — Miniflare doesn't run the daily Cron Trigger on a
schedule; that only happens for real once you `npm run deploy`. To test gameweek
creation/locking/scoring locally against live football-data.org data, trigger the cron handler by
POSTing to the special endpoint `npm run dev` exposes:

```
curl -X POST http://127.0.0.1:8787/__scheduled
```

If it responds without opening a gameweek, that's expected whenever there's still an unscored
gameweek sitting around — see [How the "gameweek" is decided](#how-the-gameweek-is-decided) below.

## Tests

```
npm test
```

Covers the scoring rules and the "who's top of the table, excluding Man Utd/Leeds" selection
logic — both are pure functions with no network/database dependency.

## Deploy

```
npm run deploy
```

Prints your live `*.workers.dev` URL — open it on your phone to check the UI. 
The cron trigger in `wrangler.toml` runs automatically once deployed; no separate scheduler needed.

## How the "gameweek" is decided

The daily job (`src/cron/handler.ts`) does three things, in order:

1. **Lock** — any `open` gameweek whose deadline (the earliest of its 3 fixtures' kickoffs) has
   passed flips to `locked`.
2. **Score** — any `locked` gameweek whose 3 fixtures are all `FINISHED` gets scored: each
   prediction's points are calculated, the gameweek flips to `scored`, and a results email goes
   out to every player who has an email address on file.
3. **Open** — a new gameweek is only opened once **every existing gameweek is `scored`** (or
   there are none yet, for the very first one). This means the next round of predictions opens as
   soon as the previous gameweek's 3 results are all in — no fixed lead time before kickoff.

This also means a postponed/rescheduled PL fixture is handled naturally: the affected gameweek
just stays `locked` (not `scored`, so the next one can't open) until the results eventually come
in, however long that takes.