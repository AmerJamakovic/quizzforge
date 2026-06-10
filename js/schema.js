// schema.js, the quiz JSON contract (spec 1.4), validation (1.7), and factory
// helpers for building new quizzes/questions/choices.
//
// The schema is the import/export format shared over Discord, so it must stay
// stable and versioned. `correct` is ALWAYS an array for both question types;
// a single-choice question simply has exactly one id in it (unifies scoring).

export const SCHEMA_VERSION = 1;
export const MAX_QUESTIONS = 50;
export const MIN_CHOICES = 2;

// ---------------------------------------------------------------------------
// ID helpers, ids are local to a quiz (e.g. `qq1`, `c1`), unique within scope.
// ---------------------------------------------------------------------------

/** Next sequential local id for a prefix, avoiding any in `existing`. */
function nextLocalId(prefix, existing) {
  const taken = new Set(existing);
  let n = 1;
  while (taken.has(prefix + n)) n++;
  return prefix + n;
}

/** A reasonably unique quiz id (uuid when available, else a short slug). */
export function newQuizId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return 'q_' + crypto.randomUUID().slice(0, 8);
  }
  return 'q_' + Math.random().toString(36).slice(2, 10);
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createChoice(existingIds = [], text = '') {
  return { id: nextLocalId('c', existingIds), text };
}

export function createQuestion(existingIds = []) {
  const id = nextLocalId('qq', existingIds);
  const c1 = createChoice([]);
  const c2 = createChoice([c1.id]);
  return {
    id,
    type: 'single',
    prompt: '',
    choices: [c1, c2],
    correct: []
  };
}

export function createQuiz() {
  const ts = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newQuizId(),
    title: '',
    description: '',
    createdAt: ts,
    updatedAt: ts,
    settings: {
      questionsPerPage: 1,
      shuffleQuestions: false,
      shuffleChoices: false
    },
    questions: []
  };
}

export function nextQuestionId(quiz) {
  return nextLocalId('qq', quiz.questions.map(q => q.id));
}

export function nextChoiceId(question) {
  return nextLocalId('c', question.choices.map(c => c.id));
}

// ---------------------------------------------------------------------------
// Validation (spec 1.7). Returns { ok, errors: string[] }.
// `errors` is empty when ok is true. Used for live editor feedback and to
// guard imports.
// ---------------------------------------------------------------------------

export function validateQuiz(quiz) {
  const errors = [];
  const push = (m) => errors.push(m);

  if (!quiz || typeof quiz !== 'object') {
    return { ok: false, errors: ['Not a valid quiz object.'] };
  }

  // Title, non-empty after trimming.
  if (typeof quiz.title !== 'string' || quiz.title.trim() === '') {
    push('Title must not be empty.');
  }

  // settings.questionsPerPage, integer >= 1.
  const qpp = quiz.settings && quiz.settings.questionsPerPage;
  if (!Number.isInteger(qpp) || qpp < 1) {
    push('Questions per page must be a whole number of at least 1.');
  }

  // Question count, 1..50 inclusive.
  if (!Array.isArray(quiz.questions)) {
    push('Quiz must have a list of questions.');
    return { ok: false, errors };
  }
  if (quiz.questions.length < 1) {
    push('A quiz needs at least one question.');
  }
  if (quiz.questions.length > MAX_QUESTIONS) {
    push(`A quiz cannot exceed ${MAX_QUESTIONS} questions.`);
  }

  // Per-question checks.
  const seenQuestionIds = new Set();
  quiz.questions.forEach((q, qi) => {
    const label = `Question ${qi + 1}`;

    if (!q.id || seenQuestionIds.has(q.id)) {
      push(`${label}: duplicate or missing id.`);
    }
    seenQuestionIds.add(q.id);

    if (q.type !== 'single' && q.type !== 'multi') {
      push(`${label}: type must be "single" or "multi".`);
    }
    if (typeof q.prompt !== 'string' || q.prompt.trim() === '') {
      push(`${label}: prompt must not be empty.`);
    }
    if (!Array.isArray(q.choices) || q.choices.length < MIN_CHOICES) {
      push(`${label}: needs at least ${MIN_CHOICES} choices.`);
    }

    // Unique choice ids within the question; non-empty choice text.
    const seenChoiceIds = new Set();
    (q.choices || []).forEach((c, ci) => {
      if (!c.id || seenChoiceIds.has(c.id)) {
        push(`${label}, choice ${ci + 1}: duplicate or missing id.`);
      }
      seenChoiceIds.add(c.id);
      if (typeof c.text !== 'string' || c.text.trim() === '') {
        push(`${label}, choice ${ci + 1}: text must not be empty.`);
      }
    });

    // correct must be an array; ids must reference existing choices.
    if (!Array.isArray(q.correct)) {
      push(`${label}: correct answers must be a list.`);
    } else {
      q.correct.forEach((id) => {
        if (!seenChoiceIds.has(id)) {
          push(`${label}: correct answer "${id}" is not one of the choices.`);
        }
      });
      // single => exactly one; multi => at least one.
      if (q.type === 'single' && q.correct.length !== 1) {
        push(`${label}: a single-choice question must have exactly one correct answer.`);
      }
      if (q.type === 'multi' && q.correct.length < 1) {
        push(`${label}: a multi-choice question must have at least one correct answer.`);
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Import normalisation, accept either a single-quiz object or the collection
// form { schemaVersion, quizzes: [...] }. Returns an array of quiz objects
// (not yet validated). Throws on shapes that are clearly not QuizForge data.
// ---------------------------------------------------------------------------

export function normalizeImport(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File does not contain a quiz.');
  }
  if (Array.isArray(parsed.quizzes)) {
    if (parsed.quizzes.length === 0) {
      throw new Error('This file is a collection but contains no quizzes.');
    }
    return parsed.quizzes;
  }
  // Single-quiz object: must at least look like one.
  if (Array.isArray(parsed.questions)) {
    return [parsed];
  }
  throw new Error('File is not a QuizForge quiz (no questions found).');
}
