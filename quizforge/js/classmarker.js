// classmarker.js, import quizzes scraped from a ClassMarker results page.
//
// ClassMarker doesn't export quizzes, so the user runs a small scraper in their
// browser console on the results screen (where every answer is revealed). That
// script copies a JSON array to the clipboard; the user pastes it here and we
// convert it into a normal QuizForge quiz they can edit and save.
//
// ClassMarker question shape (one per array element):
//   { n, points, correct, type: 'single'|'multi', q,
//     options: [ { text, correct, selected } ] }
// `correct` on each option is the TRUE answer (revealed on the results page),
// independent of what the user selected, so it maps straight to our `correct`.

import { createQuiz } from './schema.js';
import { MAX_QUESTIONS } from './schema.js';

// The scraper the user pastes into the browser console on the ClassMarker
// results page. Kept free of backticks/template literals so it is safe to
// store and display verbatim.
export const CLASSMARKER_SCRIPT =
`const data = [...document.querySelectorAll('div.feedback[data-cy^="question-idx"]')].map(q => {
  const txt = el => el ? el.textContent.trim() : '';
  const pts = txt(q.querySelector('#points'));
  const m = pts.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
  const list = q.querySelector('ion-list');
  return {
    n: txt(q.querySelector('ion-card-title')),
    points: pts,
    correct: m ? (+m[1] === +m[2]) : null,
    type: (list && list.className.includes('radio-list')) ? 'single' : 'multi',
    q: txt(q.querySelector('ion-list-header .bbcode')),
    options: [...q.querySelectorAll('ion-item')]
      .filter(it => it.querySelector('[data-cy="question-option-text"]'))
      .map(it => {
        const ic = it.querySelector('ion-icon.icon-correct');
        const lab = ic ? (ic.getAttribute('aria-label') || '') : '';
        return {
          text: txt(it.querySelector('[data-cy="question-option-text"]')),
          correct: lab === 'Correctly answered' || lab === 'Missed correct option',
          selected: lab === 'Correctly answered' || lab === 'Incorrectly answered'
        };
      })
  };
});
copy(JSON.stringify(data, null, 1));
console.log('QuizForge: extracted ' + data.length + ' question(s) and copied them to the clipboard. Paste them into the QuizForge importer.');`;

/** Parse the pasted clipboard text into a ClassMarker question array. */
export function parseClassMarker(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Paste the data the script copied to your clipboard first.');

  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('That is not valid JSON. Copy the full output the console script produced and paste it again.');
  }

  if (!Array.isArray(data)) {
    throw new Error('Expected a list of questions. Make sure you copied the whole output of the script.');
  }
  if (data.length === 0) {
    throw new Error('No questions were found. Run the script on the ClassMarker results screen after answering every question.');
  }
  return data;
}

/**
 * Convert a ClassMarker question array into a QuizForge quiz.
 * Returns { quiz, dropped } where `dropped` is how many questions beyond the
 * 50-question cap were left out.
 */
export function convertClassMarker(cmQuestions, title) {
  const quiz = createQuiz();
  quiz.title = (title && title.trim()) || 'ClassMarker import';

  const dropped = Math.max(0, cmQuestions.length - MAX_QUESTIONS);
  const kept = cmQuestions.slice(0, MAX_QUESTIONS);

  quiz.questions = kept.map((cm, i) => convertQuestion(cm, i));
  return { quiz, dropped };
}

function convertQuestion(cm, index) {
  const prompt = String(cm && cm.q ? cm.q : '').trim();
  const options = Array.isArray(cm && cm.options) ? cm.options : [];

  const choices = options.map((o, ci) => ({
    id: 'c' + (ci + 1),
    text: String(o && o.text ? o.text : '').trim()
  }));

  const correct = options
    .map((o, ci) => ({ ok: !!(o && o.correct), id: 'c' + (ci + 1) }))
    .filter((x) => x.ok)
    .map((x) => x.id);

  // Trust ClassMarker's type, but a single-choice question must have exactly
  // one correct answer to be valid here, otherwise treat it as multi.
  let type = cm && cm.type === 'multi' ? 'multi' : 'single';
  if (type === 'single' && correct.length !== 1) type = 'multi';

  return {
    id: 'qq' + (index + 1),
    type,
    prompt,
    choices,
    correct
  };
}
