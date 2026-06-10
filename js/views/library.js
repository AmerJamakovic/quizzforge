// views/library.js, Home / library (spec 1.6 A).
// Lists all quizzes stored in the browser. Each entry shows title, question
// count, last updated, and actions: Take, Edit, Export, Delete.
// Top-level actions: New quiz and Import.

import { getAllQuizzes, deleteQuiz } from '../db.js';
import { exportQuizWithConfirm } from '../modal.js';
import { el, esc, formatDate, toast, confirmAction, callout } from '../util.js';
import { navigate } from '../main.js';

export async function render(root) {
  const quizzes = await getAllQuizzes();

  // Centered hero wordmark, curvy cursive with a theme-coloured outline.
  root.appendChild(el('div', { class: 'hero' },
    el('h1', { class: 'hero-wordmark' }, 'QuizForge'),
    el('p', { class: 'hero-tagline' }, 'Build, take and share quizzes. Free, in your browser.')
  ));

  const header = el('div', { class: 'view-header' },
    el('h2', {}, 'Your quizzes'),
    el('div', { class: 'view-actions' },
      el('button', { class: 'btn primary', onclick: () => navigate('#/editor/new') }, '+ New quiz'),
      el('button', { class: 'btn', onclick: () => navigate('#/import') }, 'Import…')
    )
  );

  root.appendChild(header);

  if (quizzes.length === 0) {
    root.appendChild(el('section', { class: 'panel empty-state' },
      el('p', {}, 'No quizzes yet.'),
      el('p', { class: 'muted' }, 'Create one with “New quiz”, or import a quiz a friend shared with you over Discord.')
    ));
    return;
  }

  const list = el('ul', { class: 'quiz-list' });
  for (const quiz of quizzes) {
    list.appendChild(renderRow(quiz, root));
  }
  root.appendChild(list);

  root.appendChild(callout({},
    'Quizzes are saved in ', el('strong', {}, 'this browser only'),
    '. ', el('strong', {}, 'Export'), ' a quiz to keep a durable backup and to share it.'
  ));
}

function renderRow(quiz, root) {
  const count = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  return el('li', { class: 'quiz-row' },
    el('div', { class: 'quiz-row-main' },
      el('h2', { class: 'quiz-title' }, quiz.title || '(untitled quiz)'),
      el('p', { class: 'quiz-meta muted' },
        `${count} question${count === 1 ? '' : 's'} · updated ${formatDate(quiz.updatedAt)}`
      ),
      quiz.description ? el('p', { class: 'quiz-desc' }, quiz.description) : null
    ),
    el('div', { class: 'quiz-row-actions' },
      el('button', { class: 'btn primary', onclick: () => navigate(`#/take/${quiz.id}`) }, 'Take'),
      el('button', { class: 'btn', onclick: () => navigate(`#/editor/${quiz.id}`) }, 'Edit'),
      el('button', { class: 'btn', onclick: () => exportQuizWithConfirm(quiz) }, 'Export'),
      el('button', { class: 'btn danger', onclick: () => onDelete(quiz, root) }, 'Delete')
    )
  );
}

async function onDelete(quiz, root) {
  if (!confirmAction(`Delete “${quiz.title || 'this quiz'}”? This only removes it from this browser; any exported .json file is unaffected.`)) {
    return;
  }
  await deleteQuiz(quiz.id);
  toast('Quiz deleted.', 'success');
  await render(clear(root));
}

// Clear the view root and return it, for re-rendering in place.
function clear(root) {
  root.innerHTML = '';
  return root;
}
