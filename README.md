# FinanceAI — Express + JSON Backend

Personal finance tracker. Plain HTML/CSS/JS frontend, Express backend, data persisted as JSON files (no database, no native modules — works the same on Windows, Linux, and Android/Termux).

## Project structure

```
financeai/
  server.js          Express server + REST API
  package.json
  data/               <- created automatically on first run
    transactions.json
    budgets.json
    goals.json
  public/             <- static frontend, served by Express
    dashboard.html
    transactions.html
    budgets.html
    analytics.html
```

## Setup

```
cd financeai
npm install
npm start
```

Then open **http://localhost:3000/dashboard.html** in a browser.

On Termux (Android), same steps — just make sure Node.js is installed (`pkg install nodejs`) and run from inside the `financeai` folder.

## How data flows

- All four pages are static files served by Express from `public/`.
- All pages call the same REST API (same origin, so no CORS setup needed).
- The API reads/writes three JSON files under `data/`. Nothing else touches those files — don't hand-edit them while the server is running, since your changes could get overwritten on the next write.
- `data/` is created automatically (with default budgets) the first time you run `npm start` if it doesn't already exist.

## API reference

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | /api/transactions | — | returns array |
| POST | /api/transactions | `{type, amount, date, account, category, toAccount, note}` | server assigns `id` |
| PUT | /api/transactions/:id | same shape | full replace |
| DELETE | /api/transactions/:id | — | |
| GET | /api/budgets | — | returns `{category: limit}` object |
| PUT | /api/budgets/:category | `{limit}` | |
| GET | /api/goals | — | returns array |
| POST | /api/goals | `{title, targetAmount, targetDate}` | `savedAmount` starts at 0 |
| PUT | /api/goals/:id | `{title, targetAmount, targetDate}` | |
| DELETE | /api/goals/:id | — | |
| POST | /api/goals/:id/contribute | `{amount, account}` | atomically increases the goal's `savedAmount` **and** logs a `transfer` transaction — this is why Contribute doesn't need a separate transaction API call from the frontend |

## What changed from the localStorage version

Nothing about the UI logic changed — same data shapes, same validation rules, same category/account lists. Only the storage layer changed: every page now calls `fetch()` against these endpoints instead of reading/writing `localStorage`. If the server isn't running, each page shows an inline error ("Couldn't save... Is the FinanceAI server running?") instead of failing silently.

## Known limitations (by design, for this step)

- Single user, no auth — anyone who can reach the server can read/write the data.
- No file locking beyond Node's synchronous fs calls — fine for one person using the app, not for concurrent writers.
- No pagination/streaming on the JSON reads — fine at personal-finance-tracker data volumes, would need revisiting at large scale.
