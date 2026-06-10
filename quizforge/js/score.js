// score.js, scoring (spec 1.5). Scoring is identical for both question types
// and reduces to set equality between the user's selected ids and the
// question's `correct` ids. Multi-choice is all-or-nothing (no partial credit).

/**
 * Score one question. Returns 1 if the selected set exactly equals the correct
 * set (same members, no more, no fewer), otherwise 0.
 */
export function scoreQuestion(question, selectedIds) {
  const a = new Set(selectedIds);
  const b = new Set(question.correct);
  if (a.size !== b.size) return 0;
  for (const id of a) if (!b.has(id)) return 0;
  return 1;
}

/**
 * Score a whole attempt.
 * @param quiz       the quiz object
 * @param selections Map|object of questionId -> array of selected choice ids
 * @returns { total, max, percentage, perQuestion: [{ questionId, selectedIds, correctIds, correct }] }
 *          percentage is rounded to a whole number (open Q7 default).
 */
export function scoreAttempt(quiz, selections) {
  const get = (qid) =>
    selections instanceof Map ? (selections.get(qid) || []) : (selections[qid] || []);

  const perQuestion = quiz.questions.map((q) => {
    const selectedIds = get(q.id);
    const correct = scoreQuestion(q, selectedIds) === 1;
    return {
      questionId: q.id,
      selectedIds: [...selectedIds],
      correctIds: [...q.correct],
      correct
    };
  });

  const total = perQuestion.reduce((sum, r) => sum + (r.correct ? 1 : 0), 0);
  const max = quiz.questions.length;
  const percentage = max > 0 ? Math.round((total / max) * 100) : 0;

  return { total, max, percentage, perQuestion };
}
