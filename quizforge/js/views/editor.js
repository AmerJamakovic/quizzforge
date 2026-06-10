// views/editor.js, Editor (spec 1.6 D; R1, R2, R11).
// Author quizzes: edit title/description/settings, add/edit/delete/reorder
// questions and choices, choose type (single/multi), mark correct answers, with
// live validation and save to IndexedDB. Export the current quiz and import one.

import { getQuiz, saveQuiz, quizExists } from '../db.js';
import {
  createQuiz, createQuestion, createChoice,
  nextQuestionId, nextChoiceId, validateQuiz,
  MAX_QUESTIONS, MIN_CHOICES
} from '../schema.js';
import { importFile } from '../io.js';
import { exportQuizWithConfirm } from '../modal.js';
import { takePendingDraft } from '../state.js';
import { el, esc, toast } from '../util.js';
import { navigate } from '../main.js';

let draft = null;        // working copy of the quiz being edited
let currentRoot = null;  // for in-handler redraws

export async function render(root, param) {
  currentRoot = root;
  if (param === 'new' || !param) {
    // A converted import (e.g. ClassMarker) may be waiting to be edited.
    const pending = takePendingDraft();
    draft = pending || createQuiz();
    if (pending) ensureShape(draft);
  } else {
    const existing = await getQuiz(param);
    if (!existing) {
      toast('That quiz no longer exists.', 'error');
      navigate('#/');
      return;
    }
    draft = structuredClone(existing);
    ensureShape(draft);
  }
  draw();
}

// Tolerate older/imported quizzes that lack a settings block.
// Questions per page is restricted to 1..10 in the editor.
const MIN_QPP = 1;
const MAX_QPP = 10;

function ensureShape(q) {
  q.settings = q.settings || {};
  let qpp = parseInt(q.settings.questionsPerPage, 10);
  if (!Number.isInteger(qpp)) qpp = 1;
  q.settings.questionsPerPage = Math.min(MAX_QPP, Math.max(MIN_QPP, qpp));
  q.settings.shuffleQuestions = !!q.settings.shuffleQuestions;
  q.settings.shuffleChoices = !!q.settings.shuffleChoices;
  q.questions = Array.isArray(q.questions) ? q.questions : [];
}

function draw() {
  const root = currentRoot;
  root.innerHTML = '';

  root.appendChild(el('div', { class: 'view-header' },
    el('h1', {}, draft.questions.length ? 'Edit quiz' : 'New quiz'),
    el('a', { class: 'btn ghost', href: '#/' }, '← Library')
  ));

  // Hidden file input for "Import into editor".
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', class: 'visually-hidden',
    onchange: (e) => handleImport(e.target.files)
  });
  root.appendChild(fileInput);

  // --- Quiz-level fields ---------------------------------------------------
  const meta = el('section', { class: 'panel editor-meta' });
  meta.appendChild(field('Title', el('input', {
    type: 'text', class: 'input', value: draft.title, maxlength: 200,
    placeholder: 'e.g. Capitals of Europe',
    oninput: (e) => { draft.title = e.target.value; refreshValidation(); }
  })));
  meta.appendChild(field('Description (optional)', el('input', {
    type: 'text', class: 'input', value: draft.description || '', maxlength: 300,
    placeholder: 'One-line summary',
    oninput: (e) => { draft.description = e.target.value; }
  })));

  const settings = el('div', { class: 'settings-row' },
    field('Questions per page', questionsPerPageSelect()),
    checkbox('Shuffle questions', draft.settings.shuffleQuestions, (v) => { draft.settings.shuffleQuestions = v; }),
    checkbox('Shuffle choices', draft.settings.shuffleChoices, (v) => { draft.settings.shuffleChoices = v; })
  );
  meta.appendChild(settings);
  root.appendChild(meta);

  // --- Validation panel (updated live) ------------------------------------
  root.appendChild(el('div', { id: 'validation-panel' }));

  // --- Questions -----------------------------------------------------------
  const qHeader = el('div', { class: 'questions-header' },
    el('h2', {}, `Questions (${draft.questions.length}/${MAX_QUESTIONS})`),
    el('button', { class: 'btn primary', onclick: addQuestion }, '+ Add question')
  );
  root.appendChild(qHeader);

  if (draft.questions.length === 0) {
    root.appendChild(el('p', { class: 'muted' }, 'No questions yet. Add your first question to get started.'));
  } else {
    const list = el('div', { class: 'editor-questions' });
    draft.questions.forEach((q, i) => list.appendChild(renderQuestionEditor(q, i)));
    root.appendChild(list);

    // Second "add" button at the bottom so you do not have to scroll back up.
    root.appendChild(el('div', { class: 'add-another-row' },
      el('button', { class: 'btn primary add-another', onclick: addQuestion }, '+ Add another question')
    ));
  }

  // --- Footer actions ------------------------------------------------------
  root.appendChild(el('div', { class: 'editor-footer' },
    el('button', { class: 'btn primary', onclick: save }, 'Save'),
    el('button', { class: 'btn', onclick: () => exportQuizWithConfirm(draft) }, 'Export'),
    el('button', { class: 'btn', onclick: () => fileInput.click() }, 'Import…'),
    el('a', { class: 'btn ghost', href: '#/' }, 'Cancel')
  ));

  refreshValidation();
}

// ---------------------------------------------------------------------------
// Question editor block
// ---------------------------------------------------------------------------
function renderQuestionEditor(q, index) {
  const block = el('section', { class: 'panel question-editor' });

  block.appendChild(el('div', { class: 'qe-head' },
    el('span', { class: 'qe-number' }, `Q${index + 1}`),
    el('div', { class: 'qe-head-actions' },
      el('button', { class: 'btn tiny', disabled: index === 0, onclick: () => moveQuestion(index, -1), title: 'Move up' }, '↑'),
      el('button', { class: 'btn tiny', disabled: index === draft.questions.length - 1, onclick: () => moveQuestion(index, 1), title: 'Move down' }, '↓'),
      el('button', { class: 'btn tiny danger', onclick: () => deleteQuestion(index), title: 'Delete question' }, '✕')
    )
  ));

  // Prompt
  block.appendChild(field('Prompt', el('input', {
    type: 'text', class: 'input', value: q.prompt, maxlength: 500,
    placeholder: 'Type the question…',
    oninput: (e) => { q.prompt = e.target.value; refreshValidation(); }
  })));

  // Type selector
  const typeSel = el('select', {
    class: 'input small',
    onchange: (e) => changeType(q, e.target.value)
  },
    el('option', { value: 'single', selected: q.type === 'single' }, 'Single choice (pick one)'),
    el('option', { value: 'multi', selected: q.type === 'multi' }, 'Multiple choice (pick one or more)')
  );
  block.appendChild(field('Type', typeSel));

  // Choices
  const isMulti = q.type === 'multi';
  const correctSet = new Set(q.correct);
  const choicesWrap = el('div', { class: 'qe-choices' });
  choicesWrap.appendChild(el('p', { class: 'qe-choices-label muted' },
    isMulti ? 'Tick every correct answer.' : 'Select the one correct answer.'));

  q.choices.forEach((choice, ci) => {
    const inputId = `mark-${q.id}-${choice.id}`;
    const marker = el('input', {
      type: isMulti ? 'checkbox' : 'radio',
      name: `correct-${q.id}`,
      id: inputId,
      checked: correctSet.has(choice.id),
      onchange: (e) => markCorrect(q, choice.id, e.target.checked, isMulti)
    });
    const row = el('div', { class: 'qe-choice' },
      el('label', { class: 'qe-choice-mark', for: inputId, title: 'Mark correct' }, marker),
      el('input', {
        type: 'text', class: 'input', value: choice.text, maxlength: 300,
        placeholder: `Choice ${ci + 1}`,
        oninput: (e) => { choice.text = e.target.value; refreshValidation(); }
      }),
      el('button', { class: 'btn tiny', disabled: ci === 0, onclick: () => moveChoice(q, ci, -1), title: 'Move up' }, '↑'),
      el('button', { class: 'btn tiny', disabled: ci === q.choices.length - 1, onclick: () => moveChoice(q, ci, 1), title: 'Move down' }, '↓'),
      el('button', { class: 'btn tiny danger', onclick: () => deleteChoice(q, ci), title: 'Delete choice' }, '✕')
    );
    choicesWrap.appendChild(row);
  });

  choicesWrap.appendChild(el('button', { class: 'btn small', onclick: () => addChoice(q) }, '+ Add choice'));
  block.appendChild(choicesWrap);
  return block;
}

// ---------------------------------------------------------------------------
// Mutations (each redraws or refreshes validation as appropriate)
// ---------------------------------------------------------------------------
function addQuestion() {
  if (draft.questions.length >= MAX_QUESTIONS) {
    toast(`A quiz can have at most ${MAX_QUESTIONS} questions.`, 'error');
    return;
  }
  const q = createQuestion(draft.questions.map((x) => x.id));
  q.id = nextQuestionId(draft);
  draft.questions.push(q);
  draw();

  // Bring the freshly added question into view and focus its prompt, so adding
  // from the bottom button does not leave you staring at the wrong spot.
  const blocks = currentRoot.querySelectorAll('.question-editor');
  const last = blocks[blocks.length - 1];
  if (last) {
    last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const promptInput = last.querySelector('input[type="text"]');
    if (promptInput) promptInput.focus({ preventScroll: true });
  }
}

function deleteQuestion(index) {
  draft.questions.splice(index, 1);
  draw();
}

function moveQuestion(index, dir) {
  const j = index + dir;
  if (j < 0 || j >= draft.questions.length) return;
  [draft.questions[index], draft.questions[j]] = [draft.questions[j], draft.questions[index]];
  draw();
}

function changeType(q, newType) {
  if (q.type === newType) return;
  if (newType === 'single' && q.correct.length > 1) {
    // Keep the first correct answer, warn the user (spec 1.6 D).
    q.correct = [q.correct[0]];
    toast('Switched to single choice, kept the first correct answer.', 'info');
  }
  q.type = newType;
  draw();
}

function markCorrect(q, choiceId, checked, isMulti) {
  if (isMulti) {
    const set = new Set(q.correct);
    if (checked) set.add(choiceId); else set.delete(choiceId);
    // Preserve choice order in the correct array.
    q.correct = q.choices.filter((c) => set.has(c.id)).map((c) => c.id);
  } else {
    q.correct = checked ? [choiceId] : [];
  }
  refreshValidation();
}

function addChoice(q) {
  const c = createChoice(q.choices.map((x) => x.id));
  c.id = nextChoiceId(q);
  q.choices.push(c);
  draw();
}

function deleteChoice(q, ci) {
  if (q.choices.length <= MIN_CHOICES) {
    toast(`A question needs at least ${MIN_CHOICES} choices.`, 'error');
    return;
  }
  const removed = q.choices.splice(ci, 1)[0];
  q.correct = q.correct.filter((id) => id !== removed.id);
  draw();
}

function moveChoice(q, ci, dir) {
  const j = ci + dir;
  if (j < 0 || j >= q.choices.length) return;
  [q.choices[ci], q.choices[j]] = [q.choices[j], q.choices[ci]];
  draw();
}

// ---------------------------------------------------------------------------
// Validation panel + save
// ---------------------------------------------------------------------------
function refreshValidation() {
  const panel = document.getElementById('validation-panel');
  if (!panel) return;
  const { ok, errors } = validateQuiz(draft);
  panel.innerHTML = '';
  if (ok) {
    panel.appendChild(el('div', { class: 'validation ok' }, 'Looks good, ready to save.'));
  } else {
    const box = el('div', { class: 'validation has-errors' },
      el('p', { class: 'validation-title' }, `${errors.length} thing${errors.length === 1 ? '' : 's'} to fix before saving:`));
    const ul = el('ul', {});
    errors.forEach((msg) => ul.appendChild(el('li', {}, msg)));
    box.appendChild(ul);
    panel.appendChild(box);
  }
}

async function save() {
  const { ok, errors } = validateQuiz(draft);
  if (!ok) {
    refreshValidation();
    toast(`Can't save yet: ${errors[0]}`, 'error');
    return;
  }
  draft.updatedAt = new Date().toISOString();
  if (!draft.createdAt) draft.createdAt = draft.updatedAt;
  await saveQuiz(structuredClone(draft));
  toast('Quiz saved.', 'success');
  navigate('#/');
}

async function handleImport(files) {
  if (!files || files.length === 0) return;
  try {
    const { quizzes } = await importFile(files[0], quizExists);
    draft = quizzes[0];
    ensureShape(draft);
    if (quizzes.length > 1) {
      toast(`Loaded the first of ${quizzes.length} quizzes from the file into the editor.`, 'info');
    } else {
      toast('Quiz loaded into the editor.', 'success');
    }
    draw();
  } catch (err) {
    toast(err.message || 'Import failed.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Small field helpers
// ---------------------------------------------------------------------------
// A 1..10 dropdown for questions per page. Using a select means no manual
// typing, so values like 0 or -10 are impossible; only 1 through 10 apply.
function questionsPerPageSelect() {
  const current = Math.min(MAX_QPP, Math.max(MIN_QPP, draft.settings.questionsPerPage || 1));
  draft.settings.questionsPerPage = current;
  const sel = el('select', {
    class: 'input small',
    onchange: (e) => { draft.settings.questionsPerPage = parseInt(e.target.value, 10); refreshValidation(); }
  });
  for (let i = MIN_QPP; i <= MAX_QPP; i++) {
    sel.appendChild(el('option', { value: i, selected: i === current }, String(i)));
  }
  return sel;
}

function field(labelText, control) {
  return el('label', { class: 'field' },
    el('span', { class: 'field-label' }, labelText),
    control
  );
}

function checkbox(labelText, checked, onchange) {
  return el('label', { class: 'checkbox-field' },
    el('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }),
    el('span', {}, labelText)
  );
}
