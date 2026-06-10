// views/take.js, Take quiz (spec 1.6 B; R3, R5, R6).
// Renders questionsPerPage questions per page with Prev/Next navigation and a
// progress indicator. Single questions render as radios, multi as checkboxes.
// Selections live in memory for the whole attempt and survive page changes.
// No correctness shown during the attempt; no timer. Submit grades and moves
// to results.

import { getQuiz } from '../db.js';
import { scoreAttempt } from '../score.js';
import { setLastResult } from '../state.js';
import { el, esc, toast, confirmAction } from '../util.js';
import { navigate } from '../main.js';

// Per-attempt state, rebuilt each time the view is entered.
let attempt = null;

export async function render(root, quizId) {
  const quiz = await getQuiz(quizId);
  if (!quiz) {
    toast('That quiz no longer exists.', 'error');
    navigate('#/');
    return;
  }

  attempt = buildAttempt(quiz);
  drawPage(root);
}

function buildAttempt(quiz) {
  const order = quiz.questions.map((_, i) => i);
  if (quiz.settings && quiz.settings.shuffleQuestions) shuffle(order);

  // Pre-compute per-question display order for choices (respecting shuffle).
  const choiceOrder = {};
  for (const q of quiz.questions) {
    const idx = q.choices.map((_, i) => i);
    if (quiz.settings && quiz.settings.shuffleChoices) shuffle(idx);
    choiceOrder[q.id] = idx;
  }

  return {
    quiz,
    order,            // display order of question indexes
    choiceOrder,
    selections: new Map(), // questionId -> Set of selected choice ids
    page: 0
  };
}

function perPage() {
  const n = attempt.quiz.settings?.questionsPerPage;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function totalPages() {
  return Math.max(1, Math.ceil(attempt.order.length / perPage()));
}

function questionsOnPage() {
  const size = perPage();
  const start = attempt.page * size;
  return attempt.order.slice(start, start + size).map((qi) => attempt.quiz.questions[qi]);
}

function drawPage(root) {
  root.innerHTML = '';
  const { quiz } = attempt;
  const pages = totalPages();

  root.appendChild(el('div', { class: 'view-header' },
    el('div', {},
      el('h1', {}, esc(quiz.title)),
      quiz.description ? el('p', { class: 'muted' }, quiz.description) : null
    ),
    el('a', { class: 'btn ghost', href: '#/' }, '← Library')
  ));

  // Progress indicator.
  const size = perPage();
  const firstNum = attempt.page * size + 1;
  const lastNum = Math.min(firstNum + size - 1, attempt.order.length);
  const progressLabel = size === 1
    ? `Question ${firstNum} of ${attempt.order.length}`
    : `Questions ${firstNum} to ${lastNum} of ${attempt.order.length} (page ${attempt.page + 1} of ${pages})`;
  root.appendChild(el('p', { class: 'progress', role: 'status' }, progressLabel));

  // Questions on this page.
  const form = el('form', { class: 'take-form', onsubmit: (e) => e.preventDefault() });
  questionsOnPage().forEach((q) => form.appendChild(renderQuestion(q)));
  root.appendChild(form);

  // Navigation controls.
  const nav = el('div', { class: 'take-nav' });
  if (attempt.page > 0) {
    nav.appendChild(el('button', { class: 'btn', onclick: () => goTo(root, attempt.page - 1) }, '← Previous'));
  }
  if (attempt.page < pages - 1) {
    nav.appendChild(el('button', { class: 'btn primary', onclick: () => goTo(root, attempt.page + 1) }, 'Next →'));
  } else {
    nav.appendChild(el('button', { class: 'btn primary', onclick: () => submit(root) }, 'Submit'));
  }
  root.appendChild(nav);
}

function renderQuestion(q) {
  const isMulti = q.type === 'multi';
  const selected = attempt.selections.get(q.id) || new Set();

  const fieldset = el('fieldset', { class: 'question' });
  fieldset.appendChild(el('legend', { class: 'question-prompt' },
    el('span', { class: `qtype-badge ${isMulti ? 'multi' : 'single'}` }, isMulti ? 'Select all that apply' : 'Select one'),
    el('span', { class: 'prompt-text' }, esc(q.prompt))
  ));

  const list = el('div', { class: 'choices' });
  for (const ci of attempt.choiceOrder[q.id]) {
    const choice = q.choices[ci];
    const inputId = `q-${q.id}-c-${choice.id}`;
    const input = el('input', {
      type: isMulti ? 'checkbox' : 'radio',
      name: `q-${q.id}`,
      id: inputId,
      value: choice.id,
      checked: selected.has(choice.id),
      onchange: (e) => onSelect(q, choice.id, e.target.checked, isMulti)
    });
    const label = el('label', { class: 'choice', for: inputId }, input,
      el('span', { class: 'choice-text' }, esc(choice.text)));
    list.appendChild(label);
  }
  fieldset.appendChild(list);
  return fieldset;
}

function onSelect(q, choiceId, checked, isMulti) {
  let set = attempt.selections.get(q.id);
  if (!set) { set = new Set(); attempt.selections.set(q.id, set); }
  if (isMulti) {
    if (checked) set.add(choiceId); else set.delete(choiceId);
  } else {
    set.clear();
    if (checked) set.add(choiceId);
  }
}

function goTo(root, page) {
  attempt.page = Math.max(0, Math.min(page, totalPages() - 1));
  drawPage(root);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function unansweredCount() {
  let n = 0;
  for (const q of attempt.quiz.questions) {
    const set = attempt.selections.get(q.id);
    if (!set || set.size === 0) n++;
  }
  return n;
}

function submit(root) {
  // Warn-and-allow on unanswered questions (open Q4 default, confirmed).
  const missing = unansweredCount();
  if (missing > 0) {
    const ok = confirmAction(
      `${missing} question${missing === 1 ? ' is' : 's are'} unanswered. Submit anyway?`
    );
    if (!ok) return;
  }

  // Convert Sets to arrays for scoring.
  const selections = {};
  for (const [qid, set] of attempt.selections) selections[qid] = [...set];

  const result = scoreAttempt(attempt.quiz, selections);
  setLastResult(attempt.quiz, result);
  navigate(`#/results/${attempt.quiz.id}`);
}

// Fisher-Yates in place.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
