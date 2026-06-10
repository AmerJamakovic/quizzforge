// state.js, transient, in-memory app state that does not belong in storage.
// Currently just the most recent scored attempt, handed from the Take view to
// the Results view across a route change.

let lastResult = null; // { quiz, result } from score.scoreAttempt

export function setLastResult(quiz, result) {
  lastResult = { quiz, result };
}

export function getLastResult() {
  return lastResult;
}

export function clearLastResult() {
  lastResult = null;
}

// A quiz handed to the editor as an unsaved draft (e.g. a freshly converted
// ClassMarker import). The editor consumes it once, then it is cleared.
let pendingDraft = null;

export function setPendingDraft(quiz) {
  pendingDraft = quiz;
}

/** Return the pending draft and clear it, or null if none. */
export function takePendingDraft() {
  const d = pendingDraft;
  pendingDraft = null;
  return d;
}
