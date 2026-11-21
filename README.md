# TypeSprint

TypeSprint is a responsive typing practice app for desktop and mobile. It offers **Words**, **Time**, **Quote**, and **Code** practice modes, with a hidden **Zen** mode available through the API. Every sprint reports net WPM, raw WPM, accuracy, consistency, mistakes, and a full character breakdown, with live per-second feedback and optional mechanical key-click sounds.

Guests can finish a sprint and see their latest result until they start another sprint or reload the page. Creating an account saves results to a private history that follows the account across devices, with lifetime statistics, a progress trend chart, per-mode filtering, and individual or bulk deletion.

Words and Time draw from a bundled English word bank that can be extended with punctuation and numbers. Quote mode serves curated quotes with their authors, and Code mode offers multi-line exercises across seven languages with the indentation supplied. If the server is unreachable, the app falls back to bundled passages so a sprint can still run.

The frontend is React with Vite, the backend is Express with Mongoose on Node.js, and MongoDB stores the word bank, passages, accounts, sessions, and results. Python with pandas and Matplotlib renders optional PNG charts; the interactive results chart is pure SVG and works without Python.

## Features

- **Four practice modes** — Words, Time, Quote, and Code, plus an API-only Zen mode.
- **Live feedback** — per-second WPM and mistake tracking, a moving caret, and correct/incorrect character highlighting.
- **Modifiers** — punctuation and number injection, and a toggleable Web Audio key-click sound.
- **Detailed results** — net WPM, raw WPM, accuracy, consistency, mistakes, and a correct/incorrect/extra/missed character breakdown.
- **Analytics** — an interactive SVG chart for every sprint and a Matplotlib trend chart over recent history.
- **Accounts** — username/password sign-up and sign-in, salted scrypt password hashing, and 30-day cookie sessions.
- **History** — lifetime stats, per-mode filtering, pagination, and single or bulk deletion.
- **Resilient** — offline passage fallbacks, rate limiting, Helmet CSP in production, and database health checks.

## Local development

Use Node.js 22.12 or later in the Node 22 release line. Start a local MongoDB instance or configure a development database with `MONGODB_URI` in `backend/.env`. Keep `NODE_ENV=development` for local HTTP.

Run both commands from the repository root in separate terminals:

```sh
npm --prefix backend ci
npm --prefix backend run dev
```

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open `http://localhost:5173`. Vite forwards `/api` to port 5000 by default. If Matplotlib is needed, run `python -m pip install -r backend/requirements.txt` and configure `PYTHON_COMMAND` for the same interpreter.

## TypeSprint accounts

Open **Log in** on the main screen. New users can select **Sign up** below the login form to open the registration page. Usernames are 3–24 characters and may contain letters, numbers, periods, underscores, and hyphens. Passwords are stored as salted scrypt hashes and compared in constant time. Signing out revokes the current session, and sessions expire after 30 days.

## Modes and modifiers

| Mode | What it does |
| --- | --- |
| **Words** | Type a fixed count of words (10, 25, 50, or 100). The sprint ends when the last word is completed. |
| **Time** | Type for a fixed duration (15, 30, 60, or 120 seconds). More words are appended as you approach the end of the list. |
| **Quote** | Type a curated quote with its author. |
| **Code** | Type a multi-line code exercise. Choose one of seven languages or **All languages**, press Enter at the end of each line, and use **Next snippet** for a different exercise. Indentation is supplied. |
| **Zen** | A 100-word sprint. Accepted by the API and stored in history, but not shown in the mode bar. |

The **@ punctuation** and **# numbers** modifiers apply to Words and Time. The sound toggle enables a synthesized mechanical key click and an error tone through the Web Audio API; no audio files are required.

## Production deployment

The included `render.yaml` provides a single-service Render deployment. Set `MONGODB_URI` and `APP_ORIGIN` in the Render service environment; do not add credentials to source files.

Deploy the repository as one HTTPS service. Express serves the compiled frontend and `/api` on the same origin. Configure the host to build from the repository root and preserve both directories at runtime because the API imports the shared scoring module from `frontend/src/utils`.

```sh
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend ci --omit=dev
npm --prefix backend start
```

For Matplotlib image charts, install `backend/requirements.txt` in the service’s Python 3.11+ environment. The interactive results chart is available when the renderer is offline or busy.

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Private connection string for your MongoDB database, such as MongoDB Atlas |
| `APP_ORIGIN` | Exact browser-facing HTTPS origin when a reverse proxy changes the API host. Omit the trailing slash. |
| `PORT` | Port supplied by the host, with `5000` as the default |
| `PYTHON_COMMAND` | Path to the interpreter with the plotting dependencies, or `python` if it is on PATH |
| `TRUST_PROXY` | Leave unset for direct connections. Behind a reverse proxy, use the specific trusted proxy addresses or verified hop count. |
| `CORS_ORIGIN` | Leave empty for the default deployment. For a separate frontend, use its exact HTTPS origin, without a trailing slash. |
| `CROSS_SITE_SESSION` | Leave `false` for same-site hosts. Use `true` with explicit allowed origins only when the hosts are on different sites. |
| `VITE_API_URL` | Frontend build variable. Leave empty for relative API URLs. For separate hosting, set it to the backend HTTPS origin before building. |

For Vercel and Render, rewrite `/api/:path*` on Vercel to `https://YOUR-RENDER-SERVICE.onrender.com/api/:path*` before the SPA rewrite to `index.html`. Leave `VITE_API_URL` empty and set `APP_ORIGIN` and `CORS_ORIGIN` on Render to the public Vercel origin. Keep `CROSS_SITE_SESSION=false`. The Vercel origin then serves the login and session requests from the browser's perspective.

Use `/api/live` for process liveness and `/api/health` for MongoDB readiness. Sprints can still run during a database outage. The Results page reports a save failure when history is unavailable. Older visitor results stay in MongoDB and are excluded from account history.

## Passage library

| Collection | What it stores |
| --- | --- |
| **wordbanks** | One document for the default English word list (`en-default`). Words and Time draw from this list to generate each sprint. |
| **passages** | One document per quote or code exercise, plus any legacy word passages. |
| **users** | Username and password accounts with a display name and password hash. |
| **accountsessions** | Expiring, hashed session tokens associated with accounts. |
| **testresults** | Completed sprints associated with signed-in accounts. Guest scores are returned to the browser without a database write. |

The backend creates the default word bank when it connects. An existing database supplies its older word entries for the initial import. A fresh database uses the bundled `words.json` (437 words). Older word documents are retained. Words and Time use the older entries if the bank is missing or invalid, and fall back to bundled words if MongoDB is unavailable.

You can also import the passages using the configured MongoDB connection.

```sh
npm --prefix backend run seed:passages
```

The import only inserts missing records. Edit the words array in the `en-default` bank to update a running database. Keep `words.json` updated for fresh deployments and offline use.

Quotes include an author (36 bundled). Code exercises include a title and language (21 bundled, three per language). To ship additional built-in quotes or exercises, add them to `quotes.json` or [the shared code library](frontend/src/data/codePassages.json) and rerun the import.

## Scoring

- **Net WPM** uses correct characters in the final text, including matching spaces. A corrected character counts once toward net speed.
- **Raw WPM** uses all accepted typing attempts. Accuracy divides correct attempts by all accepted attempts. Backspace itself is an edit, and the original attempt remains part of raw speed and accuracy.
- **Errors** are the sum of incorrect, extra, and missed characters.
- **Consistency** is `100 −` the coefficient of variation of the per-second WPM series, so a steady rhythm scores near 100%.
- The **character breakdown** reflects the final input. An unfinished word at the deadline in Time mode does not count its untyped suffix as missed.

A sprint is capped at 3600 seconds and 10,000 characters, and each chart series is capped at 600 points.

## Verification

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
```

CI runs the lint, build, and tests on Linux and verifies MongoDB persistence, username account registration and sign-in, account isolation, and Matplotlib PNG rendering.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/text` | Generate a passage for the selected mode and modifiers. |
| `POST /api/calculate` | Score a sprint and return its save status, a record ID when saved, and an optional PNG. |
| `GET /api/auth/session` | Return the current account, if signed in. |
| `POST /api/auth/register` | Create a username and password account and sign in. |
| `POST /api/auth/login` | Sign in to a username and password account. |
| `POST /api/auth/logout` | Revoke the current sign-in session. |
| `GET /api/history` | Return the current account's history, stats, and trend using `mode`, `page`, and `pageSize`. |
| `DELETE /api/history/:id` | Delete one record owned by the current account. |
| `DELETE /api/history` | Clear the current account's history. |
| `GET /api/live` | Check the HTTP process. |
| `GET /api/health` | Check database readiness. |

## Project structure

```text
backend/
  models/        Mongoose models for users, sessions, passages, word banks, and results
  services/      Passage generation, scoring hand-off, sessions, accounts, and the Python plotter
  data/          Bundled words and quotes
  scripts/       Passage import script
  test/          Node.js test suites
frontend/
  src/
    components/  Code passage view, interactive SVG chart, and account actions
    data/        Bundled code passages
    utils/       Shared scoring and code-typing helpers (also imported by the backend)
    *.jsx        App shell, typing arena, results, history, and sign-in pages
```
