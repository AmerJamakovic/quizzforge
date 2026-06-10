// main.js, bootstrap + hash-based routing.
// The app is served as plain static files from a project sub-path on GitHub
// Pages, so every path here is relative and routing uses the URL hash only.

import { getAllQuizzes, saveQuiz, quizExists } from './db.js';
import { SAMPLE_QUIZ } from './sample.js';
import { toast } from './util.js';
import { openReportBugsModal, openAboutModal } from './modal.js';

import * as library from './views/library.js';
import * as take from './views/take.js';
import * as results from './views/results.js';
import * as editor from './views/editor.js';
import * as importView from './views/import.js';

const appRoot = () => document.getElementById('app');

// ---------------------------------------------------------------------------
// First-run seed: drop the sample quiz into the library once, so the app is
// never empty on a fresh browser. A flag in localStorage prevents re-seeding
// after the user deletes it.
// ---------------------------------------------------------------------------
async function seedIfFirstRun() {
  const SEED_FLAG = 'quizforge:seeded';
  if (localStorage.getItem(SEED_FLAG)) return;
  try {
    const existing = await getAllQuizzes();
    if (existing.length === 0 && !(await quizExists(SAMPLE_QUIZ.id))) {
      await saveQuiz(structuredClone(SAMPLE_QUIZ));
    }
    localStorage.setItem(SEED_FLAG, '1');
  } catch (err) {
    // Seeding is best-effort; never block the app on it.
    console.warn('Sample seed skipped:', err);
  }
}

// ---------------------------------------------------------------------------
// Routing. Routes (all under the hash):
//   #/                 -> library
//   #/take/:id         -> take quiz
//   #/results/:id      -> results (needs an in-memory attempt; else redirects)
//   #/editor/new       -> new quiz editor
//   #/editor/:id       -> edit existing quiz
// ---------------------------------------------------------------------------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, ''); // strip leading "#/" or "#"
  const parts = raw.split('/').filter(Boolean);
  return parts; // e.g. ['take', 'q_abc']
}

async function render() {
  const root = appRoot();
  const [section, param] = parseHash();
  root.innerHTML = '';
  updateNavHighlight(section || 'library');

  try {
    switch (section) {
      case undefined:
      case '':
      case 'library':
        await library.render(root);
        break;
      case 'take':
        await take.render(root, param);
        break;
      case 'results':
        await results.render(root, param);
        break;
      case 'editor':
        await editor.render(root, param); // param is 'new' or a quiz id
        break;
      case 'import':
        await importView.render(root, param); // param 'classmarker' preselects that tab
        break;
      default:
        navigate('#/');
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = '';
    root.appendChild(errorPanel(err));
  }
  // Move focus to the top of the freshly rendered view for keyboard users.
  const heading = root.querySelector('h1, h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  }
}

function errorPanel(err) {
  const wrap = document.createElement('section');
  wrap.className = 'panel error-panel';
  wrap.innerHTML = `<h2>Something went wrong</h2><p>${(err && err.message) || err}</p>
    <p><a href="#/">Back to the library</a></p>`;
  return wrap;
}

function updateNavHighlight(section) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === section);
  });
}

/** Programmatic navigation helper, re-exported for views. */
export function navigate(hash) {
  if (location.hash === hash) {
    render(); // same hash: force a re-render
  } else {
    location.hash = hash;
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', async () => {
  await seedIfFirstRun();
  if (!location.hash) location.hash = '#/';
  else render();
  registerServiceWorker();

  const reportBtn = document.getElementById('report-bugs-btn');
  if (reportBtn) reportBtn.addEventListener('click', () => openReportBugsModal());

  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) aboutBtn.addEventListener('click', () => openAboutModal());

  // Footer shortcuts reuse the header modals.
  const footerAbout = document.getElementById('footer-about');
  if (footerAbout) footerAbout.addEventListener('click', () => openAboutModal());
  const footerReport = document.getElementById('footer-report');
  if (footerReport) footerReport.addEventListener('click', () => openReportBugsModal());

  wireThemeToggle();
});

// ---------------------------------------------------------------------------
// "Make it PINKKK!!", an optional soft-pink theme, remembered across visits.
// ---------------------------------------------------------------------------
const THEME_KEY = 'quizforge:theme';

function applyTheme(theme) {
  if (theme === 'pink') document.documentElement.dataset.theme = 'pink';
  else delete document.documentElement.dataset.theme;
}

// Apply the saved theme as early as possible to avoid a flash.
applyTheme(localStorage.getItem(THEME_KEY));

function wireThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const sync = () => {
    btn.textContent = document.documentElement.dataset.theme === 'pink' ? 'Back to teal' : 'Make it PINKKK!!';
  };
  sync();
  btn.addEventListener('click', () => {
    const isPink = document.documentElement.dataset.theme === 'pink';
    applyTheme(isPink ? null : 'pink');
    localStorage.setItem(THEME_KEY, isPink ? 'teal' : 'pink');
    sync();
  });
}

// Optional offline support. Registered with a relative path so it works under
// a GitHub Pages project sub-path. Failure is non-fatal (e.g. file:// origin).
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // SWs are not allowed on file://
  navigator.serviceWorker.register('./service-worker.js').catch((err) => {
    console.warn('Service worker registration skipped:', err);
  });
}

// Surface unexpected async failures rather than failing silently.
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('Unexpected error: ' + ((e.reason && e.reason.message) || e.reason), 'error');
});
