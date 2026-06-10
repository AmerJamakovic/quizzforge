# QuizForge

A zero-cost, no-backend quiz web app. Create, take, and share quizzes, everything
runs in the browser. Quizzes are shared as JSON files (e.g. over Discord): export a
quiz, post the file, a friend imports it into their own copy.

There is no server, no login, and no hosting cost beyond free static hosting.

## Running it

It is plain static files with no build step. Open it any of these ways:

- **Hosted (recommended):** deploy to GitHub Pages, see Part 2 of the spec.
- **Locally with a tiny web server** (needed because ES modules and the service
  worker don't run from `file://`):

  ```sh
  cd quizforge
  python3 -m http.server 8000
  # then open http://localhost:8000/
  ```

Opening `index.html` directly via `file://` will not work, browsers block ES
module imports there. Use a local server as above.

## What's inside

| File | Purpose |
| --- | --- |
| `index.html` | App shell; loads styles + `js/main.js` as a module |
| `styles.css` | All styling (responsive, light/dark, keyboard-accessible) |
| `js/main.js` | Bootstrap + hash-based routing; first-run sample seed |
| `js/db.js` | IndexedDB persistence via Dexie + CRUD helpers |
| `js/schema.js` | Quiz JSON schema, validation, and factory helpers |
| `js/score.js` | `scoreQuestion` + attempt totals |
| `js/io.js` | Import / export (the Discord workflow) |
| `js/util.js` | Small shared DOM + formatting helpers |
| `js/state.js` | Transient in-memory attempt state |
| `js/sample.js` | Hand-written sample quiz seeded on first run |
| `js/views/*.js` | Library, Take, Results, Editor screens |
| `manifest.webmanifest`, `service-worker.js` | Optional PWA / offline support |

## Data model

A quiz is one JSON object (the import/export contract). `correct` is always an
array, for both `single` and `multi` questions. Ids are local to a quiz. See
spec section 1.4 for the full schema; `js/sample.js` is a working example.

## Scoring

One point per question. A question scores 1 only if the selected choice ids
exactly equal the question's `correct` ids, multi-choice is all-or-nothing,
no partial credit (spec 1.5).

## Notes on storage durability

Browser storage (IndexedDB) is a **cache**, not a permanent store, it can be
cleared by the user or the browser. The exported `.json` file is the durable
copy. Export quizzes you care about.
