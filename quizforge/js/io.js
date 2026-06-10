// io.js, import / export (the Discord workflow, spec 1.9).
// Export serialises a quiz to a downloadable .json file named from the title.
// Import reads a file, parses it, validates against the schema, and (on success)
// returns the quizzes ready to be stored. The app makes no network requests;
// Discord is only the transport.

import { validateQuiz, normalizeImport, newQuizId } from './schema.js';

/** Turn a title into a safe filename slug. */
export function slugify(title) {
  const base = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // drop punctuation
    .replace(/[\s_-]+/g, '-')   // collapse whitespace/underscores to single dash
    .replace(/^-+|-+$/g, '');   // trim leading/trailing dashes
  return base || 'quiz';
}

/** Export a single quiz: triggers a browser download of pretty-printed JSON. */
export function exportQuiz(quiz) {
  const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: slugify(quiz.title) + '.json'
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Read and validate a quiz file selected via an <input type="file">.
 * Returns { quizzes: [...] } on success. Throws an Error with a specific,
 * friendly message on any failure, never fails silently.
 *
 * @param existsFn  async (id) => boolean, used to assign fresh ids on collision.
 */
export async function importFile(file, existsFn) {
  let text;
  try {
    text = await file.text();
  } catch {
    throw new Error('Could not read the file.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Make sure it is a quiz exported from QuizForge.');
  }

  const candidates = normalizeImport(parsed); // throws with a friendly message

  // Validate each candidate; report the first quiz that fails.
  const out = [];
  for (let i = 0; i < candidates.length; i++) {
    const quiz = candidates[i];
    const { ok, errors } = validateQuiz(quiz);
    if (!ok) {
      const where = candidates.length > 1 ? ` (quiz ${i + 1} of ${candidates.length})` : '';
      throw new Error(`This quiz is not valid${where}: ${errors[0]}`);
    }
    out.push(quiz);
  }

  // Assign fresh ids on collision so an import never clobbers an existing quiz.
  for (const quiz of out) {
    if (!quiz.id || (existsFn && (await existsFn(quiz.id)))) {
      quiz.id = newQuizId();
    }
  }

  return { quizzes: out };
}
