# TypeSprint

TypeSprint is a desktop and mobile typing practice app with Words, Time, Quote, and Code modes. It reports speed, accuracy, and mistakes for each sprint. Guests can view their latest score until they start another sprint or reload the page. Signing in saves results to a private history that follows the account across devices. The stack is React, Vite, Express, and MongoDB. Python and Matplotlib provide optional image charts.

## Local development

Use Node.js 22.12 or later in the Node 22 release line. Start a local MongoDB instance or configure a development database with `MONGODB_URI`. Copy `backend/.env.example` to `backend/.env`. Keep `NODE_ENV=development` for local HTTP.

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

Open **Log in** on the main screen. New users can select **Sign up** below the login form to open the registration page. Username and password sign-in works with MongoDB and the standard backend configuration. Passwords are stored as salted scrypt hashes. Signing out revokes the current session, and sessions expire after 30 days.

## Production deployment

Deploy the repository as one HTTPS service. Express serves the compiled frontend and `/api` on the same origin. Configure the host to build from the repository root and preserve both directories at runtime because the API imports the shared scoring module.

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
| **wordbanks** | One document for the default English word list. Words and Time draw from this list to generate each sprint. |
| **passages** | One document per quote or code exercise. |
| **users** | Username and password accounts with a display name and password hash. |
| **accountsessions** | Expiring, hashed session tokens associated with accounts. |
| **testresults** | Completed sprints associated with signed-in accounts. Guest scores are returned to the browser without a database write. |

The backend creates the default word bank when it connects. An existing database supplies its older word entries for the initial import. A fresh database uses the bundled words.json.
Older word documents are retained. Words and Time use the older entries if the bank is missing or invalid, and fall back to bundled words if MongoDB is unavailable.

You can also import the passages using the configured MongoDB connection.

```sh
npm --prefix backend run seed:passages
```

The import only inserts missing records. Edit the words array in the en-default bank to update a running database. Keep words.json updated for fresh deployments and offline use.
Quotes include an author. Code exercises include a title and language. To ship additional built-in quotes or exercises, add them to quotes.json or [the shared code library](frontend/src/data/codePassages.json) and rerun the import.

Code mode offers multi-line exercises across seven languages. Choose a language, press Enter at the end of each line, and use Next snippet to move on to a different exercise.
The display supplies indentation. The score counts the characters and line breaks you type.

## Scoring

- Net WPM uses correct characters in the final text, including matching spaces. A corrected character counts once toward net speed.
- Raw WPM uses all accepted typing attempts. Accuracy divides correct attempts by all accepted attempts. Backspace itself is an edit, and the original attempt remains part of raw speed and accuracy.
- The character breakdown reflects the final input. An unfinished word at the deadline in Time mode does not count its untyped suffix as missed.

## Verification

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
```

CI runs the build and tests on Linux and verifies MongoDB persistence, username account registration and sign-in, account isolation, and Matplotlib PNG rendering.

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
