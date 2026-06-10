// views/results.js, Results (spec 1.6 C; R4, R7, R8, R9).
// Header summary (n / m correct + percentage), per-question breakdown revealing
// the user's selection(s), the correct selection(s), and a right/wrong marker.
// Retake resets the attempt; a link returns to the library.

import { getQuiz } from '../db.js';
import { getLastResult, clearLastResult } from '../state.js';
import { el, esc } from '../util.js';
import { navigate } from '../main.js';

export async function render(root, quizId) {
  const stored = getLastResult();

  // Results only exist for a just-completed attempt held in memory. On a
  // refresh or direct link there is nothing to show, so send them to take it.
  if (!stored || stored.quiz.id !== quizId) {
    const quiz = await getQuiz(quizId);
    navigate(quiz ? `#/take/${quizId}` : '#/');
    return;
  }

  const { quiz, result } = stored;

  root.appendChild(el('div', { class: 'view-header' },
    el('h1', {}, 'Results'),
    el('a', { class: 'btn ghost', href: '#/' }, '← Library')
  ));

  // Header summary.
  const pct = result.percentage;
  const tone = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'low';
  root.appendChild(el('section', { class: `panel score-summary tone-${tone}` },
    el('p', { class: 'score-big' }, `${result.total} / ${result.max}`),
    el('p', { class: 'score-pct' }, `${pct}%`),
    el('p', { class: 'muted' }, esc(quiz.title))
  ));

  // Controls.
  root.appendChild(el('div', { class: 'take-nav' },
    el('button', { class: 'btn primary', onclick: () => retake(quizId) }, 'Retake'),
    el('a', { class: 'btn', href: '#/' }, 'Back to library')
  ));

  // Per-question breakdown.
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const list = el('ol', { class: 'results-list' });
  for (const r of result.perQuestion) {
    const q = byId.get(r.questionId);
    if (q) list.appendChild(renderResultRow(q, r));
  }
  root.appendChild(list);
}

function renderResultRow(q, r) {
  const correctSet = new Set(r.correctIds);
  const selectedSet = new Set(r.selectedIds);

  const item = el('li', { class: `result-row ${r.correct ? 'is-correct' : 'is-wrong'}` });
  item.appendChild(el('div', { class: 'result-head' },
    el('span', { class: `result-marker ${r.correct ? 'ok' : 'no'}` }, r.correct ? '✓' : '✗'),
    el('span', { class: 'result-prompt' }, esc(q.prompt))
  ));

  const choices = el('ul', { class: 'result-choices' });
  for (const choice of q.choices) {
    const isCorrect = correctSet.has(choice.id);
    const isChosen = selectedSet.has(choice.id);
    const classes = ['result-choice'];
    if (isCorrect) classes.push('correct-answer');
    if (isChosen) classes.push('user-chose');
    if (isChosen && !isCorrect) classes.push('wrong-choice');

    const tags = [];
    if (isChosen) tags.push('your pick');
    if (isCorrect) tags.push('correct');

    choices.appendChild(el('li', { class: classes.join(' ') },
      el('span', { class: 'result-choice-text' }, esc(choice.text)),
      tags.length ? el('span', { class: 'result-tags' }, tags.join(' · ')) : null
    ));
  }
  item.appendChild(choices);

  if (selectedSet.size === 0) {
    item.appendChild(el('p', { class: 'muted result-note' }, 'You left this question unanswered.'));
  }
  return item;
}

function retake(quizId) {
  clearLastResult();
  navigate(`#/take/${quizId}`);
}
